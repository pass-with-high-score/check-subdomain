'use client';

import { useState } from 'react';
import Navigation from '@/components/Navigation';
import Toast, { useToast } from '@/components/Toast';
import { PlayIcon, MusicIcon, DownloadIcon, SearchIcon, ClockIcon } from '@/components/Icons';
import styles from './page.module.css';

const API_BASE = process.env.NEXT_PUBLIC_CHAT_URL || 'http://localhost:3001';

interface FormatOption {
    quality: string;
    size: number | null;
    itag: number;
}

interface VideoInfo {
    videoId: string;
    title: string;
    thumbnail: string;
    duration: number;
    author: string;
    videoFormats: FormatOption[];
    audioFormats: FormatOption[];
}

interface DownloadResult {
    id: string;
    videoId: string;
    title: string;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    progress?: number;
    downloadUrl?: string;
    fileSize?: number;
    filename?: string;
    error?: string;
}

export default function YouTubePage() {
    const [url, setUrl] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null);
    const [formatType, setFormatType] = useState<'video' | 'audio'>('video');
    const [selectedQuality, setSelectedQuality] = useState<string>('');
    const [isDownloading, setIsDownloading] = useState(false);
    const [downloadResult, setDownloadResult] = useState<DownloadResult | null>(null);
    const { toasts, addToast, removeToast } = useToast();

    const formatDuration = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const formatSize = (bytes: number | null) => {
        if (!bytes) return 'Unknown';
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    const handleSearch = async () => {
        if (!url.trim()) {
            addToast('Please enter a YouTube URL', 'error');
            return;
        }

        setIsLoading(true);
        setVideoInfo(null);
        setDownloadResult(null);

        try {
            const res = await fetch(`${API_BASE}/youtube/info?url=${encodeURIComponent(url)}`);
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.message || 'Failed to fetch video info');
            }
            const data = await res.json();
            setVideoInfo(data);
            // Auto-select first quality
            if (data.videoFormats.length > 0) {
                setSelectedQuality(data.videoFormats[0].quality);
            }
        } catch (error) {
            addToast(error instanceof Error ? error.message : 'Failed to fetch video info', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const handleDownload = async () => {
        if (!videoInfo || !selectedQuality) return;

        setIsDownloading(true);
        setDownloadResult(null);

        try {
            const res = await fetch(`${API_BASE}/youtube/download`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    url,
                    formatType,
                    quality: selectedQuality,
                }),
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.message || 'Download failed');
            }

            const data = await res.json();
            setDownloadResult(data);

            // Poll for completion
            pollDownloadStatus(data.id);
        } catch (error) {
            addToast(error instanceof Error ? error.message : 'Download failed', 'error');
            setIsDownloading(false);
        }
    };

    const pollDownloadStatus = async (id: string) => {
        const maxAttempts = 60; // 5 minutes
        let attempts = 0;

        const poll = async () => {
            try {
                const res = await fetch(`${API_BASE}/youtube/${id}`);
                const data = await res.json();
                setDownloadResult(data);

                if (data.status === 'completed') {
                    setIsDownloading(false);
                    addToast('Download ready!', 'success');
                } else if (data.status === 'failed') {
                    setIsDownloading(false);
                    addToast(data.error || 'Download failed', 'error');
                } else if (attempts < maxAttempts) {
                    attempts++;
                    setTimeout(poll, 1000); // Poll every 1 second for smoother progress
                } else {
                    setIsDownloading(false);
                    addToast('Download timed out', 'error');
                }
            } catch {
                setIsDownloading(false);
                addToast('Failed to check download status', 'error');
            }
        };

        setTimeout(poll, 3000);
    };

    const handleFileDownload = () => {
        if (downloadResult?.downloadUrl) {
            window.open(`${API_BASE}${downloadResult.downloadUrl}`, '_blank');
        }
    };

    const resetAll = () => {
        setUrl('');
        setVideoInfo(null);
        setDownloadResult(null);
        setSelectedQuality('');
        setFormatType('video');
    };

    const currentFormats = formatType === 'video' ? videoInfo?.videoFormats : videoInfo?.audioFormats;

    return (
        <div className={styles.container}>
            <div className={styles.backgroundGradient}></div>
            <Navigation />
            <Toast toasts={toasts} removeToast={removeToast} />

            <main className={styles.main}>
                <div className={styles.header}>
                    <h1 className={styles.title}>YouTube Downloader</h1>
                    <p className={styles.subtitle}>Download videos and audio from YouTube</p>
                </div>

                {/* URL Input */}
                <div className={styles.inputSection}>
                    <div className={styles.searchBox}>
                        <input
                            type="text"
                            value={url}
                            onChange={(e) => setUrl(e.target.value)}
                            placeholder="Paste YouTube URL here..."
                            className={styles.urlInput}
                            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                            disabled={isLoading}
                        />
                        <button
                            className={styles.searchBtn}
                            onClick={handleSearch}
                            disabled={isLoading || !url.trim()}
                        >
                            {isLoading ? (
                                <div className={styles.spinner}></div>
                            ) : (
                                <>
                                    <SearchIcon size={20} />
                                    Search
                                </>
                            )}
                        </button>
                    </div>
                </div>

                {/* Video Info Card */}
                {videoInfo && (
                    <div className={styles.videoCard}>
                        <div className={styles.videoThumbnail}>
                            <img src={videoInfo.thumbnail} alt={videoInfo.title} />
                            <span className={styles.duration}>
                                <ClockIcon size={14} />
                                {formatDuration(videoInfo.duration)}
                            </span>
                        </div>
                        <div className={styles.videoDetails}>
                            <h2 className={styles.videoTitle}>{videoInfo.title}</h2>
                            <p className={styles.videoAuthor}>{videoInfo.author}</p>

                            {/* Format Type Tabs */}
                            <div className={styles.formatTabs}>
                                <button
                                    className={`${styles.formatTab} ${formatType === 'video' ? styles.active : ''}`}
                                    onClick={() => {
                                        setFormatType('video');
                                        if (videoInfo.videoFormats.length > 0) {
                                            setSelectedQuality(videoInfo.videoFormats[0].quality);
                                        }
                                    }}
                                >
                                    <PlayIcon size={18} />
                                    Video (MP4)
                                </button>
                                <button
                                    className={`${styles.formatTab} ${formatType === 'audio' ? styles.active : ''}`}
                                    onClick={() => {
                                        setFormatType('audio');
                                        if (videoInfo.audioFormats.length > 0) {
                                            setSelectedQuality(videoInfo.audioFormats[0].quality);
                                        }
                                    }}
                                >
                                    <MusicIcon size={18} />
                                    Audio (MP3)
                                </button>
                            </div>

                            {/* Quality Options */}
                            <div className={styles.qualityOptions}>
                                {currentFormats?.map((format) => (
                                    <button
                                        key={format.quality}
                                        className={`${styles.qualityBtn} ${selectedQuality === format.quality ? styles.selected : ''}`}
                                        onClick={() => setSelectedQuality(format.quality)}
                                        disabled={isDownloading}
                                    >
                                        <span className={styles.qualityLabel}>{format.quality}</span>
                                    </button>
                                ))}
                            </div>

                            {/* Download Button */}
                            <button
                                className={styles.downloadBtn}
                                onClick={handleDownload}
                                disabled={!selectedQuality || isDownloading}
                            >
                                {isDownloading ? (
                                    <>
                                        <div className={styles.spinner}></div>
                                        {downloadResult?.progress !== undefined && downloadResult.progress > 0
                                            ? `Downloading... ${downloadResult.progress}%`
                                            : 'Processing...'}
                                    </>
                                ) : (
                                    <>
                                        <DownloadIcon size={20} />
                                        Download {formatType === 'video' ? 'Video' : 'Audio'}
                                    </>
                                )}
                            </button>

                            {/* Progress Bar */}
                            {isDownloading && downloadResult?.progress !== undefined && downloadResult.progress > 0 && (
                                <div className={styles.progressContainer}>
                                    <div
                                        className={styles.progressBar}
                                        style={{ width: `${downloadResult.progress}%` }}
                                    />
                                </div>
                            )}

                            {/* Download Result */}
                            {downloadResult?.status === 'completed' && (
                                <div className={styles.downloadReady}>
                                    <p>Ready to download!</p>
                                    <button className={styles.getFileBtn} onClick={handleFileDownload}>
                                        <DownloadIcon size={18} />
                                        Get File ({formatSize(downloadResult.fileSize || null)})
                                    </button>
                                </div>
                            )}

                            {downloadResult?.status === 'failed' && (
                                <div className={styles.downloadError}>
                                    <p>❌ {downloadResult.error || 'Download failed'}</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* New Search Button */}
                {videoInfo && (
                    <button className={styles.newSearchBtn} onClick={resetAll}>
                        Download Another Video
                    </button>
                )}

                {/* Features */}
                <div className={styles.features}>
                    <div className={styles.feature}>
                        <div className={styles.featureIcon}>
                            <PlayIcon size={24} />
                        </div>
                        <h4>Video MP4</h4>
                        <p>Download in 360p, 720p, 1080p quality</p>
                    </div>
                    <div className={styles.feature}>
                        <div className={styles.featureIcon}>
                            <MusicIcon size={24} />
                        </div>
                        <h4>Audio MP3</h4>
                        <p>Extract audio in high quality MP3</p>
                    </div>
                    <div className={styles.feature}>
                        <div className={styles.featureIcon}>
                            <ClockIcon size={24} />
                        </div>
                        <h4>Auto Cleanup</h4>
                        <p>Files auto-delete after 1 hour</p>
                    </div>
                </div>

                {/* Disclaimer */}
                <p className={styles.disclaimer}>
                    ⚠️ This tool is for personal use only. Please respect copyright laws and YouTube&apos;s Terms of Service.
                </p>
            </main>
        </div>
    );
}
