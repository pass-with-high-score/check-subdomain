import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'About - DevTools',
    description: 'Learn about DevTools - a collection of free online developer tools. Our mission is to provide useful, privacy-focused tools for developers.',
    keywords: [
        'about devtools',
        'developer tools',
        'free tools',
        'privacy focused',
        'online tools',
    ],
    openGraph: {
        title: 'About - DevTools',
        description: 'Learn about DevTools - free online developer tools built with privacy in mind.',
        type: 'website',
    },
};

export default function AboutLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return children;
}
