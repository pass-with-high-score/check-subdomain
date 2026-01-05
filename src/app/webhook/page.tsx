'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Navigation from '@/components/Navigation';
import Toast, { useToast } from '@/components/Toast';
import { CopyIcon, CheckIcon, RefreshIcon, BoltIcon, LinkIcon, ServerIcon, InfoCircleIcon } from '@/components/Icons';
import styles from './page.module.css';

interface WebhookEndpoint {
    id: string;
    url: string;
    created_at: string;
}

export default function WebhookPage() {
    const [endpoint, setEndpoint] = useState<WebhookEndpoint | null>(null);
    const [loading, setLoading] = useState(false);
    const [copied, setCopied] = useState(false);
    const { toasts, addToast, removeToast } = useToast();
    const router = useRouter();

    // Verify stored endpoint exists in database, create new if not
    const verifyAndCreateEndpoint = useCallback(async (storedEndpoint: WebhookEndpoint) => {
        try {
            // Check if endpoint still exists in database
            const response = await fetch(`/api/webhook?id=${storedEndpoint.id}`);
            if (response.ok) {
                // Endpoint exists, use it
                setEndpoint(storedEndpoint);
            } else {
                // Endpoint not found in DB, clear localStorage and create new
                localStorage.removeItem('webhook-endpoint');
                addToast('Previous endpoint expired, creating new one...', 'info');

                // Create new endpoint
                const createResponse = await fetch('/api/webhook', { method: 'POST' });
                if (createResponse.ok) {
                    const data = await createResponse.json();
                    const newEndpoint: WebhookEndpoint = {
                        id: data.id,
                        url: `${window.location.origin}/api/hook/${data.id}`,
                        created_at: data.created_at,
                    };
                    setEndpoint(newEndpoint);
                    localStorage.setItem('webhook-endpoint', JSON.stringify(newEndpoint));
                    addToast('New webhook endpoint created', 'success');
                }
            }
        } catch (error) {
            console.error('Error verifying endpoint:', error);
            localStorage.removeItem('webhook-endpoint');
        }
    }, [addToast]);

    // Check for stored endpoint on mount
    useEffect(() => {
        const stored = localStorage.getItem('webhook-endpoint');
        if (stored) {
            try {
                const storedEndpoint = JSON.parse(stored) as WebhookEndpoint;
                verifyAndCreateEndpoint(storedEndpoint);
            } catch {
                localStorage.removeItem('webhook-endpoint');
            }
        }
    }, [verifyAndCreateEndpoint]);

    const createEndpoint = useCallback(async () => {
        setLoading(true);
        try {
            const response = await fetch('/api/webhook', { method: 'POST' });
            if (!response.ok) throw new Error('Failed to create endpoint');

            const data = await response.json();
            const newEndpoint: WebhookEndpoint = {
                id: data.id,
                url: `${window.location.origin}/api/hook/${data.id}`,
                created_at: data.created_at,
            };

            setEndpoint(newEndpoint);
            localStorage.setItem('webhook-endpoint', JSON.stringify(newEndpoint));
            addToast('New webhook endpoint created', 'success');
        } catch (error) {
            console.error(error);
            addToast('Failed to create endpoint', 'error');
        } finally {
            setLoading(false);
        }
    }, [addToast]);

    const copyUrl = async () => {
        if (!endpoint) return;
        await navigator.clipboard.writeText(endpoint.url);
        setCopied(true);
        addToast('URL copied to clipboard', 'success');
        setTimeout(() => setCopied(false), 2000);
    };

    const viewRequests = () => {
        if (!endpoint) return;
        router.push(`/webhook/${endpoint.id}`);
    };

    return (
        <div className={styles.container}>
            <div className={styles.backgroundGradient}></div>

            <Toast toasts={toasts} removeToast={removeToast} />
            <Navigation />

            <header className={styles.header}>
                <div className={styles.logo}>
                    <span className={styles.logoIcon}>
                        <BoltIcon size={32} />
                    </span>
                    <h1>Webhook Tester</h1>
                </div>
                <p className={styles.tagline}>
                    Receive and inspect webhook requests in real-time
                </p>
            </header>

            <main className={styles.main}>
                {endpoint ? (
                    <div className={styles.endpointCard}>
                        <h2>Your Webhook URL</h2>
                        <div className={styles.urlBox}>
                            <input
                                type="text"
                                value={endpoint.url}
                                readOnly
                                className={styles.urlInput}
                            />
                            <button onClick={copyUrl} className={styles.copyButton}>
                                {copied ? <CheckIcon size={20} /> : <CopyIcon size={20} />}
                            </button>
                        </div>
                        <p className={styles.hint}>
                            Send any HTTP request to this URL to capture it.
                        </p>
                        <div className={styles.actions}>
                            <button onClick={viewRequests} className={styles.primaryButton}>
                                View Requests
                            </button>
                            <button onClick={createEndpoint} className={styles.secondaryButton} disabled={loading}>
                                <RefreshIcon size={18} />
                                New URL
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className={styles.emptyState}>
                        <BoltIcon size={64} />
                        <h2>Create a Webhook Endpoint</h2>
                        <p>Get a unique URL to receive and inspect webhook requests.</p>
                        <button
                            onClick={createEndpoint}
                            className={styles.createButton}
                            disabled={loading}
                        >
                            {loading ? 'Creating...' : 'Create Webhook URL'}
                        </button>
                    </div>
                )}

                <div className={styles.features}>
                    <div className={styles.feature}>
                        <div className={styles.featureIcon}>
                            <LinkIcon size={24} />
                        </div>
                        <h3>Unique URL</h3>
                        <p>Each endpoint gets a unique URL that expires after 7 days of inactivity</p>
                    </div>
                    <div className={styles.feature}>
                        <div className={styles.featureIcon}>
                            <ServerIcon size={24} />
                        </div>
                        <h3>All Methods</h3>
                        <p>Receive GET, POST, PUT, PATCH, DELETE requests</p>
                    </div>
                    <div className={styles.feature}>
                        <div className={styles.featureIcon}>
                            <InfoCircleIcon size={24} />
                        </div>
                        <h3>Full Details</h3>
                        <p>View headers, body, query params for each request</p>
                    </div>
                </div>
            </main>
        </div>
    );
}
