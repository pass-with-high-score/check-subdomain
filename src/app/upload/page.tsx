'use client';

import { useState, useRef, useCallback } from 'react';
import Navigation from '@/components/Navigation';
import Toast, { useToast } from '@/components/Toast';
import { UploadIcon, CopyIcon, ImageIcon, TrashIcon, LinkIcon } from '@/components/Icons';
import styles from './page.module.css';

interface UploadedImage {
    id: string;
    url: string;
    filename: string;
    size: number;
    uploadedAt: string;
}

export default function ImageUploadPage() {
    const [uploads, setUploads] = useState<UploadedImage[]>(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('image-uploads');
            return saved ? JSON.parse(saved) : [];
        }
        return [];
    });
    const [isUploading, setIsUploading] = useState(false);
    const [dragOver, setDragOver] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { toasts, addToast, removeToast } = useToast();

    const saveUploads = (newUploads: UploadedImage[]) => {
        setUploads(newUploads);
        localStorage.setItem('image-uploads', JSON.stringify(newUploads.slice(0, 50)));
    };

    const uploadFile = async (file: File) => {
        if (!file.type.startsWith('image/')) {
            addToast('Only image files are allowed', 'error');
            return;
        }

        if (file.size > 10 * 1024 * 1024) {
            addToast('File too large. Maximum 10MB', 'error');
            return;
        }

        setIsUploading(true);

        try {
            const response = await fetch('/api/upload', {
                method: 'POST',
                headers: {
                    'Content-Type': file.type,
                    'x-filename': file.name,
                },
                body: file,
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Upload failed');
            }

            const data = await response.json();

            const newUpload: UploadedImage = {
                id: data.id,
                url: data.url,
                filename: data.filename,
                size: data.size,
                uploadedAt: new Date().toISOString(),
            };

            saveUploads([newUpload, ...uploads]);
            addToast('Image uploaded successfully!', 'success');
        } catch (error) {
            addToast(error instanceof Error ? error.message : 'Upload failed', 'error');
        } finally {
            setIsUploading(false);
        }
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            uploadFile(file);
        }
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setDragOver(false);
        const file = e.dataTransfer.files?.[0];
        if (file) {
            uploadFile(file);
        }
    }, [uploads]);

    const handlePaste = useCallback((e: ClipboardEvent) => {
        const items = e.clipboardData?.items;
        if (!items) return;

        for (const item of items) {
            if (item.type.startsWith('image/')) {
                const file = item.getAsFile();
                if (file) {
                    uploadFile(file);
                }
                break;
            }
        }
    }, [uploads]);

    // Listen for paste events
    useState(() => {
        if (typeof window !== 'undefined') {
            window.addEventListener('paste', handlePaste);
            return () => window.removeEventListener('paste', handlePaste);
        }
    });

    const copyUrl = async (url: string) => {
        try {
            await navigator.clipboard.writeText(url);
            addToast('URL copied to clipboard', 'success');
        } catch {
            const textarea = document.createElement('textarea');
            textarea.value = url;
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
            addToast('URL copied to clipboard', 'success');
        }
    };

    const deleteUpload = (id: string) => {
        saveUploads(uploads.filter(u => u.id !== id));
        addToast('Removed from history', 'info');
    };

    const formatSize = (bytes: number) => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    return (
        <div className={styles.container}>
            <div className={styles.backgroundGradient}></div>
            <Navigation />
            <Toast toasts={toasts} removeToast={removeToast} />

            {/* Header */}
            <header className={styles.header}>
                <div className={styles.logo}>
                    <div className={styles.logoIcon}>
                        <UploadIcon size={28} />
                    </div>
                    <h1>Image Uploader</h1>
                </div>
                <p className={styles.tagline}>
                    Upload images and get shareable links instantly
                </p>
            </header>

            <main className={styles.main}>
                {/* Upload Zone */}
                <div
                    className={`${styles.uploadZone} ${dragOver ? styles.dragOver : ''} ${isUploading ? styles.uploading : ''}`}
                    onDrop={handleDrop}
                    onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onClick={() => fileInputRef.current?.click()}
                >
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleFileSelect}
                        className={styles.fileInput}
                    />
                    {isUploading ? (
                        <div className={styles.uploadingState}>
                            <div className={styles.spinner}></div>
                            <p>Uploading...</p>
                        </div>
                    ) : (
                        <div className={styles.uploadPrompt}>
                            <div className={styles.uploadIconLarge}>
                                <UploadIcon size={48} />
                            </div>
                            <p className={styles.uploadText}>Drop image here or click to upload</p>
                            <p className={styles.uploadHint}>You can also paste from clipboard (Ctrl+V)</p>
                            <p className={styles.uploadLimit}>Max 10MB • JPG, PNG, GIF, WebP, SVG</p>
                        </div>
                    )}
                </div>

                {/* Upload History */}
                {uploads.length > 0 && (
                    <div className={styles.historySection}>
                        <div className={styles.historyHeader}>
                            <h2>
                                <ImageIcon size={20} /> Recent Uploads
                            </h2>
                            <button
                                className={styles.clearButton}
                                onClick={() => {
                                    saveUploads([]);
                                    addToast('History cleared', 'info');
                                }}
                            >
                                Clear All
                            </button>
                        </div>
                        <div className={styles.uploadList}>
                            {uploads.map((upload) => (
                                <div key={upload.id} className={styles.uploadItem}>
                                    <div className={styles.uploadPreview}>
                                        <img src={upload.url} alt={upload.filename} />
                                    </div>
                                    <div className={styles.uploadInfo}>
                                        <span className={styles.uploadFilename}>{upload.filename}</span>
                                        <span className={styles.uploadSize}>{formatSize(upload.size)}</span>
                                    </div>
                                    <div className={styles.uploadActions}>
                                        <button
                                            className={styles.actionButton}
                                            onClick={() => copyUrl(upload.url)}
                                            title="Copy URL"
                                        >
                                            <CopyIcon size={16} />
                                        </button>
                                        <a
                                            href={upload.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className={styles.actionButton}
                                            title="Open in new tab"
                                        >
                                            <LinkIcon size={16} />
                                        </a>
                                        <button
                                            className={`${styles.actionButton} ${styles.deleteButton}`}
                                            onClick={() => deleteUpload(upload.id)}
                                            title="Remove from history"
                                        >
                                            <TrashIcon size={16} />
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
                            <UploadIcon size={24} />
                        </div>
                        <h4>Easy Upload</h4>
                        <p>Drag & drop or paste from clipboard</p>
                    </div>
                    <div className={styles.feature}>
                        <div className={styles.featureIcon}>
                            <LinkIcon size={24} />
                        </div>
                        <h4>Instant Link</h4>
                        <p>Get shareable URL immediately</p>
                    </div>
                    <div className={styles.feature}>
                        <div className={styles.featureIcon}>
                            <ImageIcon size={24} />
                        </div>
                        <h4>All Formats</h4>
                        <p>JPG, PNG, GIF, WebP, SVG</p>
                    </div>
                </div>
            </main>
        </div>
    );
}
