import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'IP Lookup - Check Your IP Address & Location',
    description: 'Check your public IP address and location. Get detailed information including ISP, country, city, timezone, and more. Free IP lookup tool.',
    keywords: [
        'IP lookup',
        'what is my IP',
        'IP address',
        'IP location',
        'IP geolocation',
        'public IP',
        'ISP lookup',
        'IP checker',
    ],
    openGraph: {
        title: 'IP Lookup - Check Your IP Address & Location',
        description: 'Free tool to check your public IP address and get location details including ISP and geolocation.',
        type: 'website',
    },
};

export default function IPLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return children;
}
