import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'YouTube Downloader - Download Videos & Audio',
    description: 'Download YouTube videos and audio in various qualities and formats. Support for playlists, chapters, and clip extraction. Free online YouTube downloader.',
    keywords: [
        'YouTube downloader',
        'YouTube to MP3',
        'YouTube to MP4',
        'download YouTube video',
        'YouTube audio',
        'video downloader',
        'YouTube playlist downloader',
        'YouTube clip download',
    ],
    openGraph: {
        title: 'YouTube Downloader - Download Videos & Audio',
        description: 'Download YouTube videos and audio in various formats. Support for playlists and clips.',
        type: 'website',
    },
};

export default function YouTubeLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return children;
}
