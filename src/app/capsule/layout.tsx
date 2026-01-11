import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Time Capsule - Send Messages to the Future',
    description: 'Create digital time capsules with encrypted messages. Schedule messages to be revealed at a future date. Perfect for future letters, reminders, and surprise messages.',
    keywords: [
        'time capsule',
        'future message',
        'scheduled message',
        'encrypted message',
        'future letter',
        'digital capsule',
        'delayed delivery',
        'secret message',
    ],
    openGraph: {
        title: 'Time Capsule - Send Messages to the Future',
        description: 'Create encrypted time capsules that unlock at a future date. Free online digital time capsule.',
        type: 'website',
    },
};

export default function CapsuleLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return children;
}
