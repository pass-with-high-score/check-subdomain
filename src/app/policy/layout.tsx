import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Privacy Policy - DevTools',
    description: 'Read our privacy policy. Learn how DevTools handles your data with a focus on privacy and transparency. No tracking, no data selling.',
    keywords: [
        'privacy policy',
        'terms of service',
        'data privacy',
        'user privacy',
        'GDPR',
        'data protection',
    ],
    openGraph: {
        title: 'Privacy Policy - DevTools',
        description: 'DevTools privacy policy - how we handle your data with privacy-first approach.',
        type: 'website',
    },
};

export default function PolicyLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return children;
}
