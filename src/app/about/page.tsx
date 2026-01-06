'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeftIcon, UsersIcon, CodeIcon, MailIcon, MapPinIcon, StarIcon, GithubIcon, TwitterIcon, TelegramIcon, FacebookIcon, YouTubeIcon, SpinnerIcon } from '@/components/Icons';
import styles from './page.module.css';

interface GitHubOrgData {
    public_repos: number;
    followers: number;
    location: string | null;
    avatar_url: string;
    name: string;
    description: string;
}

export default function AboutPage() {
    const [orgData, setOrgData] = useState<GitHubOrgData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchOrgData() {
            try {
                const response = await fetch('https://api.github.com/orgs/pass-with-high-score');
                if (response.ok) {
                    const data = await response.json();
                    setOrgData(data);
                }
            } catch (error) {
                console.error('Failed to fetch GitHub org data:', error);
            } finally {
                setLoading(false);
            }
        }
        fetchOrgData();
    }, []);

    return (
        <div className={styles.container}>
            <div className={styles.backgroundGradient}></div>

            <header className={styles.header}>
                <div className={styles.headerContent}>
                    <Link href="/" className={styles.backLink}>
                        <ArrowLeftIcon size={20} />
                        Back to Home
                    </Link>
                    <h1 className={styles.title}>About Us</h1>
                </div>
            </header>

            <main className={styles.content}>
                {/* Hero Section */}
                <section className={styles.heroSection}>
                    <div className={styles.logoBox}>
                        <Image
                            src={orgData?.avatar_url || "https://avatars.githubusercontent.com/u/173918919?s=200&v=4"}
                            alt="Pass With High Score Logo"
                            width={80}
                            height={80}
                            style={{ borderRadius: '4px' }}
                        />
                    </div>
                    <h2 className={styles.heroTitle}>{orgData?.name || "We Are A Team!"}</h2>
                    <p className={styles.heroTagline}>
                        {orgData?.description || "We make applications for us and everyone!"} Building useful tools to help developers work more efficiently.
                    </p>
                </section>

                {/* Team Section */}
                <section className={styles.section}>
                    <h2 className={styles.sectionTitle}>
                        <div className={`${styles.iconBox} ${styles.iconBoxCyan}`}>
                            <UsersIcon size={24} />
                        </div>
                        Our Team
                    </h2>
                    <p>
                        We are <strong>pass-with-high-score</strong>, a team of passionate developers based in Vietnam.
                        We build open-source applications and tools that we use ourselves and share with the community.
                    </p>

                    <div className={styles.statsGrid}>
                        <div className={styles.statCard}>
                            <span className={styles.statNumber}>
                                {loading ? <SpinnerIcon size={24} className={styles.spinner} /> : (orgData?.public_repos || 42)}
                            </span>
                            <span className={styles.statLabel}>Repositories</span>
                        </div>
                        <div className={styles.statCard}>
                            <span className={styles.statNumber}>
                                {loading ? <SpinnerIcon size={24} className={styles.spinner} /> : (orgData?.followers || 18)}
                            </span>
                            <span className={styles.statLabel}>Followers</span>
                        </div>
                        <div className={styles.statCard}>
                            <span className={styles.statNumber}>🇻🇳</span>
                            <span className={styles.statLabel}>{orgData?.location || "Vietnam"}</span>
                        </div>
                    </div>

                    <a
                        href="https://github.com/pass-with-high-score"
                        target="_blank"
                        rel="noopener noreferrer"
                        className={styles.socialLink}
                    >
                        <GithubIcon size={18} />
                        View on GitHub
                    </a>
                </section>

                {/* Developer Section */}
                <section className={styles.section}>
                    <h2 className={styles.sectionTitle}>
                        <div className={`${styles.iconBox} ${styles.iconBoxPink}`}>
                            <CodeIcon size={24} />
                        </div>
                        Meet the Developer
                    </h2>

                    <div className={styles.developerCard}>
                        <div className={styles.avatarBox}>
                            <Image
                                src="https://avatars.githubusercontent.com/u/94773751?v=4"
                                alt="Nguyễn Quang Minh"
                                width={112}
                                height={112}
                                style={{ borderRadius: '4px' }}
                            />
                        </div>
                        <div className={styles.developerInfo}>
                            <h3 className={styles.developerName}>Nguyễn Quang Minh (NQM)</h3>
                            <p className={styles.developerRole}>Mobile Developer @ Newwave Solutions</p>
                            <p className={styles.developerLocation}>
                                <MapPinIcon size={16} />
                                Phu Tho, Vietnam
                            </p>
                            <p className={styles.developerBio}>
                                I am Minh, a mobile developer focused on creating efficient, well-designed applications.
                                I have a personal interest in animation, as well as nature-related topics such as animals and plants.
                                I welcome opportunities for professional connection and collaboration.
                            </p>
                            <div className={styles.socialLinks}>
                                <a
                                    href="https://github.com/nqmgaming"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className={styles.socialLink}
                                >
                                    <GithubIcon size={16} />
                                    GitHub
                                </a>
                                <a
                                    href="https://twitter.com/nqm_gaming"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className={styles.socialLink}
                                >
                                    <TwitterIcon size={16} />
                                    Twitter
                                </a>
                                <a
                                    href="https://t.me/nqmgaming"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className={styles.socialLink}
                                >
                                    <TelegramIcon size={16} />
                                    Telegram
                                </a>
                                <a
                                    href="https://facebook.com/nqmgaming.1207"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className={styles.socialLink}
                                >
                                    <FacebookIcon size={16} />
                                    Facebook
                                </a>
                                <a
                                    href="https://www.youtube.com/@nqmgaming2004"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className={styles.socialLink}
                                >
                                    <YouTubeIcon size={16} />
                                    YouTube
                                </a>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Projects Section */}
                <section className={styles.section}>
                    <h2 className={styles.sectionTitle}>
                        <div className={`${styles.iconBox} ${styles.iconBoxGreen}`}>
                            <StarIcon size={24} />
                        </div>
                        Featured Projects
                    </h2>

                    <div className={styles.projectsGrid}>
                        <a
                            href="https://github.com/pass-with-high-score/ANeko"
                            target="_blank"
                            rel="noopener noreferrer"
                            className={styles.projectCard}
                        >
                            <div className={styles.projectHeader}>
                                <Image
                                    src="https://play-lh.googleusercontent.com/5Bv4O2z_vAtHgbLEGyzComupwQ3ZO6WO_Vaq_phV_PaCx0uj22hnWjfyMWmqkkdyyjnz=w240-h480-rw"
                                    alt="ANeko Reborn"
                                    width={48}
                                    height={48}
                                    className={styles.projectLogo}
                                />
                                <h3 className={styles.projectName}>ANeko Reborn</h3>
                            </div>
                            <p className={styles.projectDesc}>
                                A modern version of the classic ANeko app. Features a cute cat animation that follows your finger on the Android screen!
                            </p>
                            <div className={styles.projectMeta}>
                                <span className={styles.projectLang}>
                                    <span className={`${styles.langDot} ${styles.kotlin}`}></span>
                                    Kotlin
                                </span>
                                <span style={{ display: "flex", alignItems: "center" }}>
                                    <StarIcon size={16} /> 414
                                </span>
                            </div>
                        </a>

                        <a
                            href="https://github.com/pass-with-high-score/quickmem-app"
                            target="_blank"
                            rel="noopener noreferrer"
                            className={styles.projectCard}
                        >
                            <div className={styles.projectHeader}>
                                <Image
                                    src="https://play-lh.googleusercontent.com/Scg-Z1seCrYmrXbMBWTcJPqa1bj3jDJv8F9RE7ejne9LQP4nQjy9yYCgd1xWvuval3M=w240-h480-rw"
                                    alt="QuickMem"
                                    width={48}
                                    height={48}
                                    className={styles.projectLogo}
                                />
                                <h3 className={styles.projectName}>QuickMem</h3>
                            </div>
                            <p className={styles.projectDesc}>
                                An Android application designed to help users learn efficiently through flashcards, similar to Quizlet.
                            </p>
                            <div className={styles.projectMeta}>
                                <span className={styles.projectLang}>
                                    <span className={`${styles.langDot} ${styles.kotlin}`}></span>
                                    Kotlin
                                </span>
                                <span style={{ display: "flex", alignItems: "center" }}>
                                    <StarIcon size={16} /> 9
                                </span>
                            </div>
                        </a>
                    </div>
                </section>

                {/* Contact Section */}
                <section className={styles.section}>
                    <h2 className={styles.sectionTitle}>
                        <div className={styles.iconBox}>
                            <MailIcon size={24} />
                        </div>
                        Get in Touch
                    </h2>

                    <div className={styles.contactInfo}>
                        <p style={{ marginBottom: '1.5rem' }}>
                            Have questions, feedback, or just want to say hi? We'd love to hear from you!
                        </p>
                        <a
                            href="mailto:nguyenquangminh570@gmail.com"
                            className={styles.contactEmail}
                        >
                            <MailIcon size={20} />
                            nguyenquangminh570@gmail.com
                        </a>
                    </div>
                </section>
            </main>
        </div>
    );
}
