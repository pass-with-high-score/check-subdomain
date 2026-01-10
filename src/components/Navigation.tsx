'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import {
    SearchIcon,
    KeyIcon,
    ImageIcon,
    BoltIcon,
    GithubIcon,
    LinkIcon,
    CodeIcon,
    HourglassIcon,
    ChevronDownIcon,
    UploadIcon,
} from './Icons';
import styles from './Navigation.module.css';

interface NavItem {
    href: string;
    label: string;
    icon: React.ReactNode;
}

// Core tools - always visible
const coreTools: NavItem[] = [
    { href: '/check-subdomain', label: 'Subdomain', icon: <SearchIcon size={18} /> },
    { href: '/otp', label: 'OTP', icon: <KeyIcon size={18} /> },
    { href: '/webhook', label: 'Webhook', icon: <LinkIcon size={18} /> },
    { href: '/json', label: 'JSON', icon: <CodeIcon size={18} /> },
    { href: '/upload', label: 'Upload', icon: <UploadIcon size={18} /> },
];

// More tools - in dropdown on desktop, visible on mobile menu
const moreTools: NavItem[] = [
    { href: '/base64', label: 'Base64', icon: <ImageIcon size={18} /> },
    { href: '/capsule', label: 'Capsule', icon: <HourglassIcon size={18} /> },
    { href: '/aneko-builder', label: 'ANeko', icon: <Image src="/aneko.png" alt="ANeko" width={18} height={18} style={{ imageRendering: 'pixelated' }} /> },
];

// Menu icon for mobile
function MenuIcon({ size = 24 }: { size?: number }) {
    return (
        <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
    );
}

function CloseIcon({ size = 24 }: { size?: number }) {
    return (
        <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
    );
}

export default function Navigation() {
    const pathname = usePathname();
    const [moreOpen, setMoreOpen] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    const isActive = (href: string) => pathname === href || pathname?.startsWith(href + '/');

    const allTools = [...coreTools, ...moreTools];

    return (
        <>
            <nav className={styles.nav}>
                <div className={styles.navContainer}>
                    {/* Brand */}
                    <Link href="/" className={styles.brand}>
                        <span className={styles.brandIcon}>
                            <BoltIcon size={24} />
                        </span>
                        <span className={styles.brandText}>DevTools</span>
                    </Link>

                    {/* Desktop Nav Links */}
                    <div className={styles.navLinks}>
                        {/* Core Tools */}
                        {coreTools.map((item) => (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={`${styles.navLink} ${isActive(item.href) ? styles.active : ''}`}
                            >
                                {item.icon}
                                <span>{item.label}</span>
                            </Link>
                        ))}

                        {/* More Dropdown */}
                        <div className={styles.moreWrapper}>
                            <button
                                className={`${styles.navLink} ${styles.moreButton} ${moreTools.some(t => isActive(t.href)) ? styles.active : ''}`}
                                onClick={() => setMoreOpen(!moreOpen)}
                                onBlur={() => setTimeout(() => setMoreOpen(false), 150)}
                            >
                                <span>More</span>
                                <ChevronDownIcon size={14} />
                            </button>
                            {moreOpen && (
                                <div className={styles.dropdown}>
                                    {moreTools.map((item) => (
                                        <Link
                                            key={item.href}
                                            href={item.href}
                                            className={`${styles.dropdownItem} ${isActive(item.href) ? styles.active : ''}`}
                                            onClick={() => setMoreOpen(false)}
                                        >
                                            {item.icon}
                                            <span>{item.label}</span>
                                        </Link>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* GitHub Link */}
                        <a
                            href="https://github.com/pass-with-high-score/check-subdomain"
                            target="_blank"
                            rel="noopener noreferrer"
                            className={styles.githubLink}
                            title="View on GitHub"
                        >
                            <GithubIcon size={18} />
                        </a>
                    </div>

                    {/* Mobile Menu Button */}
                    <button
                        className={styles.mobileMenuButton}
                        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                        aria-label="Toggle menu"
                    >
                        {mobileMenuOpen ? <CloseIcon size={24} /> : <MenuIcon size={24} />}
                    </button>
                </div>
            </nav>

            {/* Mobile Menu Overlay */}
            {mobileMenuOpen && (
                <div className={styles.mobileOverlay} onClick={() => setMobileMenuOpen(false)}>
                    <div className={styles.mobileMenu} onClick={(e) => e.stopPropagation()}>
                        <div className={styles.mobileMenuHeader}>
                            <span>Tools</span>
                            <button onClick={() => setMobileMenuOpen(false)} className={styles.mobileCloseButton}>
                                <CloseIcon size={20} />
                            </button>
                        </div>
                        <div className={styles.mobileMenuItems}>
                            {allTools.map((item) => (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    className={`${styles.mobileMenuItem} ${isActive(item.href) ? styles.active : ''}`}
                                    onClick={() => setMobileMenuOpen(false)}
                                >
                                    {item.icon}
                                    <span>{item.label}</span>
                                </Link>
                            ))}
                        </div>
                        <a
                            href="https://github.com/pass-with-high-score/check-subdomain"
                            target="_blank"
                            rel="noopener noreferrer"
                            className={styles.mobileGithubLink}
                        >
                            <GithubIcon size={18} />
                            <span>View on GitHub</span>
                        </a>
                    </div>
                </div>
            )}
        </>
    );
}
