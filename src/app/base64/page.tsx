'use client';

import { useState, useRef, useCallback } from 'react';
import Navigation from '@/components/Navigation';
import Toast, { useToast } from '@/components/Toast';
import { CopyIcon, CheckIcon, ImageIcon, DownloadIcon, TrashIcon, UploadIcon, XIcon } from '@/components/Icons';
import styles from './page.module.css';

type TabType = 'view' | 'encode';

export default function Base64Page() {
    const [activeTab, setActiveTab] = useState<TabType>('view');
    const [base64Input, setBase64Input] = useState('');
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [base64Output, setBase64Output] = useState('');
    const [fileName, setFileName] = useState<string | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [copiedItem, setCopiedItem] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { toasts, addToast, removeToast } = useToast();

    // Process base64 input and generate preview
    const processBase64Input = useCallback((value: string) => {
        setBase64Input(value);

        if (!value.trim()) {
            setImagePreview(null);
            return;
        }

        // Clean the input - remove data URL prefix if present
        let cleanBase64 = value.trim();

        // If it's already a data URL, use it directly
        if (cleanBase64.startsWith('data:image/')) {
            setImagePreview(cleanBase64);
            return;
        }

        // Try to detect image type and create data URL
        try {
            // Remove any whitespace or newlines
            cleanBase64 = cleanBase64.replace(/\s/g, '');

            // Try to decode to check if valid base64
            atob(cleanBase64);

            // Default to PNG if we can't detect
            const dataUrl = `data:image/png;base64,${cleanBase64}`;
            setImagePreview(dataUrl);
        } catch {
            setImagePreview(null);
        }
    }, []);

    // Handle file upload for encoding
    const handleFileUpload = useCallback((file: File) => {
        if (!file.type.startsWith('image/')) {
            addToast('Please select an image file', 'error');
            return;
        }

        setFileName(file.name);

        const reader = new FileReader();
        reader.onload = (e) => {
            const result = e.target?.result as string;
            setBase64Output(result);
            addToast('Image encoded successfully', 'success');
        };
        reader.onerror = () => {
            addToast('Failed to read file', 'error');
        };
        reader.readAsDataURL(file);
    }, [addToast]);

    // Drag and drop handlers
    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);

        const file = e.dataTransfer.files[0];
        if (file) {
            handleFileUpload(file);
        }
    }, [handleFileUpload]);

    // Copy to clipboard
    const handleCopy = async (text: string, itemName: string) => {
        try {
            await navigator.clipboard.writeText(text);
            setCopiedItem(itemName);
            addToast('Copied to clipboard', 'success');
            setTimeout(() => setCopiedItem(null), 2000);
        } catch {
            addToast('Failed to copy', 'error');
        }
    };

    // Download image
    const handleDownloadImage = () => {
        if (!imagePreview) return;

        const link = document.createElement('a');
        link.href = imagePreview;
        link.download = 'image.png';
        link.click();
        addToast('Image downloaded', 'success');
    };

    // Download base64 as text file
    const handleDownloadText = () => {
        if (!base64Output) return;

        const blob = new Blob([base64Output], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName ? `${fileName}.txt` : 'base64.txt';
        link.click();
        URL.revokeObjectURL(url);
        addToast('Text file downloaded', 'success');
    };

    // Clear handlers
    const handleClearView = () => {
        setBase64Input('');
        setImagePreview(null);
    };

    const handleClearEncode = () => {
        setBase64Output('');
        setFileName(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    return (
        <div className={styles.container}>
            {/* Background */}
            <div className={styles.backgroundGradient}></div>

            {/* Toast Notifications */}
            <Toast toasts={toasts} removeToast={removeToast} />

            {/* Navigation */}
            <Navigation />

            {/* Header */}
            <header className={styles.header}>
                <div className={styles.logo}>
                    <span className={styles.logoIcon}>
                        <ImageIcon size={32} />
                    </span>
                    <h1>Base64 Image</h1>
                </div>
                <p className={styles.tagline}>
                    View Base64 images or encode images to Base64
                </p>
            </header>

            {/* Tab Navigation */}
            <div className={styles.tabContainer}>
                <button
                    className={`${styles.tab} ${activeTab === 'view' ? styles.tabActive : ''}`}
                    onClick={() => setActiveTab('view')}
                >
                    View Image
                </button>
                <button
                    className={`${styles.tab} ${activeTab === 'encode' ? styles.tabActive : ''}`}
                    onClick={() => setActiveTab('encode')}
                >
                    Encode Image
                </button>
            </div>

            {/* Main Content */}
            <main className={styles.main}>
                {activeTab === 'view' ? (
                    /* View Image Tab */
                    <div className={styles.viewLayout}>
                        {/* Preview Section */}
                        <div className={styles.previewSection}>
                            <h3>Preview</h3>
                            <div className={styles.previewBox}>
                                {imagePreview ? (
                                    <img
                                        src={imagePreview}
                                        alt="Base64 Preview"
                                        className={styles.previewImage}
                                        onError={() => {
                                            setImagePreview(null);
                                            addToast('Invalid image data', 'error');
                                        }}
                                    />
                                ) : (
                                    <div className={styles.previewPlaceholder}>
                                        <ImageIcon size={64} />
                                        <p>Paste a Base64 string to preview</p>
                                    </div>
                                )}
                            </div>
                            {imagePreview && (
                                <button
                                    onClick={handleDownloadImage}
                                    className={styles.actionButton}
                                >
                                    <DownloadIcon size={18} />
                                    Download Image
                                </button>
                            )}
                        </div>

                        {/* Input Section */}
                        <div className={styles.inputSection}>
                            <div className={styles.inputHeader}>
                                <h3>Base64 String</h3>
                                <button
                                    onClick={handleClearView}
                                    className={styles.clearButton}
                                    disabled={!base64Input}
                                >
                                    <TrashIcon size={16} />
                                    Clear
                                </button>
                            </div>
                            <textarea
                                value={base64Input}
                                onChange={(e) => processBase64Input(e.target.value)}
                                placeholder="Paste your Base64 string here..."
                                className={styles.textarea}
                                rows={15}
                            />
                            <p className={styles.hint}>
                                Supports both raw Base64 and data URLs (data:image/png;base64,...)
                            </p>
                        </div>
                    </div>
                ) : (
                    /* Encode Image Tab */
                    <div className={styles.encodeLayout}>
                        {/* Upload Section */}
                        <div className={styles.uploadSection}>
                            <h3>Upload Image</h3>
                            <div
                                className={`${styles.dropZone} ${isDragging ? styles.dropZoneActive : ''}`}
                                onDragOver={handleDragOver}
                                onDragLeave={handleDragLeave}
                                onDrop={handleDrop}
                                onClick={() => fileInputRef.current?.click()}
                            >
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/*"
                                    onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) handleFileUpload(file);
                                    }}
                                    className={styles.hiddenInput}
                                />
                                <UploadIcon size={48} />
                                <p className={styles.dropText}>
                                    Drag & drop an image here
                                </p>
                                <p className={styles.dropSubtext}>
                                    or click to browse
                                </p>
                            </div>
                            {fileName && (
                                <div className={styles.fileInfo}>
                                    <span>Selected: {fileName}</span>
                                    <button onClick={handleClearEncode} className={styles.smallButton}>
                                        <XIcon size={14} />
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Output Section */}
                        <div className={styles.outputSection}>
                            <div className={styles.inputHeader}>
                                <h3>Base64 Output</h3>
                                <div className={styles.actionButtons}>
                                    <button
                                        onClick={() => handleCopy(base64Output, 'output')}
                                        className={styles.smallActionButton}
                                        disabled={!base64Output}
                                    >
                                        {copiedItem === 'output' ? <CheckIcon size={16} /> : <CopyIcon size={16} />}
                                        Copy
                                    </button>
                                    <button
                                        onClick={handleDownloadText}
                                        className={styles.smallActionButton}
                                        disabled={!base64Output}
                                    >
                                        <DownloadIcon size={16} />
                                        Download
                                    </button>
                                </div>
                            </div>
                            <textarea
                                value={base64Output}
                                readOnly
                                placeholder="Base64 output will appear here..."
                                className={styles.textarea}
                                rows={15}
                            />
                        </div>
                    </div>
                )}
            </main>


        </div>
    );
}
