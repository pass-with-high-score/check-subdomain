import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'File Transfer - Fast & Secure File Sharing',
    description: 'Transfer files quickly and securely between devices. Share large files with auto-expiring links. No account required. Free file transfer service.',
    keywords: [
        'file transfer',
        'file sharing',
        'send files',
        'share files',
        'file upload',
        'secure transfer',
        'large file transfer',
        'fast file sharing',
    ],
    openGraph: {
        title: 'File Transfer - Fast & Secure File Sharing',
        description: 'Share files securely with auto-expiring links. No account required. Free file transfer.',
        type: 'website',
    },
};

export default function TransferLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return children;
}
