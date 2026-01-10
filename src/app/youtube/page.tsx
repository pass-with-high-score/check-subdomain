'use client';

import { useState, useEffect, useCallback } from 'react';
import Navigation from '@/components/Navigation';
import Toast, { useToast } from '@/components/Toast';
import { PlayIcon, MusicIcon, DownloadIcon, SearchIcon, ClockIcon, CopyIcon, XIcon, ScissorsIcon, WarningIcon } from '@/components/Icons';
import styles from './page.module.css';

const API_BASE = process.env.NEXT_PUBLIC_CHAT_URL || 'http://localhost:3001';
const STORAGE_KEY = 'youtube_downloads_history';
const EXPIRATION_MS = 60 * 60 * 1000; // 1 hour

interface DownloadHistoryItem {
    id: string;
    title: string;
    thumbnail: string;
    format: string;
    quality: string;
    downloadUrl: string;
    fileSize: number;
    createdAt: number; // timestamp
    expiresAt: number; // timestamp
}

interface FormatOption {
    quality: string;
    value: string;
    filesize?: number;
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
    status: 'pending' | 'queued' | 'processing' | 'uploading' | 'completed' | 'failed';
    progress?: number;
    downloadUrl?: string;
    fileSize?: number;
    filename?: string;
    error?: string;
    queuePosition?: number;
}

const VIDEO_FORMATS = [
    { value: 'mp4', label: 'MP4 (H.264)', desc: 'Best compatibility' },
    { value: 'webm', label: 'WebM (VP9)', desc: 'Smaller size' },
    { value: 'mkv', label: 'MKV', desc: 'Lossless container' },
];

const AUDIO_FORMATS = [
    { value: 'mp3', label: 'MP3', desc: 'Universal' },
    { value: 'm4a', label: 'M4A (AAC)', desc: 'Apple devices' },
    { value: 'opus', label: 'Opus', desc: 'Best quality/size' },
    { value: 'flac', label: 'FLAC', desc: 'Lossless' },
    { value: 'wav', label: 'WAV', desc: 'Uncompressed' },
];

