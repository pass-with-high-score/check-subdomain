import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'ANeko Builder - Custom Android Cat Skin Creator',
    description: 'Create custom ANeko skins for Android. Design and build your own cat pet character with custom images, animations, and behaviors. Free online ANeko skin builder.',
    keywords: [
        'ANeko builder',
        'ANeko skin creator',
        'Android cat pet',
        'custom ANeko',
        'cat skin creator',
        'desktop pet',
        'android widget',
        'neko cat',
    ],
    openGraph: {
        title: 'ANeko Builder - Custom Android Cat Skin Creator',
        description: 'Create custom ANeko skins for your Android desktop cat pet. Free online builder.',
        type: 'website',
    },
};

export default function ANekoBuilderLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return children;
}
