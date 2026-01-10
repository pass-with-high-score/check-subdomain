'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import Navigation from '@/components/Navigation';
import Toast, { useToast } from '@/components/Toast';
import { MicrophoneIcon, GlobeIcon, TextIcon, PlayCircleIcon, CopyIcon, TimerIcon, TrashIcon } from '@/components/Icons';
import styles from './page.module.css';

const API_BASE = process.env.NEXT_PUBLIC_CHAT_URL || 'http://localhost:3010';

interface WordTiming {
    word: string;
    start: number;
    end: number;
}

interface Paragraph {
    text: string;
    start: number;
    end: number;
}

interface Transcription {
    id: string;
    filename: string;
    file_size: number;
    duration_seconds: number | null;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    transcript: string | null;
    words: WordTiming[] | null;
    paragraphs: Paragraph[] | null;
    language: string | null;
}

interface HistoryItem {
    id: string;
    filename: string;
    language: string;
    timestamp: number;
}

// Supported languages from Deepgram
const LANGUAGES = [
    { code: 'auto', name: 'Auto Detect' },
    { code: 'vi', name: 'Tiếng Việt' },
    { code: 'en', name: 'English' },
    { code: 'zh', name: '中文 (Chinese)' },
    { code: 'ja', name: '日本語 (Japanese)' },
    { code: 'ko', name: '한국어 (Korean)' },
    { code: 'fr', name: 'Français' },
    { code: 'de', name: 'Deutsch' },
    { code: 'es', name: 'Español' },
    { code: 'pt', name: 'Português' },
    { code: 'ru', name: 'Русский' },
    { code: 'th', name: 'ภาษาไทย' },
    { code: 'id', name: 'Bahasa Indonesia' },
    { code: 'ms', name: 'Bahasa Melayu' },
    { code: 'it', name: 'Italiano' },
    { code: 'nl', name: 'Nederlands' },
    { code: 'pl', name: 'Polski' },
    { code: 'tr', name: 'Türkçe' },
    { code: 'hi', name: 'हिन्दी (Hindi)' },
];

