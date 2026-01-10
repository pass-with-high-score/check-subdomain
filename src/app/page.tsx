'use client';

import Link from 'next/link';
import Image from 'next/image';
import { SearchIcon, KeyIcon, ImageIcon, BoltIcon, ShieldIcon, SmartphoneIcon, GithubIcon, LinkIcon, CodeIcon, HourglassIcon, UploadIcon, FileIcon } from '@/components/Icons';
import ChatWidget from '@/components/ChatWidget';
import styles from './page.module.css';

// Note: metadata must be exported from a server component
// For client components, we rely on the parent layout's metadata

interface Tool {
    href: string;
    title: string;
    description: string;
    icon: React.ReactNode;
    color: 'green' | 'cyan' | 'pink' | 'yellow' | 'orange';
}

const tools: Tool[] = [
    {
        href: '/check-subdomain',
        title: 'Subdomain Scanner',
        description: 'Discover subdomains using Certificate Transparency logs, resolve DNS, and detect Cloudflare protection.',
        icon: <SearchIcon size={32} />,
        color: 'green',
    },
    {
        href: '/otp',
        title: 'OTP Generator',
        description: 'Generate TOTP codes with support for saving keys, password protection, and QR code export.',
        icon: <KeyIcon size={32} />,
        color: 'cyan',
    },
    {
        href: '/base64',
        title: 'Base64 Image',
        description: 'View Base64 encoded images or convert images to Base64 strings with drag & drop.',
        icon: <ImageIcon size={32} />,
        color: 'pink',
    },
    {
        href: '/webhook',
        title: 'Webhook Tester',
        description: 'Receive and inspect webhook requests in real-time from any service.',
        icon: <LinkIcon size={32} />,
        color: 'yellow',
    },
    {
        href: '/json',
        title: 'JSON Server',
        description: 'Host, validate, and share JSON data. Create mock APIs with persistent storage.',
        icon: <CodeIcon size={32} />,
        color: 'orange',
    },
    {
        href: '/upload',
        title: 'Image Uploader',
        description: 'Upload images and get shareable links. Drag & drop or paste from clipboard.',
        icon: <UploadIcon size={32} />,
        color: 'cyan',
    },
    {
        href: '/transfer',
        title: 'File Transfer',
        description: 'Share any file with download link. Like WeTransfer, but simpler.',
        icon: <FileIcon size={32} />,
        color: 'pink',
    },
    {
        href: '/capsule',
        title: 'Time Capsule',
        description: 'Upload files and lock them for a set time. Download only after the unlock date.',
        icon: <HourglassIcon size={32} />,
        color: 'orange',
    },
    {
        href: '/aneko-builder',
        title: 'ANeko Builder',
        description: 'Create custom skins for ANeko Reborn Android pet app with visual animation editor.',
        icon: <Image src="/aneko.png" alt="ANeko" width={32} height={32} style={{ imageRendering: 'smooth' }} />,
        color: 'yellow',
    },
];

export default function HomePage() {
    return (
        <div className={styles.container}>
            {/* Background */}
            <div className={styles.backgroundGradient}></div>

            {/* Hero Section */}
            <header className={styles.hero}>
                <div className={styles.heroContent}>
                    <div className={styles.logoBox}>
                        <BoltIcon size={48} />
                    </div>
                    <h1 className={styles.heroTitle}>
                        DevTools
                    </h1>
                    <p className={styles.heroTagline}>
                        Free online tools for developers
                    </p>
                    <p className={styles.heroDescription}>
                        A collection of useful utilities to simplify your development workflow.
                        No signup required. 100% client-side processing.
                    </p>
                    <a
                        href="https://github.com/pass-with-high-score/check-subdomain"
                        target="_blank"
                        rel="noopener noreferrer"
                        className={styles.githubButton}
                    >
                        <GithubIcon size={20} />
                        View on GitHub
                    </a>
                </div>
            </header>

            {/* Tools Grid */}
            <section className={styles.toolsSection}>
                <h2 className={styles.sectionTitle}>Available Tools</h2>
                <div className={styles.toolsGrid}>
                    {tools.map((tool) => (
                        <Link
                            key={tool.href}
                            href={tool.href}
                            className={`${styles.toolCard} ${styles[tool.color]}`}
                        >
                            <div className={styles.toolIcon}>
                                {tool.icon}
                            </div>
                            <div className={styles.toolInfo}>
                                <h3>{tool.title}</h3>
                                <p>{tool.description}</p>
                            </div>
                            <div className={styles.toolArrow}>→</div>
                        </Link>
                    ))}
                </div>
            </section>

            {/* Features Section */}
            <section className={styles.featuresSection}>
                <div className={styles.featuresList}>
                    <div className={styles.feature}>
                        <span className={styles.featureIcon}>
                            <BoltIcon size={28} />
                        </span>
                        <div>
                            <h4>Fast & Free</h4>
                            <p>All tools are free to use with no rate limits</p>
                        </div>
                    </div>
                    <div className={styles.feature}>
                        <span className={styles.featureIcon}>
                            <ShieldIcon size={28} />
                        </span>
                        <div>
                            <h4>Privacy First</h4>
                            <p>Data stays in your browser, nothing sent to servers</p>
                        </div>
                    </div>
                    <div className={styles.feature}>
                        <span className={styles.featureIcon}>
                            <SmartphoneIcon size={28} />
                        </span>
                        <div>
                            <h4>Mobile Ready</h4>
                            <p>Works on any device with a modern browser</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Chat Section */}
            <section className={styles.chatSection}>
                <h2 className={styles.chatSectionTitle}>Community Chat</h2>
                <p className={styles.chatSectionSubtitle}>Say hi to other developers!</p>
                <ChatWidget />
            </section>

            {/* Footer */}
            <footer className={styles.footer}>
                <div className={styles.footerLinks}>
                    <p>© 2026 DevTools. Open Source.</p>
                    <div style={{ display: 'flex', gap: '1.5rem' }}>
                        <Link href="/about" className={styles.policyLink}>
                            About
                        </Link>
                        <Link href="/policy" className={styles.policyLink}>
                            Privacy & Terms
                        </Link>
                    </div>
                </div>
            </footer>
        </div>
    );
}
