import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Subdomain Scanner - Discover Subdomains & Detect Cloudflare',
    description: 'Discover subdomains using Certificate Transparency logs, VirusTotal, Shodan, and Subfinder. Resolve DNS records and detect Cloudflare protection. Free online subdomain enumeration tool.',
    keywords: [
        'subdomain scanner',
        'subdomain finder',
        'subdomain enumeration',
        'certificate transparency',
        'cloudflare detector',
        'DNS lookup',
        'security tool',
        'crt.sh',
        'virustotal',
        'shodan',
    ],
    openGraph: {
        title: 'Subdomain Scanner - Discover Subdomains & Detect Cloudflare',
        description: 'Free online tool to discover subdomains using CT logs, VirusTotal, Shodan. Detect Cloudflare protection and resolve DNS records.',
        type: 'website',
    },
};

export default function SubdomainLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return children;
}
