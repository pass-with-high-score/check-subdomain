import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Base64 Image - View & Encode Images',
    description: 'View Base64 encoded images or convert images to Base64 strings. Supports drag & drop, copy to clipboard, and download. Free online Base64 image tool.',
    keywords: [
        'base64 image',
        'base64 viewer',
        'base64 encoder',
        'base64 decoder',
        'image to base64',
        'base64 to image',
        'data URI',
        'image converter',
    ],
    openGraph: {
        title: 'Base64 Image - View & Encode Images',
        description: 'Free online tool to view Base64 images or convert images to Base64 strings with drag & drop support.',
        type: 'website',
    },
};

export default function Base64Layout({
    children,
}: {
    children: React.ReactNode;
}) {
    return children;
}
