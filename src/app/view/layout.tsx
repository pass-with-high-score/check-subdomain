import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'View Image - Image Viewer',
    description: 'View and download shared images. High-quality image viewer with zoom and download support.',
    keywords: [
        'image viewer',
        'view image',
        'image gallery',
        'photo viewer',
        'download image',
    ],
    openGraph: {
        title: 'View Image - Image Viewer',
        description: 'View and download shared images with high-quality image viewer.',
        type: 'website',
    },
};

export default function ViewLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return children;
}
