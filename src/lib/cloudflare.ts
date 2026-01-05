/**
 * Cloudflare IP Detection Module
 * Checks if an IP address belongs to Cloudflare's network ranges
 */

// Cloudflare IPv4 ranges (from https://www.cloudflare.com/ips-v4)
const CLOUDFLARE_IPV4_RANGES = [
    '103.21.244.0/22',
    '103.22.200.0/22',
    '103.31.4.0/22',
    '104.16.0.0/13',
    '104.24.0.0/14',
    '108.162.192.0/18',
    '131.0.72.0/22',
    '141.101.64.0/18',
    '162.158.0.0/15',
    '172.64.0.0/13',
    '173.245.48.0/20',
    '188.114.96.0/20',
    '190.93.240.0/20',
    '197.234.240.0/22',
    '198.41.128.0/17',
];

// Cloudflare IPv6 ranges (from https://www.cloudflare.com/ips-v6)
const CLOUDFLARE_IPV6_RANGES = [
    '2400:cb00::/32',
    '2606:4700::/32',
    '2803:f800::/32',
    '2405:b500::/32',
    '2405:8100::/32',
    '2a06:98c0::/29',
    '2c0f:f248::/32',
];

/**
 * Convert IP address to numeric value for comparison
 */
function ipToNumber(ip: string): number {
    const parts = ip.split('.').map(Number);
    return (parts[0] << 24) + (parts[1] << 16) + (parts[2] << 8) + parts[3];
}

/**
 * Check if IPv4 address is in a CIDR range
 */
function isIpInCidr(ip: string, cidr: string): boolean {
    const [rangeIp, prefixLength] = cidr.split('/');
    const prefix = parseInt(prefixLength, 10);
    const mask = ~((1 << (32 - prefix)) - 1);

    const ipNum = ipToNumber(ip);
    const rangeNum = ipToNumber(rangeIp);

    return (ipNum & mask) === (rangeNum & mask);
}

/**
 * Check if an IP address belongs to Cloudflare's network
 * @param ip - IPv4 or IPv6 address
 * @returns true if the IP belongs to Cloudflare
 */
export function isCloudflare(ip: string | null): boolean {
    if (!ip) return false;

    // Check if IPv6
    if (ip.includes(':')) {
        // Simplified IPv6 check - just check prefix
        for (const range of CLOUDFLARE_IPV6_RANGES) {
            const prefix = range.split('/')[0];
            if (ip.startsWith(prefix.split(':').slice(0, 2).join(':'))) {
                return true;
            }
        }
        return false;
    }

    // IPv4 check
    for (const range of CLOUDFLARE_IPV4_RANGES) {
        if (isIpInCidr(ip, range)) {
            return true;
        }
    }

    return false;
}

export { CLOUDFLARE_IPV4_RANGES, CLOUDFLARE_IPV6_RANGES };
