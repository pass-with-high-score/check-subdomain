'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { SearchIcon, KeyIcon } from './Icons';
import styles from './Navigation.module.css';

interface NavItem {
    href: string;
    label: string;
    icon: React.ReactNode;
}

const navItems: NavItem[] = [
    { href: '/', label: 'Subdomain Scanner', icon: <SearchIcon size={18} /> },
    { href: '/otp', label: 'OTP Generator', icon: <KeyIcon size={18} /> },
];

export default function Navigation() {
    const pathname = usePathname();

    return (
        <nav className={styles.nav}>
            <div className={styles.navContainer}>
                <div className={styles.brand}>
                    <span className={styles.brandIcon}>⚡</span>
                    <span className={styles.brandText}>DevTools</span>
                </div>
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
                </div>
            </div>
        </nav>
    );
}