export default function YouTubePage() {
    const [url, setUrl] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null);
    const [formatType, setFormatType] = useState<'video' | 'audio'>('video');
    const [selectedQuality, setSelectedQuality] = useState<string>('');
    const [outputFormat, setOutputFormat] = useState<string>('mp4');
    const [startTime, setStartTime] = useState<string>('');
    const [endTime, setEndTime] = useState<string>('');
    const [isDownloading, setIsDownloading] = useState(false);
    const [downloadResult, setDownloadResult] = useState<DownloadResult | null>(null);
    const [downloadHistory, setDownloadHistory] = useState<DownloadHistoryItem[]>([]);
    const { toasts, addToast, removeToast } = useToast();

    // LocalStorage helpers
    const getHistory = useCallback((): DownloadHistoryItem[] => {
        if (typeof window === 'undefined') return [];
        try {
            const data = localStorage.getItem(STORAGE_KEY);
            return data ? JSON.parse(data) : [];
        } catch {
            return [];
        }
    }, []);

    const saveToHistory = useCallback((item: DownloadHistoryItem) => {
        const history = getHistory();
        // Remove if exists (update)
        const filtered = history.filter(h => h.id !== item.id);
        const updated = [item, ...filtered].slice(0, 20); // Keep max 20 items
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
        setDownloadHistory(updated);
    }, [getHistory]);

    const removeFromHistory = useCallback((id: string) => {
        const history = getHistory();
        const updated = history.filter(h => h.id !== id);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
        setDownloadHistory(updated);
    }, [getHistory]);

    const isExpired = (expiresAt: number): boolean => {
        return Date.now() > expiresAt;
    };

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

    // Parse time string to seconds (supports mm:ss or just seconds)
    const parseTimeToSeconds = (time: string): number => {
        if (!time) return 0;
        if (time.includes(':')) {
            const parts = time.split(':').map(Number);
            if (parts.length === 2) return parts[0] * 60 + parts[1];
            if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
        }
        return parseFloat(time) || 0;
    };

    // Calculate estimated clip size based on duration ratio
    const getEstimatedClipSize = (fullSize: number | undefined): number | undefined => {
        if (!fullSize || !videoInfo) return fullSize;
        if (!startTime && !endTime) return fullSize;

        const fullDuration = videoInfo.duration;
        if (!fullDuration) return fullSize;

        const startSec = parseTimeToSeconds(startTime);
        const endSec = endTime ? parseTimeToSeconds(endTime) : fullDuration;
        const clipDuration = Math.max(0, Math.min(endSec, fullDuration) - startSec);

        // Calculate proportional size
        const ratio = clipDuration / fullDuration;
        return Math.round(fullSize * ratio);
    };

    // Load and cleanup history on mount
    useEffect(() => {
        const history = getHistory();
        // Filter out expired items
        const now = Date.now();
        const validHistory = history.filter(item => item.expiresAt > now);
        if (validHistory.length !== history.length) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(validHistory));
        }
        setDownloadHistory(validHistory);
    }, [getHistory]);

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
                    outputFormat,
                    // Only send clip params if user actually changed from default (full video)
                    startTime: startTime && parseTimeToSeconds(startTime) > 0 ? startTime : undefined,
                    endTime: endTime && videoInfo && parseTimeToSeconds(endTime) < videoInfo.duration ? endTime : undefined,
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
        const maxAttempts = 180; // 15 minutes (180 * 5s = 900s)
        let attempts = 0;

        const poll = async () => {
            try {
                const res = await fetch(`${API_BASE}/youtube/${id}`);
                const data = await res.json();
                setDownloadResult(data);

                if (data.status === 'completed') {
                    setIsDownloading(false);
                    addToast('Download ready!', 'success');
                    // Save to history
                    if (videoInfo) {
                        const now = Date.now();
                        saveToHistory({
                            id: data.id,
                            title: videoInfo.title,
                            thumbnail: videoInfo.thumbnail,
                            format: outputFormat,
                            quality: selectedQuality,
                            downloadUrl: data.downloadUrl,
                            fileSize: data.fileSize || 0,
                            createdAt: now,
                            expiresAt: now + EXPIRATION_MS,
                        });
                    }
                } else if (data.status === 'failed') {
                    setIsDownloading(false);
                    addToast(data.error || 'Download failed', 'error');
                } else if (data.status === 'queued' || data.status === 'processing' || data.status === 'uploading' || data.status === 'pending') {
                    // Continue polling for queued, processing, or pending status
                    if (attempts < maxAttempts) {
                        attempts++;
                        setTimeout(poll, 2000); // Poll every 2 seconds for queued items
                    } else {
                        setIsDownloading(false);
                        addToast('Download timed out', 'error');
                    }
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

    const handleHistoryDownload = (item: DownloadHistoryItem) => {
        if (isExpired(item.expiresAt)) {
            addToast('This download has expired and is no longer available', 'error');
            removeFromHistory(item.id);
            return;
        }
        window.open(`${API_BASE}${item.downloadUrl}`, '_blank');
    };

    const copyShareLink = async (item: DownloadHistoryItem) => {
        if (isExpired(item.expiresAt)) {
            addToast('This download has expired and cannot be shared', 'error');
            removeFromHistory(item.id);
            return;
        }
        const shareUrl = `${API_BASE}${item.downloadUrl}`;
        try {
            await navigator.clipboard.writeText(shareUrl);
            addToast('Download link copied to clipboard!', 'success');
        } catch {
            addToast('Failed to copy link', 'error');
        }
    };

    const getTimeRemaining = (expiresAt: number): string => {
        const remaining = expiresAt - Date.now();
        if (remaining <= 0) return 'Expired';
        const minutes = Math.floor(remaining / 60000);
        if (minutes < 60) return `${minutes}m left`;
        return `${Math.floor(minutes / 60)}h ${minutes % 60}m left`;
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
                                        setOutputFormat('mp4');
                                        if (videoInfo.videoFormats.length > 0) {
                                            setSelectedQuality(videoInfo.videoFormats[0].quality);
                                        }
                                    }}
                                >
                                    <PlayIcon size={18} />
                                    Video
                                </button>
                                <button
                                    className={`${styles.formatTab} ${formatType === 'audio' ? styles.active : ''}`}
                                    onClick={() => {
                                        setFormatType('audio');
                                        setOutputFormat('mp3');
                                        if (videoInfo.audioFormats.length > 0) {
                                            setSelectedQuality(videoInfo.audioFormats[0].quality);
                                        }
                                    }}
                                >
                                    <MusicIcon size={18} />
                                    Audio
                                </button>
                            </div>

                            {/* Output Format Selector */}
                            <div className={styles.formatSelector}>
                                <label>Output Format:</label>
                                <select
                                    value={outputFormat}
                                    onChange={(e) => setOutputFormat(e.target.value)}
                                    className={styles.formatSelect}
                                    disabled={isDownloading}
                                >
                                    {(formatType === 'video' ? VIDEO_FORMATS : AUDIO_FORMATS).map((fmt) => (
                                        <option key={fmt.value} value={fmt.value}>
                                            {fmt.label} - {fmt.desc}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Clip Time Selector with Range Slider */}
                            <div className={styles.clipSelector}>
                                <label><ScissorsIcon size={16} /> Clip (optional):</label>
                                <div className={styles.clipSliderContainer}>
                                    <span className={styles.clipTimeLabel}>{startTime || '0:00'}</span>
                                    <div className={styles.clipRangeWrapper}>
                                        <div className={styles.clipRangeTrack}>
                                            <div
                                                className={styles.clipRangeProgress}
                                                style={{
                                                    left: `${(parseTimeToSeconds(startTime) / videoInfo.duration) * 100}%`,
                                                    width: `${((endTime ? parseTimeToSeconds(endTime) : videoInfo.duration) - parseTimeToSeconds(startTime)) / videoInfo.duration * 100}%`
                                                }}
                                            />
                                        </div>
                                        <input
                                            type="range"
                                            min="0"
                                            max={videoInfo.duration}
                                            step="1"
                                            value={parseTimeToSeconds(startTime)}
                                            onChange={(e) => {
                                                const newStart = parseInt(e.target.value);
                                                const endSec = endTime ? parseTimeToSeconds(endTime) : videoInfo.duration;
                                                if (newStart < endSec) {
                                                    setStartTime(formatDuration(newStart));
                                                }
                                            }}
                                            className={styles.clipRangeInput}
                                            disabled={isDownloading}
                                        />
                                        <input
                                            type="range"
                                            min="0"
                                            max={videoInfo.duration}
                                            step="1"
                                            value={endTime ? parseTimeToSeconds(endTime) : videoInfo.duration}
                                            onChange={(e) => {
                                                const newEnd = parseInt(e.target.value);
                                                const startSec = parseTimeToSeconds(startTime);
                                                if (newEnd > startSec) {
                                                    setEndTime(formatDuration(newEnd));
                                                }
                                            }}
                                            className={styles.clipRangeInput}
                                            disabled={isDownloading}
                                        />
                                    </div>
                                    <span className={styles.clipTimeLabel}>{endTime || formatDuration(videoInfo.duration)}</span>
                                </div>
                                {(startTime || endTime) && (
                                    <span className={styles.clipWarning}><WarningIcon size={14} /> Full video will be downloaded first, then cut</span>
                                )}
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
                                        {format.filesize && (
                                            <span className={styles.qualitySize}>{formatSize(getEstimatedClipSize(format.filesize) ?? null)}</span>
                                        )}
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
                                        {downloadResult?.status === 'queued' && downloadResult.queuePosition
                                            ? `Queued (Position ${downloadResult.queuePosition})`
                                            : downloadResult?.status === 'uploading'
                                                ? 'Uploading to cloud...'
                                                : downloadResult?.progress !== undefined && downloadResult.progress > 0
                                                    ? downloadResult.progress >= 100
                                                        ? 'Processing video...'
                                                        : `Downloading... ${downloadResult.progress}%`
                                                    : 'Starting...'}
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

                {/* Download History */}
                {downloadHistory.length > 0 && (
                    <div className={styles.historySection}>
                        <h3 className={styles.historyTitle}><DownloadIcon size={18} /> Recent Downloads</h3>
                        <p className={styles.historySubtitle}>Links expire after 1 hour</p>
                        <div className={styles.historyList}>
                            {downloadHistory.map((item) => (
                                <div key={item.id} className={styles.historyItem}>
                                    <div className={styles.historyThumbnail}>
                                        <img src={item.thumbnail} alt={item.title} />
                                    </div>
                                    <div className={styles.historyInfo}>
                                        <h4 className={styles.historyItemTitle}>{item.title}</h4>
                                        <div className={styles.historyMeta}>
                                            <span>{item.format.toUpperCase()} • {item.quality}</span>
                                            <span className={styles.historyTimer}>
                                                <ClockIcon size={12} />
                                                {getTimeRemaining(item.expiresAt)}
                                            </span>
                                        </div>
                                    </div>
                                    <div className={styles.historyActions}>
                                        <button
                                            className={styles.historyDownloadBtn}
                                            onClick={() => handleHistoryDownload(item)}
                                            title="Download"
                                        >
                                            <DownloadIcon size={16} />
                                        </button>
                                        <button
                                            className={styles.historyShareBtn}
                                            onClick={() => copyShareLink(item)}
                                            title="Copy Link"
                                        >
                                            <CopyIcon size={16} />
                                        </button>
                                        <button
                                            className={styles.historyDeleteBtn}
                                            onClick={() => removeFromHistory(item.id)}
                                            title="Remove"
                                        >
                                            <XIcon size={16} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Features */}
                <div className={styles.features}>
                    <div className={styles.feature}>
                        <div className={styles.featureIcon}>
                            <PlayIcon size={24} />
                        </div>
                        <h4>Video Formats</h4>
                        <p>MP4, WebM, MKV up to 4K quality</p>
                    </div>
                    <div className={styles.feature}>
                        <div className={styles.featureIcon}>
                            <MusicIcon size={24} />
                        </div>
                        <h4>Audio Formats</h4>
                        <p>MP3, M4A, FLAC, Opus, WAV</p>
                    </div>
                    <div className={styles.feature}>
                        <div className={styles.featureIcon}>
                            <ScissorsIcon size={24} />
                        </div>
                        <h4>Clip Mode</h4>
                        <p>Cut video by start/end time</p>
                    </div>
                    <div className={styles.feature}>
                        <div className={styles.featureIcon}>
                            <DownloadIcon size={24} />
                        </div>
                        <h4>500MB Limit</h4>
                        <p>Max file size per download</p>
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
                    <WarningIcon size={16} /> This tool is for personal use only. Please respect copyright laws and YouTube&apos;s Terms of Service.
                </p>
            </main>
        </div>
    );
}
