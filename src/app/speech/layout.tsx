import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Speech to Text - Audio Transcription Tool',
    description: 'Convert speech to text with high accuracy. Upload audio files or record directly. Support for multiple languages and formats. Free online transcription tool.',
    keywords: [
        'speech to text',
        'audio transcription',
        'voice to text',
        'transcribe audio',
        'speech recognition',
        'audio to text',
        'voice transcription',
        'whisper AI',
    ],
    openGraph: {
        title: 'Speech to Text - Audio Transcription Tool',
        description: 'Free online tool to convert speech to text. Transcribe audio files with high accuracy.',
        type: 'website',
    },
};

export default function SpeechLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return children;
}
