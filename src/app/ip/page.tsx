'use client';

import { useState, useEffect, useRef } from 'react';
import Navigation from '@/components/Navigation';
import Toast, { useToast } from '@/components/Toast';
import styles from './page.module.css';
import 'mapbox-gl/dist/mapbox-gl.css';

interface IPInfo {
    ip: { ip: string };
    asn: { number: number; org: string };
    location: {
        city: string;
        region: string;
        country: string;
        country_code: string;
        timezone: string;
        latitude: number;
        longitude: number;
        country_flag: string;
    };
}

const MAPBOX_TOKEN = 'pk.eyJ1IjoibnFtZ2FtaW5nIiwiYSI6ImNseW83Nm83djBlOTAyaXE0YmF3bG1wbHkifQ.kqT_oTn3KX4wVx8foMkabQ';

export default function IPCheckerPage() {
    const [ipInfo, setIpInfo] = useState<IPInfo | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const { toasts, addToast, removeToast } = useToast();
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<mapboxgl.Map | null>(null);

    useEffect(() => {
        async function fetchIP() {
            try {
                const res = await fetch('https://checkip.pwhs.app/');
                if (!res.ok) throw new Error('Failed to fetch IP info');
                const data = await res.json();
                setIpInfo(data);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Unknown error');
            } finally {
                setLoading(false);
            }
        }
        fetchIP();
    }, []);

    useEffect(() => {
        if (!ipInfo || !mapContainerRef.current || mapRef.current) return;

        // Dynamically import mapbox-gl
        import('mapbox-gl').then((mapboxgl) => {
            mapboxgl.default.accessToken = MAPBOX_TOKEN;

            const map = new mapboxgl.default.Map({
                container: mapContainerRef.current!,
                style: 'mapbox://styles/mapbox/dark-v11',
                center: [ipInfo.location.longitude, ipInfo.location.latitude],
                zoom: 10,
            });

            // Add marker
            new mapboxgl.default.Marker({ color: '#FF0000' })
                .setLngLat([ipInfo.location.longitude, ipInfo.location.latitude])
                .addTo(map);

            mapRef.current = map;
        });

        return () => {
            mapRef.current?.remove();
            mapRef.current = null;
        };
    }, [ipInfo]);

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        addToast('Copied to clipboard!', 'success');
    };

    return (
        <div className={styles.container}>
            <div className={styles.backgroundGradient}></div>
            <Navigation />

            <main className={styles.main}>
                <div className={styles.header}>
                    <h1 className={styles.title}>IP Address Checker</h1>
                    <p className={styles.subtitle}>View your public IP address and location</p>
                </div>

                {loading ? (
                    <div className={styles.loading}>
                        <div className={styles.spinner}></div>
                        <p>Detecting your IP...</p>
                    </div>
                ) : error ? (
                    <div className={styles.error}>
                        <p>Error: {error}</p>
                        <button onClick={() => window.location.reload()} className={styles.retryBtn}>
                            Retry
                        </button>
                    </div>
                ) : ipInfo && (
                    <div className={styles.content}>
                        {/* IP Address Card */}
                        <div className={styles.ipCard}>
                            <div className={styles.ipLabel}>Your IP Address</div>
                            <div className={styles.ipValue}>
                                {ipInfo.ip.ip}
                                <button
                                    className={styles.copyBtn}
                                    onClick={() => copyToClipboard(ipInfo.ip.ip)}
                                    title="Copy to clipboard"
                                >
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                                    </svg>
                                </button>
                            </div>
                        </div>

                        <div className={styles.grid}>
                            {/* Location Info */}
                            <div className={styles.infoCard}>
                                <div className={styles.cardHeader}>
                                    <img
                                        src={ipInfo.location.country_flag}
                                        alt={ipInfo.location.country_code}
                                        className={styles.flag}
                                    />
                                    <h3>Location</h3>
                                </div>
                                <div className={styles.infoRow}>
                                    <span className={styles.label}>City</span>
                                    <span className={styles.value}>{ipInfo.location.city}</span>
                                </div>
                                <div className={styles.infoRow}>
                                    <span className={styles.label}>Region</span>
                                    <span className={styles.value}>{ipInfo.location.region}</span>
                                </div>
                                <div className={styles.infoRow}>
                                    <span className={styles.label}>Country</span>
                                    <span className={styles.value}>{ipInfo.location.country}</span>
                                </div>
                                <div className={styles.infoRow}>
                                    <span className={styles.label}>Timezone</span>
                                    <span className={styles.value}>{ipInfo.location.timezone}</span>
                                </div>
                                <div className={styles.infoRow}>
                                    <span className={styles.label}>Coordinates</span>
                                    <span className={styles.value}>
                                        {ipInfo.location.latitude.toFixed(4)}, {ipInfo.location.longitude.toFixed(4)}
                                    </span>
                                </div>
                            </div>

                            {/* Network Info */}
                            <div className={styles.infoCard}>
                                <div className={styles.cardHeader}>
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <circle cx="12" cy="12" r="10" />
                                        <line x1="2" y1="12" x2="22" y2="12" />
                                        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                                    </svg>
                                    <h3>Network</h3>
                                </div>
                                <div className={styles.infoRow}>
                                    <span className={styles.label}>ASN</span>
                                    <span className={styles.value}>AS{ipInfo.asn.number}</span>
                                </div>
                                <div className={styles.infoRow}>
                                    <span className={styles.label}>ISP</span>
                                    <span className={styles.value}>{ipInfo.asn.org}</span>
                                </div>
                            </div>
                        </div>

                        {/* Map */}
                        <div className={styles.mapContainer}>
                            <div ref={mapContainerRef} className={styles.map}></div>
                        </div>
                    </div>
                )}
            </main>
            <Toast toasts={toasts} removeToast={removeToast} />
        </div>
    );
}
