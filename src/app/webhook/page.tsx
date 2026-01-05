'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Navigation from '@/components/Navigation';
import Toast, { useToast } from '@/components/Toast';
import { CopyIcon, CheckIcon, BoltIcon, LinkIcon, ServerIcon, InfoCircleIcon, TrashIcon, PlusIcon } from '@/components/Icons';
import styles from './page.module.css';

const MAX_WEBHOOKS = 10;
const STORAGE_KEY = 'webhook-endpoints';

interface WebhookEndpoint {
    id: string;
    name: string | null;
    url: string;
    created_at: string;
    request_count?: number;
}

export default function WebhookPage() {
    const [endpoints, setEndpoints] = useState<WebhookEndpoint[]>([]);
    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const { toasts, addToast, removeToast } = useToast();
    const router = useRouter();

    // Load and verify endpoints from localStorage
    const loadEndpoints = useCallback(async () => {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (!stored) {
            setLoading(false);
            return;
        }

        try {
            const storedEndpoints = JSON.parse(stored) as WebhookEndpoint[];
            if (!Array.isArray(storedEndpoints) || storedEndpoints.length === 0) {
                setLoading(false);
                return;
            }

            // Verify endpoints exist in database
            const ids = storedEndpoints.map(e => e.id).join(',');
            const response = await fetch(`/api/webhook?ids=${ids}`);

            if (response.ok) {
                const data = await response.json();
                const validEndpoints: WebhookEndpoint[] = data.endpoints.map((e: {
                    id: string;
                    name: string | null;
                    created_at: string;
                    request_count: number;
                }) => ({
                    id: e.id,
                    name: e.name,
                    url: `${window.location.origin}/api/hook/${e.id}`,
                    created_at: e.created_at,
                    request_count: e.request_count,
                }));

                // Update localStorage with only valid endpoints
                if (validEndpoints.length !== storedEndpoints.length) {
                    localStorage.setItem(STORAGE_KEY, JSON.stringify(validEndpoints));
                    if (validEndpoints.length < storedEndpoints.length) {
                        addToast('Some expired webhooks were removed', 'info');
                    }
                }

                setEndpoints(validEndpoints);
            }
        } catch (error) {
            console.error('Error loading endpoints:', error);
            localStorage.removeItem(STORAGE_KEY);
        } finally {
            setLoading(false);
        }
    }, [addToast]);

    useEffect(() => {
        loadEndpoints();
    }, [loadEndpoints]);

    const createEndpoint = async () => {
        if (endpoints.length >= MAX_WEBHOOKS) {
            addToast(`Maximum ${MAX_WEBHOOKS} webhooks reached`, 'error');
            return;
        }

        setCreating(true);
        try {
            const webhookNumber = endpoints.length + 1;
            const response = await fetch('/api/webhook', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: `Webhook #${webhookNumber}` }),
            });

            if (!response.ok) throw new Error('Failed to create endpoint');

            const data = await response.json();
            const newEndpoint: WebhookEndpoint = {
                id: data.id,
                name: data.name,
                url: `${window.location.origin}/api/hook/${data.id}`,
                created_at: data.created_at,
                request_count: 0,
            };

            const updatedEndpoints = [...endpoints, newEndpoint];
            setEndpoints(updatedEndpoints);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedEndpoints));
            addToast('Webhook created', 'success');
        } catch (error) {
            console.error(error);
            addToast('Failed to create webhook', 'error');
        } finally {
            setCreating(false);
        }
    };

    const deleteEndpoint = async (id: string) => {
        try {
            const response = await fetch(`/api/webhook/endpoint/${id}`, { method: 'DELETE' });
            if (!response.ok) throw new Error('Failed to delete');

            const updatedEndpoints = endpoints.filter(e => e.id !== id);
            setEndpoints(updatedEndpoints);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedEndpoints));
            addToast('Webhook deleted', 'success');
        } catch (error) {
            console.error(error);
            addToast('Failed to delete webhook', 'error');
        }
    };

    const copyUrl = async (endpoint: WebhookEndpoint) => {
        await navigator.clipboard.writeText(endpoint.url);
        setCopiedId(endpoint.id);
        addToast('URL copied', 'success');
        setTimeout(() => setCopiedId(null), 2000);
    };

    const viewWebhook = (id: string) => {
        router.push(`/webhook/${id}`);
    };

    const formatTime = (dateStr: string) => {
        const date = new Date(dateStr.endsWith('Z') ? dateStr : dateStr + 'Z');
        const now = new Date();
        const diff = Math.floor((now.getTime() - date.getTime()) / 1000);

        if (diff < 60) return 'Just now';
        if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
        if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
        if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
        return date.toLocaleDateString();
    };

    const canCreateMore = endpoints.length < MAX_WEBHOOKS;

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
                    {endpoints.length > 0
                        ? `Manage your webhook endpoints (${endpoints.length}/${MAX_WEBHOOKS})`
                        : 'Receive and inspect webhook requests in real-time'
                    }
                </p>
            </header>

            <main className={styles.main}>
                {loading ? (
                    <div className={styles.loadingState}>Loading...</div>
                ) : endpoints.length === 0 ? (
                    <div className={styles.emptyState}>
                        <BoltIcon size={64} />
                        <h2>Create a Webhook Endpoint</h2>
                        <p>Get a unique URL to receive and inspect webhook requests.</p>
                        <button
                            onClick={createEndpoint}
                            className={styles.createButton}
                            disabled={creating}
                        >
                            {creating ? 'Creating...' : 'Create Webhook URL'}
                        </button>
                    </div>
                ) : (
                    <>
                        <div className={styles.webhookGrid}>
                            {endpoints.map((endpoint) => (
                                <div key={endpoint.id} className={styles.webhookCard}>
                                    <div className={styles.cardHeader}>
                                        <h3>{endpoint.name || `Webhook`}</h3>
                                        <button
                                            onClick={() => deleteEndpoint(endpoint.id)}
                                            className={styles.deleteButton}
                                            title="Delete webhook"
                                        >
                                            <TrashIcon size={14} />
                                        </button>
                                    </div>
                                    <div className={styles.cardMeta}>
                                        <span>Created {formatTime(endpoint.created_at)}</span>
                                        <span>{endpoint.request_count ?? 0} requests</span>
                                    </div>
                                    <div className={styles.cardUrl}>
                                        <code>{endpoint.url}</code>
                                    </div>
                                    <div className={styles.cardActions}>
                                        <button
                                            onClick={() => viewWebhook(endpoint.id)}
                                            className={styles.viewButton}
                                        >
                                            View Requests
                                        </button>
                                        <button
                                            onClick={() => copyUrl(endpoint)}
                                            className={styles.copyUrlButton}
                                            title="Copy URL"
                                        >
                                            {copiedId === endpoint.id ? <CheckIcon size={16} /> : <CopyIcon size={16} />}
                                        </button>
                                    </div>
                                </div>
                            ))}

                            {/* Create New Card */}
                            {canCreateMore && (
                                <button
                                    onClick={createEndpoint}
                                    className={styles.createCard}
                                    disabled={creating}
                                >
                                    <PlusIcon size={32} />
                                    <span>{creating ? 'Creating...' : 'Create New Webhook'}</span>
                                </button>
                            )}
                        </div>

                        {!canCreateMore && (
                            <p className={styles.limitMessage}>
                                Maximum {MAX_WEBHOOKS} webhooks reached. Delete one to create more.
                            </p>
                        )}
                    </>
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
