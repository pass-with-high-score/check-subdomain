/**
 * Certificate Transparency Logs Fetcher
 * Uses crt.sh to discover subdomains via CT logs
 */

interface CrtShEntry {
    name_value: string;
    common_name: string;
}

/**
 * Fetch subdomains from crt.sh Certificate Transparency logs
 * @param domain - Base domain to search for (e.g., "example.com")
 * @returns Array of unique subdomains
 */
export async function fetchSubdomainsFromCrtSh(domain: string): Promise<string[]> {
    const url = `https://crt.sh/?q=${encodeURIComponent(`%.${domain}`)}&output=json`;

    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'SubdomainScanner/1.0',
            },
            signal: AbortSignal.timeout(30000), // 30 second timeout
        });

        if (!response.ok) {
            console.error(`crt.sh returned status ${response.status}`);
            return [];
        }

        const data: CrtShEntry[] = await response.json();

        // Extract unique subdomains
        const subdomains = new Set<string>();

        for (const entry of data) {
            // name_value can contain multiple domains separated by newlines
            const names = entry.name_value.split('\n');
            for (const name of names) {
                const cleaned = name.trim().toLowerCase();
                // Filter out wildcards and ensure it ends with the domain
                if (
                    cleaned &&
                    !cleaned.startsWith('*') &&
                    cleaned.endsWith(domain.toLowerCase()) &&
                    isValidSubdomain(cleaned)
                ) {
                    subdomains.add(cleaned);
                }
            }
        }

        return Array.from(subdomains).sort();
    } catch (error) {
        console.error('Error fetching from crt.sh:', error);
        return [];
    }
}

/**
 * Validate subdomain format
 */
function isValidSubdomain(subdomain: string): boolean {
    // Basic validation: only allow alphanumeric, dots, and hyphens
    const pattern = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*$/;
    return pattern.test(subdomain);
}

/**
 * Common subdomain wordlist for brute-force discovery
 */
export const COMMON_SUBDOMAINS = [
    'www', 'api', 'dev', 'staging', 'test', 'admin', 'app', 'mail',
    'cdn', 'static', 'assets', 'img', 'images', 'media', 'video',
    'blog', 'shop', 'store', 'docs', 'help', 'support', 'status',
    'm', 'mobile', 'beta', 'alpha', 'demo', 'sandbox',
    'eu', 'us', 'ap', 'asia', 'uk', 'de', 'fr',
    'db', 'database', 'sql', 'mysql', 'postgres', 'redis', 'mongo',
    'ftp', 'sftp', 'ssh', 'vpn', 'proxy', 'gateway',
    'auth', 'login', 'sso', 'oauth', 'id', 'accounts',
    'ws', 'websocket', 'socket', 'realtime', 'live', 'stream',
    'internal', 'intranet', 'corp', 'office', 'portal',
];

/**
 * Generate subdomains using wordlist
 */
export function generateWordlistSubdomains(domain: string): string[] {
    return COMMON_SUBDOMAINS.map(prefix => `${prefix}.${domain}`);
}
