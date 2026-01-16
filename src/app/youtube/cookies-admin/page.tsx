'use client';

import { useState, useEffect } from 'react';
import Navigation from '@/components/Navigation';
import Toast, { useToast } from '@/components/Toast';
import { KeyIcon, UploadIcon, FileIcon, RefreshIcon, CookieIcon, ShieldIcon } from '@/components/Icons';
import styles from './page.module.css';

const API_BASE = process.env.NEXT_PUBLIC_CHAT_URL || 'http://localhost:3010';
const ADMIN_KEY_STORAGE = 'youtube_admin_key';

interface CookiesStatus {
    exists: boolean;
    path: string;
    lastModified?: string;
    size?: number;
}

export default function CookiesAdminPage() {
    const [adminKey, setAdminKey] = useState('');
    const [saveKey, setSaveKey] = useState(false);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [cookiesContent, setCookiesContent] = useState('');
    const [status, setStatus] = useState<CookiesStatus | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const { toasts, addToast, removeToast } = useToast();

    // Load saved admin key on mount
    useEffect(() => {
        const savedKey = localStorage.getItem(ADMIN_KEY_STORAGE);
        if (savedKey) {
            setAdminKey(savedKey);
            setSaveKey(true);
        }
    }, []);

    const handleCheckStatus = async () => {
        if (!adminKey) {
            addToast('Please enter admin key', 'error');
            return;
        }

        setIsLoading(true);

        try {
            const res = await fetch(`${API_BASE}/youtube/cookies/status`, {
                headers: {
                    'x-admin-key': adminKey,
                },
            });

            if (res.status === 401) {
                addToast('Invalid admin key', 'error');
                setIsAuthenticated(false);
                return;
            }

            if (!res.ok) {
                throw new Error('Failed to get status');
            }

            const data = await res.json();
            setStatus(data);
            setIsAuthenticated(true);

            // Save key if checkbox is checked
            if (saveKey) {
                localStorage.setItem(ADMIN_KEY_STORAGE, adminKey);
            } else {
                localStorage.removeItem(ADMIN_KEY_STORAGE);
            }

            addToast('Authenticated successfully', 'success');
        } catch (error) {
            addToast(error instanceof Error ? error.message : 'Failed to connect', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const handleUpdateCookies = async () => {
        if (!cookiesContent.trim()) {
            addToast('Please enter cookies content', 'error');
            return;
        }

        setIsLoading(true);

        try {
            const res = await fetch(`${API_BASE}/youtube/cookies`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-admin-key': adminKey,
                },
                body: JSON.stringify({ content: cookiesContent }),
            });

            if (res.status === 401) {
                addToast('Invalid admin key', 'error');
                setIsAuthenticated(false);
                return;
            }

            const data = await res.json();

            if (data.success) {
                addToast(data.message, 'success');
                setCookiesContent('');
                // Refresh status
                handleCheckStatus();
            } else {
                addToast(data.message, 'error');
            }
        } catch (error) {
            addToast(error instanceof Error ? error.message : 'Failed to update cookies', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const content = event.target?.result as string;
            setCookiesContent(content);
        };
        reader.readAsText(file);
    };

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleString();
    };

    const formatSize = (bytes: number) => {
        if (bytes < 1024) return `${bytes} B`;
        return `${(bytes / 1024).toFixed(1)} KB`;
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
                        <CookieIcon size={28} />
                    </div>
                    <h1>Cookies Admin</h1>
                </div>
                <p className={styles.tagline}>
                    Secure YouTube cookies management
                </p>
            </header>

            <main className={styles.main}>
                {/* Authentication Card */}
                <div className={styles.card}>
                    <div className={styles.cardHeader}>
                        <KeyIcon size={20} />
                        <span>Authentication</span>
                    </div>

                    <div className={styles.inputGroup}>
                        <label className={styles.label}>Admin Key</label>
                        <input
                            type="password"
                            value={adminKey}
                            onChange={(e) => setAdminKey(e.target.value)}
                            placeholder="Enter admin key..."
                            className={styles.input}
                            onKeyDown={(e) => e.key === 'Enter' && handleCheckStatus()}
                        />
                    </div>

                    <div className={styles.saveKeyRow}>
                        <input
                            type="checkbox"
                            id="saveKey"
                            checked={saveKey}
                            onChange={(e) => setSaveKey(e.target.checked)}
                            className={styles.checkbox}
                        />
                        <label htmlFor="saveKey" className={styles.checkboxLabel}>
                            Save key in browser
                        </label>
                    </div>

                    <button
                        className={`${styles.btn} ${styles.btnPrimary}`}
                        onClick={handleCheckStatus}
                        disabled={isLoading || !adminKey}
                    >
                        {isLoading ? <div className={styles.spinner}></div> : <RefreshIcon size={18} />}
                        Check Status
                    </button>
                </div>

                {/* Status Card */}
                {isAuthenticated && status && (
                    <div className={styles.card}>
                        <div className={styles.cardHeader}>
                            <FileIcon size={20} />
                            <span>Current Status</span>
                        </div>

                        <div className={styles.statusCard}>
                            <div className={styles.statusRow}>
                                <span className={styles.statusLabel}>File Exists</span>
                                <span className={`${styles.statusValue} ${status.exists ? styles.success : styles.error}`}>
                                    {status.exists ? '✓ Yes' : '✗ No'}
                                </span>
                            </div>
                            <div className={styles.statusRow}>
                                <span className={styles.statusLabel}>Path</span>
                                <span className={styles.statusValue}>{status.path}</span>
                            </div>
                            {status.lastModified && (
                                <div className={styles.statusRow}>
                                    <span className={styles.statusLabel}>Last Modified</span>
                                    <span className={styles.statusValue}>{formatDate(status.lastModified)}</span>
                                </div>
                            )}
                            {status.size !== undefined && (
                                <div className={styles.statusRow}>
                                    <span className={styles.statusLabel}>Size</span>
                                    <span className={styles.statusValue}>{formatSize(status.size)}</span>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Upload Card */}
                {isAuthenticated && (
                    <div className={styles.card}>
                        <div className={styles.cardHeader}>
                            <UploadIcon size={20} />
                            <span>Update Cookies</span>
                        </div>

                        <input
                            type="file"
                            id="cookiesFile"
                            accept=".txt"
                            onChange={handleFileUpload}
                            className={styles.fileInput}
                        />
                        <label htmlFor="cookiesFile" className={styles.fileLabel}>
                            <UploadIcon size={16} />
                            Choose file to upload
                        </label>

                        <div className={styles.divider}>or paste content</div>

                        <textarea
                            value={cookiesContent}
                            onChange={(e) => setCookiesContent(e.target.value)}
                            placeholder="# Netscape HTTP Cookie File&#10;# Paste your cookies here...&#10;.youtube.com&#9;TRUE&#9;/&#9;TRUE&#9;..."
                            className={styles.textarea}
                        />

                        <div className={styles.buttonGroup}>
                            <button
                                className={`${styles.btn} ${styles.btnSecondary}`}
                                onClick={() => setCookiesContent('')}
                                disabled={!cookiesContent}
                            >
                                Clear
                            </button>
                            <button
                                className={`${styles.btn} ${styles.btnPrimary}`}
                                onClick={handleUpdateCookies}
                                disabled={isLoading || !cookiesContent.trim()}
                            >
                                {isLoading ? <div className={styles.spinner}></div> : <UploadIcon size={18} />}
                                Update Cookies
                            </button>
                        </div>
                    </div>
                )}

                {/* Warning */}
                <div className={styles.warningCard}>
                    <ShieldIcon size={20} />
                    <span>This page is for administrators only. Never share your admin key!</span>
                </div>
            </main>
        </div>
    );
}
