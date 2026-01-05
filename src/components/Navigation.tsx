'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { SearchIcon, KeyIcon, ImageIcon, BoltIcon, GithubIcon } from './Icons';
import styles from './Navigation.module.css';

interface NavItem {
    href: string;
    label: string;
    icon: React.ReactNode;
}

const navItems: NavItem[] = [
    { href: '/check-subdomain', label: 'Subdomain', icon: <SearchIcon size={18} /> },
    { href: '/otp', label: 'OTP', icon: <KeyIcon size={18} /> },
    { href: '/base64', label: 'Base64', icon: <ImageIcon size={18} /> },
];

export default function Navigation() {
    const pathname = usePathname();

    return (
        <nav className={styles.nav}>
            <div className={styles.navContainer}>
                <Link href="/" className={styles.brand}>
                    <span className={styles.brandIcon}>
                        <BoltIcon size={24} />
                    </span>
                    <span className={styles.brandText}>DevTools</span>
                </Link>
                <div className={styles.navLinks}>
                    {navItems.map((item) => (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`${styles.navLink} ${pathname === item.href ? styles.active : ''}`}
                        >
                            {item.icon}
                            <span>{item.label}</span>
                        </Link>
                    ))}
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
            </div>
        </nav>
    );
}