export default function SpeechPage() {
    const [isRecording, setIsRecording] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [isTranscribing, setIsTranscribing] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [transcription, setTranscription] = useState<Transcription | null>(null);
    const [dragActive, setDragActive] = useState(false);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentWordIndex, setCurrentWordIndex] = useState(-1);
    const [currentTime, setCurrentTime] = useState(0);
    const [selectedLanguage, setSelectedLanguage] = useState('auto');
    const { toasts, addToast, removeToast } = useToast();

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const transcriptContainerRef = useRef<HTMLDivElement>(null);
    const [currentParagraphIndex, setCurrentParagraphIndex] = useState(-1);
    const [history, setHistory] = useState<HistoryItem[]>([]);

    // Load history from localStorage
    useEffect(() => {
        const saved = localStorage.getItem('speech-history');
        if (saved) {
            try {
                setHistory(JSON.parse(saved));
            } catch {
                // ignore parse error
            }
        }
    }, []);

    // Sync word highlighting with audio playback
    const handleTimeUpdate = useCallback(() => {
        if (!audioRef.current) return;

        const time = audioRef.current.currentTime;
        setCurrentTime(time);

        // Find current word based on time
        if (transcription?.words) {
            const index = transcription.words.findIndex(
                (w, i) => time >= w.start && (i === transcription.words!.length - 1 || time < transcription.words![i + 1].start)
            );
            setCurrentWordIndex(index);
        }

        // Find current paragraph based on time
        if (transcription?.paragraphs) {
            const pIndex = transcription.paragraphs.findIndex(
                (p) => time >= p.start && time <= p.end
            );
            if (pIndex !== currentParagraphIndex) {
                setCurrentParagraphIndex(pIndex);
            }
        }
    }, [transcription?.words, transcription?.paragraphs, currentParagraphIndex]);

    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;

        audio.addEventListener('timeupdate', handleTimeUpdate);
        audio.addEventListener('play', () => setIsPlaying(true));
        audio.addEventListener('pause', () => setIsPlaying(false));
        audio.addEventListener('ended', () => {
            setIsPlaying(false);
            setCurrentWordIndex(-1);
        });

        return () => {
            audio.removeEventListener('timeupdate', handleTimeUpdate);
        };
    }, [handleTimeUpdate]);

    // Auto scroll to current paragraph
    useEffect(() => {
        if (currentParagraphIndex >= 0 && transcriptContainerRef.current && isPlaying) {
            const paragraphElements = transcriptContainerRef.current.querySelectorAll('[data-paragraph]');
            const currentParagraph = paragraphElements[currentParagraphIndex] as HTMLElement;
            if (currentParagraph) {
                currentParagraph.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }
    }, [currentParagraphIndex, isPlaying]);

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });

            audioChunksRef.current = [];

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunksRef.current.push(event.data);
                }
            };

            mediaRecorder.onstop = async () => {
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                stream.getTracks().forEach(track => track.stop());
                await uploadAndTranscribe(audioBlob, 'recording.webm');
            };

            mediaRecorderRef.current = mediaRecorder;
            mediaRecorder.start();
            setIsRecording(true);
        } catch {
            addToast('Microphone access denied', 'error');
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
        }
    };

    const handleFileSelect = (files: FileList | null) => {
        if (!files || files.length === 0) return;
        const file = files[0];

        if (!file.type.startsWith('audio/') && !file.name.match(/\.(mp3|wav|ogg|webm|m4a|flac)$/i)) {
            addToast('Please select an audio file', 'error');
            return;
        }

        uploadAndTranscribe(file, file.name);
    };

    const uploadAndTranscribe = async (file: Blob, filename: string) => {
        setIsUploading(true);
        setUploadProgress(0);
        setTranscription(null);
        setCurrentWordIndex(-1);

        // Simulate upload progress
        const progressInterval = setInterval(() => {
            setUploadProgress(prev => Math.min(prev + 8, 45));
        }, 150);

        try {
            const formData = new FormData();
            formData.append('file', file, filename);

            const uploadRes = await fetch(`${API_BASE}/speech/upload`, {
                method: 'POST',
                body: formData,
            });

            if (!uploadRes.ok) throw new Error('Upload failed');

            clearInterval(progressInterval);
            setUploadProgress(50);

            const uploadData = await uploadRes.json();
            setTranscription(uploadData);
            setIsUploading(false);
            setIsTranscribing(true);

            // Simulate transcription progress
            const transcribeInterval = setInterval(() => {
                setUploadProgress(prev => Math.min(prev + 5, 95));
            }, 300);

            const transcribeRes = await fetch(`${API_BASE}/speech/${uploadData.id}/transcribe?language=${selectedLanguage}`, {
                method: 'POST',
            });

            clearInterval(transcribeInterval);

            if (!transcribeRes.ok) throw new Error('Transcription failed');

            setUploadProgress(100);

            const transcribeData = await transcribeRes.json();
            setTranscription(transcribeData);
            addToast('Transcription complete!', 'success');

            // Save to history
            const newHistoryItem: HistoryItem = {
                id: transcribeData.id,
                filename: transcribeData.filename,
                language: transcribeData.language || selectedLanguage,
                timestamp: Date.now(),
            };
            const updatedHistory = [newHistoryItem, ...history.filter(h => h.id !== transcribeData.id)].slice(0, 10);
            setHistory(updatedHistory);
            localStorage.setItem('speech-history', JSON.stringify(updatedHistory));
        } catch (err) {
            addToast(err instanceof Error ? err.message : 'An error occurred', 'error');
            setTranscription(prev => prev ? { ...prev, status: 'failed' } : null);
        } finally {
            setIsUploading(false);
            setIsTranscribing(false);
        }
    };

    // Load transcription from history
    const loadFromHistory = async (id: string) => {
        try {
            const res = await fetch(`${API_BASE}/speech/${id}`);
            if (!res.ok) {
                addToast('Transcription expired or not found', 'error');
                // Remove from history
                const updatedHistory = history.filter(h => h.id !== id);
                setHistory(updatedHistory);
                localStorage.setItem('speech-history', JSON.stringify(updatedHistory));
                return;
            }
            const data = await res.json();
            setTranscription(data);
            addToast('Loaded from history!', 'success');
        } catch {
            addToast('Failed to load transcription', 'error');
        }
    };

    const togglePlayback = () => {
        if (!audioRef.current) return;
        if (isPlaying) {
            audioRef.current.pause();
        } else {
            audioRef.current.play();
        }
    };

    const seekToWord = (index: number) => {
        if (!audioRef.current || !transcription?.words) return;
        const word = transcription.words[index];
        if (!word) return; // Guard against -1 index
        audioRef.current.currentTime = word.start;
        audioRef.current.play();
    };

    const seekToTime = (time: number) => {
        if (!audioRef.current) return;
        audioRef.current.currentTime = time;
        audioRef.current.play();
    };

    // Seek without auto-play (for seek bar slider)
    const handleSeek = (time: number) => {
        if (!audioRef.current) return;
        audioRef.current.currentTime = time;
        setCurrentTime(time);
    };

    const copyToClipboard = () => {
        if (transcription?.transcript) {
            navigator.clipboard.writeText(transcription.transcript);
            addToast('Copied to clipboard!', 'success');
        }
    };

    const downloadTranscript = () => {
        if (transcription?.transcript) {
            const blob = new Blob([transcription.transcript], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            const baseName = transcription.filename.replace(/\.[^/.]+$/, '');
            a.download = `${baseName}.txt`;
            a.click();
            URL.revokeObjectURL(url);
        }
    };

    const formatFileSize = (bytes: number) => {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    };

    const formatDuration = (seconds: number | null) => {
        if (!seconds) return '--:--';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <div className={styles.container}>
            <div className={styles.backgroundGradient}></div>
            <Navigation />

            <main className={styles.main}>
                <div className={styles.header}>
                    <h1 className={styles.title}>Speech to Text</h1>
                    <p className={styles.subtitle}>Record or upload audio to transcribe</p>
                </div>

                {/* Recording / Upload Section */}
                <div className={styles.inputSection}>
                    {/* Language Select */}
                    <div className={styles.languageSelect}>
                        <label>Language:</label>
                        <select
                            value={selectedLanguage}
                            onChange={(e) => setSelectedLanguage(e.target.value)}
                            disabled={isUploading || isTranscribing || isRecording}
                        >
                            {LANGUAGES.map((lang) => (
                                <option key={lang.code} value={lang.code}>
                                    {lang.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    <button
                        className={`${styles.recordButton} ${isRecording ? styles.recording : ''}`}
                        onClick={isRecording ? stopRecording : startRecording}
                        disabled={isUploading || isTranscribing}
                    >
                        <div className={styles.recordIcon}>
                            {isRecording ? (
                                <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
                                    <rect x="6" y="6" width="12" height="12" rx="2" />
                                </svg>
                            ) : (
                                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                                    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                                    <line x1="12" y1="19" x2="12" y2="23" />
                                    <line x1="8" y1="23" x2="16" y2="23" />
                                </svg>
                            )}
                        </div>
                        {isRecording ? 'Stop Recording' : 'Record Audio'}
                    </button>

                    <div className={styles.orDivider}>OR</div>

                    <div
                        className={`${styles.dropzone} ${dragActive ? styles.dragActive : ''}`}
                        onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
                        onDragLeave={() => setDragActive(false)}
                        onDrop={(e) => { e.preventDefault(); setDragActive(false); handleFileSelect(e.dataTransfer.files); }}
                        onClick={() => fileInputRef.current?.click()}
                    >
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="audio/*,.mp3,.wav,.ogg,.webm,.m4a,.flac"
                            onChange={(e) => handleFileSelect(e.target.files)}
                            hidden
                        />
                        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                            <polyline points="17 8 12 3 7 8" />
                            <line x1="12" y1="3" x2="12" y2="15" />
                        </svg>
                        <p>Drag & drop audio file or click to browse</p>
                        <span className={styles.supportedFormats}>MP3, WAV, OGG, WebM, M4A, FLAC</span>
                    </div>
                </div>

                {/* Status / Result */}
                {(isUploading || isTranscribing || transcription) && (
                    <div className={styles.resultSection}>
                        {transcription && (
                            <div className={styles.fileInfo}>
                                <span className={styles.filename}>{transcription.filename}</span>
                                <span className={styles.fileMeta}>
                                    {formatFileSize(transcription.file_size)} • {formatDuration(transcription.duration_seconds)}
                                </span>
                            </div>
                        )}

                        <div className={`${styles.status} ${styles[transcription?.status || 'processing']}`}>
                            {isUploading && (
                                <>
                                    <div className={styles.spinner}></div>
                                    Uploading... {uploadProgress}%
                                </>
                            )}
                            {isTranscribing && (
                                <>
                                    <div className={styles.spinner}></div>
                                    Transcribing... {uploadProgress}%
                                </>
                            )}
                            {transcription?.status === 'completed' && '✓ Complete'}
                            {transcription?.status === 'failed' && '✗ Failed'}
                        </div>

                        {/* Progress Bar */}
                        {(isUploading || isTranscribing) && (
                            <div className={styles.progressContainer}>
                                <div
                                    className={styles.progressBar}
                                    style={{ width: `${uploadProgress}%` }}
                                />
                            </div>
                        )}

                        {/* Audio Player with Synced Text */}
                        {transcription?.status === 'completed' && transcription.words && (
                            <>
                                {/* Hidden audio element */}
                                <audio
                                    ref={audioRef}
                                    src={`${API_BASE}/speech/${transcription.id}/audio`}
                                    preload="auto"
                                />

                                <div className={styles.transcriptCard}>
                                    <div className={styles.transcriptHeader}>
                                        <div className={styles.playerControls}>
                                            <button onClick={togglePlayback} className={styles.playBtn}>
                                                {isPlaying ? (
                                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                                                        <rect x="6" y="4" width="4" height="16" rx="1" />
                                                        <rect x="14" y="4" width="4" height="16" rx="1" />
                                                    </svg>
                                                ) : (
                                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                                                        <path d="M8 5v14l11-7z" />
                                                    </svg>
                                                )}
                                            </button>
                                            <div className={styles.seekBarContainer}>
                                                <input
                                                    type="range"
                                                    min="0"
                                                    max={transcription.duration_seconds || 100}
                                                    step="0.1"
                                                    value={currentTime}
                                                    onChange={(e) => handleSeek(parseFloat(e.target.value))}
                                                    className={styles.seekBar}
                                                />
                                                <div
                                                    className={styles.seekBarProgress}
                                                    style={{ width: `${(currentTime / (transcription.duration_seconds || 1)) * 100}%` }}
                                                />
                                            </div>
                                            <span className={styles.timeDisplay}>
                                                {formatDuration(currentTime)} / {formatDuration(transcription.duration_seconds)}
                                            </span>
                                        </div>
                                        {transcription.language && (
                                            <span className={styles.language}>{transcription.language.toUpperCase()}</span>
                                        )}
                                    </div>

                                    <div className={styles.transcriptContent} ref={transcriptContainerRef}>
                                        {transcription.paragraphs && transcription.paragraphs.length > 0 && transcription.words ? (
                                            // Display paragraphs with individual words for clicking
                                            transcription.paragraphs.map((para, pIndex) => {
                                                // Find words that belong to this paragraph (use overlap detection)
                                                const paragraphWords = transcription.words!.filter(
                                                    w => w.start >= para.start && w.start < para.end
                                                );

                                                return (
                                                    <div
                                                        key={pIndex}
                                                        data-paragraph={pIndex}
                                                        className={`${styles.paragraph} ${pIndex === currentParagraphIndex ? styles.activeParagraph : ''} ${currentTime > para.end ? styles.spokenParagraph : ''}`}
                                                    >
                                                        {paragraphWords.map((word, wIndex) => {
                                                            const globalWordIndex = transcription.words!.findIndex(
                                                                w => w.start === word.start && w.word === word.word
                                                            );
                                                            return (
                                                                <span
                                                                    key={wIndex}
                                                                    className={`${styles.word} ${globalWordIndex === currentWordIndex ? styles.activeWord : ''} ${globalWordIndex < currentWordIndex && globalWordIndex >= 0 ? styles.spokenWord : ''}`}
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        seekToTime(word.start);
                                                                    }}
                                                                >
                                                                    {word.word}{' '}
                                                                </span>
                                                            );
                                                        })}
                                                    </div>
                                                );
                                            })
                                        ) : transcription.words ? (
                                            // Fallback to words only if no paragraphs
                                            transcription.words.map((word, index) => (
                                                <span
                                                    key={index}
                                                    className={`${styles.word} ${index === currentWordIndex ? styles.activeWord : ''} ${index < currentWordIndex ? styles.spokenWord : ''}`}
                                                    onClick={() => seekToWord(index)}
                                                >
                                                    {word.word}{' '}
                                                </span>
                                            ))
                                        ) : (
                                            // No words data - just show transcript text
                                            <p>{transcription.transcript}</p>
                                        )}
                                    </div>

                                    <div className={styles.transcriptActions}>
                                        <button onClick={copyToClipboard} className={styles.actionBtn}>
                                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                                            </svg>
                                            Copy
                                        </button>
                                        <button onClick={downloadTranscript} className={styles.actionBtn}>
                                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                                <polyline points="7 10 12 15 17 10" />
                                                <line x1="12" y1="15" x2="12" y2="3" />
                                            </svg>
                                            Download
                                        </button>
                                    </div>
                                </div>
                            </>
                        )}

                        {/* Fallback for no words */}
                        {transcription?.status === 'completed' && transcription.transcript && !transcription.words && (
                            <div className={styles.transcriptCard}>
                                <div className={styles.transcriptHeader}>
                                    <span>Transcript</span>
                                    {transcription.language && (
                                        <span className={styles.language}>{transcription.language.toUpperCase()}</span>
                                    )}
                                </div>
                                <div className={styles.transcriptContent}>
                                    {transcription.transcript}
                                </div>
                                <div className={styles.transcriptActions}>
                                    <button onClick={copyToClipboard} className={styles.actionBtn}>
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                                        </svg>
                                        Copy
                                    </button>
                                    <button onClick={downloadTranscript} className={styles.actionBtn}>
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                            <polyline points="7 10 12 15 17 10" />
                                            <line x1="12" y1="15" x2="12" y2="3" />
                                        </svg>
                                        Download
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </main>

            {/* Footer with Features and Powered by */}
            <footer className={styles.footer}>
                {/* History Section */}
                {history.length > 0 && (
                    <div className={styles.historySection}>
                        <h3 className={styles.footerTitle}>Recent Transcriptions</h3>
                        <div className={styles.historyList}>
                            {history.slice(0, 5).map((item) => (
                                <div key={item.id} className={styles.historyItem}>
                                    <button
                                        className={styles.historyContent}
                                        onClick={() => loadFromHistory(item.id)}
                                    >
                                        <span className={styles.historyFilename}>{item.filename}</span>
                                        <span className={styles.historyMeta}>
                                            {item.language.toUpperCase()} • {new Date(item.timestamp).toLocaleDateString()}
                                        </span>
                                    </button>
                                    <button
                                        className={styles.historyDeleteBtn}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            const updated = history.filter(h => h.id !== item.id);
                                            setHistory(updated);
                                            localStorage.setItem('speech-history', JSON.stringify(updated));
                                            addToast('Removed from history', 'success');
                                        }}
                                        title="Remove from history"
                                    >
                                        <TrashIcon size={14} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Features Section */}
                <div className={styles.features}>
                    <div className={styles.feature}>
                        <div className={styles.featureIcon}>
                            <MicrophoneIcon size={24} />
                        </div>
                        <h3>Record & Upload</h3>
                        <p>Record audio directly or upload MP3, WAV, M4A files</p>
                    </div>
                    <div className={styles.feature}>
                        <div className={styles.featureIcon}>
                            <GlobeIcon size={24} />
                        </div>
                        <h3>19+ Languages</h3>
                        <p>Auto-detect or select from Vietnamese, English, Chinese, Japanese...</p>
                    </div>
                    <div className={styles.feature}>
                        <div className={styles.featureIcon}>
                            <TextIcon size={24} />
                        </div>
                        <h3>Word Timestamps</h3>
                        <p>Word-level timing with paragraph segmentation</p>
                    </div>
                    <div className={styles.feature}>
                        <div className={styles.featureIcon}>
                            <PlayCircleIcon size={24} />
                        </div>
                        <h3>Synced Playback</h3>
                        <p>Click any word to seek, auto-scroll while playing</p>
                    </div>
                    <div className={styles.feature}>
                        <div className={styles.featureIcon}>
                            <CopyIcon size={24} />
                        </div>
                        <h3>Export Options</h3>
                        <p>Copy to clipboard or download as text file</p>
                    </div>
                    <div className={styles.feature}>
                        <div className={styles.featureIcon}>
                            <TimerIcon size={24} />
                        </div>
                        <h3>Auto Cleanup</h3>
                        <p>Files auto-delete after 1 hour for privacy</p>
                    </div>
                </div>

                {/* Powered by Deepgram */}
                <div className={styles.poweredBy}>
                    <span>Powered by</span>
                    <a href="https://deepgram.com" target="_blank" rel="noopener noreferrer" className={styles.deepgramLink}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                        </svg>
                        Deepgram
                    </a>
                </div>
            </footer>

            <Toast toasts={toasts} removeToast={removeToast} />
        </div>
    );
}
