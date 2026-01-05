'use client';

import Link from 'next/link';
import { SearchIcon, KeyIcon, ImageIcon, BoltIcon, ShieldIcon, SmartphoneIcon, GithubIcon } from '@/components/Icons';
import styles from './page.module.css';

interface Tool {
    href: string;
    title: string;
    description: string;
    icon: React.ReactNode;
    color: 'green' | 'cyan' | 'pink' | 'yellow';
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
        </div>
    );
}
