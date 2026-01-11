import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Image Uploader - Free Image Hosting',
    description: 'Upload and share images instantly. Get direct links for embedding. Support for multiple formats including PNG, JPG, GIF, WebP. Free image hosting service.',
    keywords: [
        'image uploader',
        'image hosting',
        'upload image',
        'share image',
        'image link',
        'free image hosting',
        'imgur alternative',
        'photo hosting',
    ],
    openGraph: {
        title: 'Image Uploader - Free Image Hosting',
        description: 'Upload and share images instantly. Get direct links for embedding. Free image hosting.',
        type: 'website',
    },
};

export default function UploadLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return children;
}
