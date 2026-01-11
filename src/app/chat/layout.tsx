import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Community Chat - Real-time Developer Chat',
    description: 'Join the DevTools community chat. Connect with developers, share knowledge, ask questions, and discuss programming topics in real-time.',
    keywords: [
        'developer chat',
        'community chat',
        'real-time chat',
        'programmer chat',
        'developer community',
        'coding discussion',
        'tech chat',
    ],
    openGraph: {
        title: 'Community Chat - Real-time Developer Chat',
        description: 'Connect with the DevTools developer community in real-time. Share, learn, and discuss.',
        type: 'website',
    },
};

export default function ChatLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return children;
}
