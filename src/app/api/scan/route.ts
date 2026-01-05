/**
 * Subdomain Scanner API Endpoint
 * POST /api/scan
 */

import { NextRequest, NextResponse } from 'next/server';
import { fetchSubdomainsFromCrtSh, generateWordlistSubdomains } from '@/lib/crtsh';
import { resolveSubdomains, DnsResult } from '@/lib/dns-resolver';
import { isCloudflare } from '@/lib/cloudflare';

export interface ScanResult {
    subdomain: string;
    ip: string | null;
    cloudflare: boolean;
}

export interface ScanResponse {
    scan_date: string;
    domain: string;
    stats: {
        total: number;
        cloudflare: number;
        no_ip: number;
    };
    subdomains: ScanResult[];
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { domain } = body;

        if (!domain || typeof domain !== 'string') {
            return NextResponse.json(
                { error: 'Domain is required' },
                { status: 400 }
            );
        }

        // Validate domain format
        const domainPattern = /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/;
        if (!domainPattern.test(domain)) {
            return NextResponse.json(
                { error: 'Invalid domain format' },
                { status: 400 }
            );
        }

        console.log(`[Scan] Starting scan for domain: ${domain}`);

        // Step 1: Fetch subdomains from Certificate Transparency logs
        console.log('[Scan] Fetching subdomains from CT logs...');
        const ctSubdomains = await fetchSubdomainsFromCrtSh(domain);
        console.log(`[Scan] Found ${ctSubdomains.length} subdomains from CT logs`);

        // Step 2: Generate wordlist subdomains
        const wordlistSubdomains = generateWordlistSubdomains(domain);

        // Step 3: Combine and deduplicate
        const allSubdomains = [...new Set([...ctSubdomains, ...wordlistSubdomains])].sort();
        console.log(`[Scan] Total unique subdomains to scan: ${allSubdomains.length}`);

        // Step 4: Resolve DNS for all subdomains
        console.log('[Scan] Resolving DNS records...');
        const dnsResults = await resolveSubdomains(allSubdomains, 50);

        // Step 5: Check Cloudflare and build results
        const results: ScanResult[] = dnsResults.map((result: DnsResult) => ({
            subdomain: result.subdomain,
            ip: result.ip,
            cloudflare: isCloudflare(result.ip),
        }));

        // Sort: subdomains with IP first, then alphabetically
        results.sort((a, b) => {
            if (a.ip && !b.ip) return -1;
            if (!a.ip && b.ip) return 1;
            return a.subdomain.localeCompare(b.subdomain);
        });

        // Calculate stats
        const stats = {
            total: results.length,
            cloudflare: results.filter(r => r.cloudflare).length,
            no_ip: results.filter(r => !r.ip).length,
        };

        // Build response
        const response: ScanResponse = {
            scan_date: new Date().toISOString().replace('T', ' ').split('.')[0],
            domain,
            stats,
            subdomains: results,
        };

        console.log(`[Scan] Scan complete. Total: ${stats.total}, Cloudflare: ${stats.cloudflare}, No IP: ${stats.no_ip}`);

        return NextResponse.json(response);
    } catch (error) {
        console.error('[Scan] Error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

// GET method for health check
export async function GET() {
    return NextResponse.json({ status: 'ok', service: 'subdomain-scanner' });
}
