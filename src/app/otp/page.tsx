'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import QRCode from 'qrcode';
import { generateTOTP, getTimeRemaining, isValidBase32, generateRandomSecret, secretToHex, getEpochInfo, generateTOTPWithOffset } from '@/lib/totp';
import Navigation from '@/components/Navigation';
import { CopyIcon, AlertIcon, CheckIcon, GithubIcon, LockIcon, KeyIcon, RefreshIcon, InfoCircleIcon, XIcon } from '@/components/Icons';
import styles from './page.module.css';

interface SavedKey {
    id: string;
    name: string;
    secret: string;
}

interface OTPCodes {
    previous: string;
    current: string;
    next: string;
}

interface EpochInfo {
    epoch: number;
    iteration: number;
    iterationHex: string;
}

export default function OTPPage() {
    const [secret, setSecret] = useState('');
    const [keyName, setKeyName] = useState('');
    const [otpCodes, setOtpCodes] = useState<OTPCodes | null>(null);
    const [timeRemaining, setTimeRemaining] = useState(30);
    const [error, setError] = useState<string | null>(null);
    const [copiedItem, setCopiedItem] = useState<string | null>(null);
    const [savedKeys, setSavedKeys] = useState<SavedKey[]>([]);
    const [activeKeyId, setActiveKeyId] = useState<string | null>(null);
    const [hexSecret, setHexSecret] = useState('');
    const [epochInfo, setEpochInfo] = useState<EpochInfo | null>(null);
    const qrCanvasRef = useRef<HTMLCanvasElement>(null);

    // Password protection
    const [storedPasswordHash, setStoredPasswordHash] = useState<string | null>(null);
    const [isUnlocked, setIsUnlocked] = useState(false);
    const [passwordInput, setPasswordInput] = useState('');
    const [showUnlockDialog, setShowUnlockDialog] = useState(false);
    const [showSetPasswordDialog, setShowSetPasswordDialog] = useState(false);
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [dialogError, setDialogError] = useState<string | null>(null);

    // Simple hash function for password
    const hashPassword = async (pw: string): Promise<string> => {
        const encoder = new TextEncoder();
        const data = encoder.encode(pw + 'otp-salt-2024');
        const hash = await crypto.subtle.digest('SHA-256', data);
        return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
    };

    // Load stored password hash
    useEffect(() => {
        const hash = localStorage.getItem('otp-password-hash');
        if (hash) {
            setStoredPasswordHash(hash);
        }
    }, []);

    // Load saved keys from localStorage (only if unlocked or no password set)
    useEffect(() => {
        if (!storedPasswordHash || isUnlocked) {
            const stored = localStorage.getItem('otp-keys');
            if (stored) {
                try {
                    setSavedKeys(JSON.parse(stored));
                } catch {
                    console.error('Failed to parse saved keys');
                }
            }
        }
    }, [storedPasswordHash, isUnlocked]);

    // Save keys to localStorage
    useEffect(() => {
        if (savedKeys.length > 0) {
            localStorage.setItem('otp-keys', JSON.stringify(savedKeys));
        } else {
            localStorage.removeItem('otp-keys');
        }
    }, [savedKeys]);

    // Update hex display when secret changes
    useEffect(() => {
        if (secret.trim() && isValidBase32(secret)) {
            setHexSecret(secretToHex(secret));
        } else {
            setHexSecret('');
        }
    }, [secret]);

    const handleUnlock = async () => {
        if (!passwordInput.trim()) {
            setDialogError('Please enter your password');
            return;
        }

        const hash = await hashPassword(passwordInput);
        if (hash === storedPasswordHash) {
            setIsUnlocked(true);
            setPasswordInput('');
            setDialogError(null);
            setShowUnlockDialog(false);
        } else {
            setDialogError('Incorrect password');
        }
    };

    const handleSetPassword = async () => {
        if (newPassword.length < 4) {
            setDialogError('Password must be at least 4 characters');
            return;
        }
        if (newPassword !== confirmPassword) {
            setDialogError('Passwords do not match');
            return;
        }

        const hash = await hashPassword(newPassword);
        localStorage.setItem('otp-password-hash', hash);
        setStoredPasswordHash(hash);
        setIsUnlocked(true);
        setShowSetPasswordDialog(false);
        setNewPassword('');
        setConfirmPassword('');
        setDialogError(null);
    };

    const closeDialog = () => {
        setShowUnlockDialog(false);
        setShowSetPasswordDialog(false);
        setPasswordInput('');
        setNewPassword('');
        setConfirmPassword('');
        setDialogError(null);
    };

    const generateOTP = useCallback(async (secretKey: string) => {
        if (!secretKey.trim()) {
            setOtpCodes(null);
            return;
        }

        if (!isValidBase32(secretKey)) {
            setError('Invalid secret key format (must be base32)');
            setOtpCodes(null);
            return;
        }

        try {
            const codes = await generateTOTPWithOffset(secretKey);
            setOtpCodes(codes);
            setError(null);
        } catch {
            setError('Failed to generate OTP');
            setOtpCodes(null);
        }
    }, []);

    // Update OTP and timer
    useEffect(() => {
        if (!secret.trim() || !isValidBase32(secret)) return;

        generateOTP(secret);

        const interval = setInterval(() => {
            const remaining = getTimeRemaining();
            setTimeRemaining(remaining);
            setEpochInfo(getEpochInfo());

            if (remaining === 30) {
                generateOTP(secret);
            }
        }, 1000);

        // Initial epoch info
        setEpochInfo(getEpochInfo());

        return () => clearInterval(interval);
    }, [secret, generateOTP]);

    const handleCopy = async (text: string, itemName: string) => {
        await navigator.clipboard.writeText(text);
        setCopiedItem(itemName);
        setTimeout(() => setCopiedItem(null), 2000);
    };

    const handleGenerateRandomSecret = () => {
        const newSecret = generateRandomSecret();
        setSecret(newSecret);
        setActiveKeyId(null);
        setError(null);
    };

    const handleSaveKey = () => {
        if (!secret.trim() || !isValidBase32(secret)) {
            setError('Cannot save invalid key');
            return;
        }

        const name = keyName.trim() || `Key ${savedKeys.length + 1}`;
        const newKey: SavedKey = {
            id: Date.now().toString(),
            name,
            secret: secret.trim(),
        };

        setSavedKeys([...savedKeys, newKey]);
        setActiveKeyId(newKey.id);
        setKeyName('');
    };

    const handleSelectKey = (key: SavedKey) => {
        setSecret(key.secret);
        setActiveKeyId(key.id);
        setError(null);
    };

    const handleDeleteKey = (id: string) => {
        setSavedKeys(savedKeys.filter(k => k.id !== id));
        if (activeKeyId === id) {
            setActiveKeyId(null);
            setSecret('');
            setOtpCodes(null);
        }
    };

    const progressPercent = (timeRemaining / 30) * 100;

    // Generate QR code on canvas
    useEffect(() => {
        if (qrCanvasRef.current && secret.trim() && isValidBase32(secret)) {
            const otpAuthUrl = `otpauth://totp/OTPGenerator?secret=${secret}&algorithm=SHA1&digits=6&period=30`;
            QRCode.toCanvas(qrCanvasRef.current, otpAuthUrl, {
                width: 200,
                margin: 2,
                color: {
                    dark: '#000000',
                    light: '#ffffff'
                }
            }).catch(err => console.error('QR Code generation error:', err));
        }
    }, [secret]);

    const showQRCode = secret.trim() && isValidBase32(secret);

    // Check if password protection is needed for saved keys
    const hasSavedKeysLocked = storedPasswordHash && !isUnlocked;

    return (
        <div className={styles.container}>
            {/* Background */}
            <div className={styles.backgroundGradient}></div>

            {/* Navigation */}
            <Navigation />

            {/* Header */}
            <header className={styles.header}>
                <div className={styles.logo}>
                    <span className={styles.logoIcon}>
                        <KeyIcon size={32} />
                    </span>
                    <h1>OTP Generator</h1>
                </div>
                <p className={styles.tagline}>
                    Generate TOTP codes from your secret keys
                </p>
            </header>

            {/* Main Content - Two Column Layout */}
            <div className={styles.mainGrid}>
                {/* Left Column - Input & Keys */}
                <div className={styles.leftColumn}>
                    {/* Input Section */}
                    <div className={styles.inputSection}>
                        <div className={styles.inputGroup}>
                            <div className={styles.labelRow}>
                                <label>Secret Key (Base32)</label>
                                <button
                                    onClick={handleGenerateRandomSecret}
                                    className={styles.generateButton}
                                    title="Generate random secret"
                                >
                                    <RefreshIcon size={18} />
                                    Generate
                                </button>
                            </div>
                            <input
                                type="text"
                                value={secret}
                                onChange={(e) => {
                                    setSecret(e.target.value);
                                    setActiveKeyId(null);
                                    setError(null);
                                }}
                                placeholder="JBSWY3DPEHPK3PXP"
                                className={styles.secretInput}
                            />
                        </div>

                        {/* Hex Display */}
                        {hexSecret && (
                            <div className={styles.inputGroup}>
                                <div className={styles.labelRow}>
                                    <label>Secret (Hex)</label>
                                    <button
                                        onClick={() => handleCopy(hexSecret, 'hex')}
                                        className={styles.smallCopyButton}
                                    >
                                        {copiedItem === 'hex' ? <CheckIcon size={14} /> : <CopyIcon size={14} />}
                                    </button>
                                </div>
                                <input
                                    type="text"
                                    value={hexSecret}
                                    readOnly
                                    className={styles.hexInput}
                                />
                            </div>
                        )}

                        <div className={styles.inputGroup}>
                            <label>Key Name (optional)</label>
                            <div className={styles.saveRow}>
                                <input
                                    type="text"
                                    value={keyName}
                                    onChange={(e) => setKeyName(e.target.value)}
                                    placeholder="My Account"
                                    className={styles.nameInput}
                                />
                                <button
                                    onClick={handleSaveKey}
                                    className={styles.saveButton}
                                    disabled={!secret.trim() || !isValidBase32(secret)}
                                >
                                    Save
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Error Message */}
                    {error && (
                        <div className={styles.errorMessage}>
                            <AlertIcon size={20} />
                            {error}
                        </div>
                    )}

                    {/* Saved Keys Section */}
                    {hasSavedKeysLocked ? (
                        <div className={styles.savedKeys}>
                            <div className={styles.lockHeader}>
                                <LockIcon size={24} />
                                <h3>Saved Keys (Locked)</h3>
                            </div>
                            <p className={styles.lockNote}>Your saved keys are password protected</p>
                            <button
                                onClick={() => setShowUnlockDialog(true)}
                                className={styles.unlockButton}
                            >
                                <LockIcon size={18} />
                                Unlock Keys
                            </button>
                        </div>
                    ) : (isUnlocked || !storedPasswordHash) && savedKeys.length > 0 ? (
                        <div className={styles.savedKeys}>
                            <h3>Saved Keys</h3>
                            <div className={styles.keysList}>
                                {savedKeys.map(key => (
                                    <div
                                        key={key.id}
                                        className={`${styles.keyItem} ${activeKeyId === key.id ? styles.keyActive : ''}`}
                                    >
                                        <button
                                            onClick={() => handleSelectKey(key)}
                                            className={styles.keySelect}
                                        >
                                            {key.name}
                                        </button>
                                        <button
                                            onClick={() => handleDeleteKey(key.id)}
                                            className={styles.keyDelete}
                                        >
                                            ×
                                        </button>
                                    </div>
                                ))}
                            </div>
                            <div className={styles.keysFooter}>
                                <p className={styles.keysNote}>
                                    <LockIcon size={14} /> Stored locally in browser
                                </p>
                                {!storedPasswordHash && (
                                    <button
                                        onClick={() => setShowSetPasswordDialog(true)}
                                        className={styles.setPasswordBtn}
                                    >
                                        Set Password
                                    </button>
                                )}
                            </div>
                        </div>
                    ) : null}

                    {/* QR Code Section */}
                    {showQRCode && (
                        <div className={styles.qrSection}>
                            <h3>QR Code</h3>
                            <div className={styles.qrContainer}>
                                <canvas ref={qrCanvasRef} className={styles.qrCanvas} />
                            </div>
                            <p className={styles.qrNote}>Scan with authenticator app</p>
                        </div>
                    )}
                </div>

                {/* Right Column - OTP Display & Info */}
                <div className={styles.rightColumn}>
                    {/* OTP Display - Previous/Current/Next */}
                    {otpCodes ? (
                        <div className={styles.otpDisplay}>
                            <div className={styles.otpTriple}>
                                {/* Previous OTP */}
                                <div className={styles.otpColumn}>
                                    <span className={styles.otpLabel}>Previous</span>
                                    <div className={styles.otpCodeSmall}>
                                        {otpCodes.previous}
                                    </div>
                                    <button
                                        onClick={() => handleCopy(otpCodes.previous, 'previous')}
                                        className={styles.smallCopyButton}
                                    >
                                        {copiedItem === 'previous' ? <CheckIcon size={14} /> : <CopyIcon size={14} />}
                                    </button>
                                </div>

                                {/* Current OTP */}
                                <div className={styles.otpColumnMain}>
                                    <span className={styles.otpLabel}>Current</span>
                                    <div className={styles.otpCode}>
                                        {otpCodes.current.split('').map((digit, i) => (
                                            <span key={i} className={styles.otpDigit}>{digit}</span>
                                        ))}
                                    </div>
                                    <button
                                        onClick={() => handleCopy(otpCodes.current, 'current')}
                                        className={styles.copyButton}
                                    >
                                        {copiedItem === 'current' ? (
                                            <>
                                                <CheckIcon size={20} />
                                                Copied!
                                            </>
                                        ) : (
                                            <>
                                                <CopyIcon size={20} />
                                                Copy
                                            </>
                                        )}
                                    </button>
                                </div>

                                {/* Next OTP */}
                                <div className={styles.otpColumn}>
                                    <span className={styles.otpLabel}>Next</span>
                                    <div className={styles.otpCodeSmall}>
                                        {otpCodes.next}
                                    </div>
                                    <button
                                        onClick={() => handleCopy(otpCodes.next, 'next')}
                                        className={styles.smallCopyButton}
                                    >
                                        {copiedItem === 'next' ? <CheckIcon size={14} /> : <CopyIcon size={14} />}
                                    </button>
                                </div>
                            </div>

                            <div className={styles.otpTimer}>
                                <div className={styles.timerBar}>
                                    <div
                                        className={styles.timerFill}
                                        style={{ width: `${progressPercent}%` }}
                                    />
                                </div>
                                <span className={styles.timerText}>{timeRemaining}s</span>
                            </div>
                        </div>
                    ) : (
                        <div className={styles.otpPlaceholder}>
                            <KeyIcon size={64} />
                            <p>Enter a secret key or click Generate to start</p>
                        </div>
                    )}

                    {/* Epoch Info Section */}
                    {epochInfo && otpCodes && (
                        <div className={styles.epochSection}>
                            <div className={styles.epochHeader}>
                                <InfoCircleIcon size={20} />
                                <h3>Technical Info</h3>
                            </div>
                            <div className={styles.epochGrid}>
                                <div className={styles.epochItem}>
                                    <span className={styles.epochLabel}>Epoch</span>
                                    <span className={styles.epochValue}>{epochInfo.epoch}</span>
                                </div>
                                <div className={styles.epochItem}>
                                    <span className={styles.epochLabel}>Iteration</span>
                                    <span className={styles.epochValue}>{epochInfo.iteration}</span>
                                </div>
                                <div className={styles.epochItem}>
                                    <span className={styles.epochLabel}>Iteration (Hex)</span>
                                    <span className={styles.epochValue}>{epochInfo.iterationHex}</span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Footer */}
            <footer className={styles.footer}>
                <a
                    href="https://github.com/pass-with-high-score/check-subdomain"
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.githubLink}
                >
                    <GithubIcon size={24} />
                    GitHub
                </a>
            </footer>

            {/* Unlock Password Dialog */}
            {showUnlockDialog && (
                <div className={styles.dialogOverlay} onClick={closeDialog}>
                    <div className={styles.dialog} onClick={e => e.stopPropagation()}>
                        <button className={styles.dialogClose} onClick={closeDialog}>
                            <XIcon size={24} />
                        </button>
                        <div className={styles.dialogHeader}>
                            <LockIcon size={32} />
                            <h2>Unlock Saved Keys</h2>
                        </div>
                        <p className={styles.dialogText}>Enter your password to access saved keys</p>

                        {dialogError && (
                            <div className={styles.dialogError}>
                                <AlertIcon size={16} />
                                {dialogError}
                            </div>
                        )}

                        <input
                            type="password"
                            value={passwordInput}
                            onChange={(e) => setPasswordInput(e.target.value)}
                            placeholder="Enter password"
                            className={styles.dialogInput}
                            onKeyDown={(e) => e.key === 'Enter' && handleUnlock()}
                            autoFocus
                        />

                        <div className={styles.dialogActions}>
                            <button onClick={handleUnlock} className={styles.dialogPrimary}>
                                Unlock
                            </button>
                            <button onClick={closeDialog} className={styles.dialogSecondary}>
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Set Password Dialog */}
            {showSetPasswordDialog && (
                <div className={styles.dialogOverlay} onClick={closeDialog}>
                    <div className={styles.dialog} onClick={e => e.stopPropagation()}>
                        <button className={styles.dialogClose} onClick={closeDialog}>
                            <XIcon size={24} />
                        </button>
                        <div className={styles.dialogHeader}>
                            <LockIcon size={32} />
                            <h2>Set Password Protection</h2>
                        </div>
                        <p className={styles.dialogText}>Protect your saved keys with a password</p>

                        {dialogError && (
                            <div className={styles.dialogError}>
                                <AlertIcon size={16} />
                                {dialogError}
                            </div>
                        )}

                        <input
                            type="password"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            placeholder="New password (min 4 chars)"
                            className={styles.dialogInput}
                            autoFocus
                        />
                        <input
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="Confirm password"
                            className={styles.dialogInput}
                            onKeyDown={(e) => e.key === 'Enter' && handleSetPassword()}
                        />

                        <div className={styles.dialogActions}>
                            <button onClick={handleSetPassword} className={styles.dialogPrimary}>
                                Set Password
                            </button>
                            <button onClick={closeDialog} className={styles.dialogSecondary}>
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
