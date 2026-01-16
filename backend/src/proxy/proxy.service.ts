import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DatabaseService } from '../database/database.service';
import axios from 'axios';
import { SocksProxyAgent } from 'socks-proxy-agent';

interface ProxyInfo {
    protocol: string;
    host: string;
    port: number;
}

@Injectable()
export class ProxyService implements OnModuleInit {
    private readonly logger = new Logger(ProxyService.name);
    private readonly PROXY_CDN_URL = 'https://cdn.jsdelivr.net/gh/proxifly/free-proxy-list@main/proxies/protocols/socks5/data.txt';
    private readonly VALIDATION_TIMEOUT = 10000; // 10 seconds
    private readonly MAX_CONCURRENT_VALIDATIONS = 20; // Limit concurrent connections

    constructor(private readonly databaseService: DatabaseService) { }

    async onModuleInit() {
        await this.initTable();
        // Run initial proxy fetch on startup
        this.refreshProxies();
    }

    /**
     * Initialize proxies table
     */
    private async initTable() {
        await this.databaseService.sql`
            CREATE TABLE IF NOT EXISTS proxies (
                id SERIAL PRIMARY KEY,
                protocol VARCHAR(10) NOT NULL,
                host VARCHAR(255) NOT NULL,
                port INTEGER NOT NULL,
                last_checked TIMESTAMP DEFAULT NOW(),
                is_working BOOLEAN DEFAULT true,
                fail_count INTEGER DEFAULT 0,
                response_time INTEGER DEFAULT 0,
                UNIQUE(host, port)
            )
        `;
        // Add response_time column if not exists (for existing tables)
        await this.databaseService.sql`
            ALTER TABLE proxies ADD COLUMN IF NOT EXISTS response_time INTEGER DEFAULT 0
        `;
        this.logger.log('🌐 Proxies table initialized');
    }

    /**
     * Cronjob: Refresh proxies every 5 minutes
     */
    @Cron(CronExpression.EVERY_HOUR)
    async refreshProxies() {
        this.logger.log('🔄 Starting proxy refresh...');

        try {
            // Fetch proxy list from CDN
            const proxies = await this.fetchProxiesFromCDN();
            this.logger.log(`📥 Fetched ${proxies.length} proxies from CDN`);

            if (proxies.length === 0) {
                this.logger.warn('⚠️ No proxies found in CDN response');
                return;
            }

            // Shuffle proxies to get random sample each time
            const shuffled = proxies.sort(() => Math.random() - 0.5);

            // Check only 10 proxies initially, continue only if not enough working
            const INITIAL_CHECK = 10;
            const MIN_WORKING_REQUIRED = 3;
            let workingCount = 0;
            let checkedCount = 0;

            for (let i = 0; i < shuffled.length; i += this.MAX_CONCURRENT_VALIDATIONS) {
                const batch = shuffled.slice(i, i + this.MAX_CONCURRENT_VALIDATIONS);
                const results = await Promise.allSettled(
                    batch.map(async (proxy) => {
                        const responseTime = await this.validateProxy(proxy);
                        if (responseTime > 0) {
                            // Save immediately when proxy is working (with response time)
                            await this.saveProxy(proxy, responseTime);
                            return true;
                        } else {
                            // Mark as failed immediately
                            await this.markProxyAsFailed(proxy);
                            return false;
                        }
                    })
                );

                for (const result of results) {
                    checkedCount++;
                    if (result.status === 'fulfilled' && result.value) {
                        workingCount++;
                    }
                }

                this.logger.debug(`✅ Checked ${checkedCount} proxies, found ${workingCount} working`);

                // Stop early if we have enough working proxies after initial check
                if (checkedCount >= INITIAL_CHECK && workingCount >= MIN_WORKING_REQUIRED) {
                    this.logger.log(`✅ Found ${workingCount} working proxies (checked ${checkedCount}/${shuffled.length}), stopping early`);
                    break;
                }
            }

            if (workingCount < MIN_WORKING_REQUIRED) {
                this.logger.warn(`⚠️ Only found ${workingCount} working proxies after checking ${checkedCount}`);
            }

            // Cleanup dead proxies (> 5 consecutive failures)
            await this.cleanupDeadProxies();

        } catch (error) {
            this.logger.error('❌ Proxy refresh failed:', error);
        }
    }

    /**
     * Fetch proxy list from CDN
     */
    private async fetchProxiesFromCDN(): Promise<ProxyInfo[]> {
        try {
            const response = await fetch(this.PROXY_CDN_URL);
            if (!response.ok) {
                throw new Error(`Failed to fetch: ${response.status}`);
            }

            const text = await response.text();
            const lines = text.split('\n').filter(line => line.trim());

            const proxies: ProxyInfo[] = [];
            for (const line of lines) {
                const parsed = this.parseProxyLine(line.trim());
                if (parsed) {
                    proxies.push(parsed);
                }
            }

            return proxies;
        } catch (error) {
            this.logger.error('Failed to fetch proxies from CDN:', error);
            return [];
        }
    }

