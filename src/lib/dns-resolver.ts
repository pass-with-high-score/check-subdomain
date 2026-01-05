/**
 * DNS Resolver Module
 * Resolves A/AAAA records with concurrency control
 */

import dns from 'dns/promises';

export interface DnsResult {
    subdomain: string;
    ip: string | null;
    ipv6: string | null;
}

// Configure DNS resolver with timeout
dns.setDefaultResultOrder('ipv4first');

/**
 * Resolve DNS for a single subdomain
 */
async function resolveSingle(subdomain: string): Promise<DnsResult> {
    const result: DnsResult = {
        subdomain,
        ip: null,
        ipv6: null,
    };

    try {
        // Try to resolve A record (IPv4)
        const addresses = await dns.resolve4(subdomain);
        if (addresses.length > 0) {
            result.ip = addresses[0];
        }
    } catch {
        // NXDOMAIN or other error - ip stays null
    }

    try {
        // Try to resolve AAAA record (IPv6)
        const addresses = await dns.resolve6(subdomain);
        if (addresses.length > 0) {
            result.ipv6 = addresses[0];
        }
    } catch {
        // NXDOMAIN or other error - ipv6 stays null
    }

    return result;
}

/**
 * Resolve DNS for multiple subdomains with concurrency control
 * @param subdomains - Array of subdomains to resolve
 * @param concurrency - Maximum concurrent DNS lookups (default: 50)
 * @param onProgress - Optional callback for progress updates
 */
export async function resolveSubdomains(
    subdomains: string[],
    concurrency: number = 50,
    onProgress?: (completed: number, total: number) => void
): Promise<DnsResult[]> {
    const results: DnsResult[] = [];
    let completed = 0;
    const total = subdomains.length;

    // Process in chunks for concurrency control
    for (let i = 0; i < subdomains.length; i += concurrency) {
        const chunk = subdomains.slice(i, i + concurrency);

        const chunkResults = await Promise.all(
            chunk.map(async (subdomain) => {
                try {
                    // Add timeout for each lookup
                    const result = await Promise.race([
                        resolveSingle(subdomain),
                        new Promise<DnsResult>((_, reject) =>
                            setTimeout(() => reject(new Error('DNS timeout')), 3000)
                        ),
                    ]);
                    return result;
                } catch {
                    return { subdomain, ip: null, ipv6: null };
                } finally {
                    completed++;
                    if (onProgress) {
                        onProgress(completed, total);
                    }
                }
            })
        );

        results.push(...chunkResults);
    }

    return results;
}
