'use client';

import Link from 'next/link';
import { ShieldIcon, InfoIcon, ArrowLeftIcon, LockIcon } from '@/components/Icons';
import styles from './page.module.css';

export default function PolicyPage() {
    return (
        <div className={styles.container}>
            <div className={styles.backgroundGradient}></div>

            <header className={styles.header}>
                <div className={styles.headerContent}>
                    <Link href="/" className={styles.backLink}>
                        <ArrowLeftIcon size={20} />
                        Back to Home
                    </Link>
                    <h1 className={styles.title}>Privacy & Terms</h1>
                </div>
            </header>

            <main className={styles.content}>
                <section className={styles.section}>
                    <h2 className={styles.sectionTitle}>
                        <div className={styles.iconBox}>
                            <ShieldIcon size={24} />
                        </div>
                        Privacy Policy
                    </h2>
                    <p>
                        At DevTools, we prioritize your privacy. We believe that developer tools should be useful without being intrusive.
                    </p>

                    <h3>1. Data Collection</h3>
                    <p>
                        We do not collect, store, or share any personal information. Most of our tools run entirely client-side in your browser.
                    </p>
                    <ul>
                        <li><strong>Subdomain Scanner:</strong> Queries public Certificate Transparency logs. No search history is stored.</li>
                        <li><strong>OTP Generator:</strong> Secrets are stored only in your browser's local storage. We never see your keys.</li>
                        <li><strong>Base64 Converter:</strong> Image processing happens 100% locally. Your files are never uploaded to our servers.</li>
                        <li><strong>JSON Server:</strong> Data you explicitly save is stored in our database to generate a shareable URL. We do not analyze this data.</li>
                        <li><strong>Webhook Tester:</strong> Request data sent to your unique webhook URL is stored temporarily for your inspection. We do not use this data for any other purpose.</li>
                        <li><strong>Image Uploader:</strong> Uploaded images are stored on our servers to generate shareable links. Images may be deleted after a period of inactivity.</li>
                        <li><strong>File Transfer:</strong> Files you upload are stored temporarily on our servers to provide download links. Files are automatically deleted after the expiration time you set.</li>
                        <li><strong>Time Capsule:</strong> Files and messages are encrypted and stored on our servers until the unlock date. After unlocking, data may be deleted after a period of inactivity.</li>
                        <li><strong>ANeko Builder:</strong> All skin editing happens 100% locally in your browser. We do not upload or store any of your skin files.</li>
                        <li><strong>Anonymous Chat:</strong> Messages are stored in our database and kept for a limited time. Random usernames are generated and saved in your browser for session continuity. Chat is public and visible to all users.</li>
                        <li><strong>Speech to Text:</strong> Audio files you upload are temporarily stored on our servers for transcription using Deepgram API. Audio and transcripts are automatically deleted after 1 hour. We do not use your audio for any other purpose.</li>
                    </ul>

                    <h3>2. Analytics</h3>
                    <p>
                        We use Google Analytics to understand how visitors use our website. This helps us improve the user experience. Google Analytics collects anonymized data such as pages visited, time spent, and general location. No personally identifiable information is collected.
                    </p>

                    <h3>3. Local Storage</h3>
                    <p>
                        We use your browser's Local Storage to save your preferences and history for your convenience (e.g., saved OTP keys, chat username, recent JSON bins). You can clear this at any time by clearing your browser cache.
                    </p>
                </section>

                <section className={styles.section}>
                    <h2 className={styles.sectionTitle}>
                        <div className={styles.iconBox}>
                            <LockIcon size={24} />
                        </div>
                        Terms of Service
                    </h2>
                    <p>
                        By using DevTools, you agree to the following simple terms:
                    </p>
                    <ul>
                        <li><strong>Fair Use:</strong> Please do not abuse our public APIs (like the JSON Server) with excessive requests or malicious content.</li>
                        <li><strong>No Warranty:</strong> These tools are provided "as is" without warranty of any kind. Use them at your own risk.</li>
                        <li><strong>Responsibility:</strong> You are responsible for the data you generate, process, or host using our tools.</li>
                    </ul>
                </section>

                <div className={styles.lastUpdated}>
                    Last updated: January 2026
                </div>
            </main>
        </div>
    );
}