    /**
     * Parse proxy line: socks5://192.111.137.37:18762
     */
    private parseProxyLine(line: string): ProxyInfo | null {
        const match = line.match(/^(socks[45]?|http[s]?):\/\/([^:]+):(\d+)$/);
        if (!match) {
            // Try without protocol (just host:port)
            const simpleMatch = line.match(/^([^:]+):(\d+)$/);
            if (simpleMatch) {
                return {
                    protocol: 'socks5',
                    host: simpleMatch[1],
                    port: parseInt(simpleMatch[2], 10),
                };
            }
            return null;
        }

        return {
            protocol: match[1],
            host: match[2],
            port: parseInt(match[3], 10),
        };
    }

    /**
     * Validate proxy by making actual HTTP request through it
     * Returns response time in ms if working, 0 if failed
     */
    private async validateProxy(proxy: ProxyInfo): Promise<number> {
        try {
            const proxyUrl = `${proxy.protocol}://${proxy.host}:${proxy.port}`;
            const agent = new SocksProxyAgent(proxyUrl);

            const startTime = Date.now();
            const response = await axios.get('https://api.ipify.org?format=json', {
                httpAgent: agent,
                httpsAgent: agent,
                timeout: this.VALIDATION_TIMEOUT,
            });
            const responseTime = Date.now() - startTime;

            // If we get a valid IP response, proxy is working
            if (response.data?.ip) {
                return responseTime;
            }
            return 0;
        } catch {
            return 0;
        }
    }

    /**
     * Save a single working proxy to database immediately
     */
    private async saveProxy(proxy: ProxyInfo, responseTime: number) {
        try {
            await this.databaseService.sql`
                INSERT INTO proxies (protocol, host, port, last_checked, is_working, fail_count, response_time)
                VALUES (${proxy.protocol}, ${proxy.host}, ${proxy.port}, NOW(), true, 0, ${responseTime})
                ON CONFLICT (host, port) 
                DO UPDATE SET 
                    protocol = ${proxy.protocol},
                    last_checked = NOW(),
                    is_working = true,
                    fail_count = 0,
                    response_time = ${responseTime}
            `;
            this.logger.debug(`💾 Saved proxy ${proxy.host}:${proxy.port} (${responseTime}ms)`);
        } catch (error) {
            this.logger.error(`Failed to save proxy ${proxy.host}:${proxy.port}:`, error);
        }
    }

    /**
     * Mark a proxy as failed during validation
     */
    private async markProxyAsFailed(proxy: ProxyInfo) {
        try {
            await this.databaseService.sql`
                UPDATE proxies 
                SET is_working = false, 
                    fail_count = fail_count + 1,
                    last_checked = NOW()
                WHERE host = ${proxy.host} AND port = ${proxy.port}
            `;
        } catch {
            // Ignore - proxy might not exist in DB yet
        }
    }

    /**
     * Cleanup proxies that failed too many times
     */
    private async cleanupDeadProxies() {
        try {
            const deleted = await this.databaseService.sql`
                DELETE FROM proxies WHERE fail_count > 5 RETURNING id
            `;
            if (deleted.length > 0) {
                this.logger.log(`🗑️ Removed ${deleted.length} dead proxies from database`);
            }
        } catch (error) {
            this.logger.error('Failed to cleanup dead proxies:', error);
        }
    }

    /**
     * Get the fastest working proxy for use
     */
    async getRandomProxy(): Promise<string | null> {
        try {
            // Select fastest working proxy (lowest response time)
            const result = await this.databaseService.sql`
                SELECT protocol, host, port, response_time 
                FROM proxies 
                WHERE is_working = true 
                ORDER BY response_time ASC 
                LIMIT 1
            `;

            if (result.length === 0) {
                this.logger.debug('No working proxies available');
                return null;
            }

            const proxy = result[0];
            const proxyUrl = `${proxy.protocol}://${proxy.host}:${proxy.port}`;
            this.logger.debug(`🚀 Selected fastest proxy: ${proxyUrl} (${proxy.response_time}ms)`);
            return proxyUrl;
        } catch (error) {
            this.logger.error('Failed to get proxy:', error);
            return null;
        }
    }

    /**
     * Mark a proxy as failed (called when download fails with proxy)
     */
    async markProxyFailed(proxyUrl: string) {
        const parsed = this.parseProxyLine(proxyUrl);
        if (!parsed) return;

        try {
            await this.databaseService.sql`
                UPDATE proxies 
                SET fail_count = fail_count + 1,
                    is_working = CASE WHEN fail_count >= 2 THEN false ELSE is_working END
                WHERE host = ${parsed.host} AND port = ${parsed.port}
            `;
            this.logger.debug(`⚠️ Marked proxy as failed: ${proxyUrl}`);
        } catch (error) {
            this.logger.error('Failed to mark proxy as failed:', error);
        }
    }

    /**
     * Get count of working proxies
     */
    async getWorkingProxyCount(): Promise<number> {
        try {
            const result = await this.databaseService.sql`
                SELECT COUNT(*) as count FROM proxies WHERE is_working = true
            `;
            return parseInt(result[0]?.count || '0', 10);
        } catch (error) {
            return 0;
        }
    }
}
