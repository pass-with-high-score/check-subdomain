'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Navigation from '@/components/Navigation';
import Toast, { useToast } from '@/components/Toast';
import { CopyIcon, CheckIcon, BoltIcon, LinkIcon, ServerIcon, InfoCircleIcon, TrashIcon, PlusIcon, PencilIcon, SettingsIcon, ClockIcon, AlertCircleIcon } from '@/components/Icons';
import styles from './page.module.css';

const MAX_WEBHOOKS = 10;
const STORAGE_KEY = 'webhook-endpoints';

interface WebhookEndpoint {
    id: string;
    name: string | null;
    url: string;
    created_at: string;
    request_count?: number;
    response_delay_ms?: number;
    response_status_code?: number;
}

const STATUS_CODE_OPTIONS = [
    { value: 200, label: '200 - OK', category: 'success' },
    { value: 201, label: '201 - Created', category: 'success' },
    { value: 400, label: '400 - Bad Request', category: 'error' },
    { value: 401, label: '401 - Unauthorized', category: 'error' },
    { value: 403, label: '403 - Forbidden', category: 'error' },
    { value: 404, label: '404 - Not Found', category: 'error' },
    { value: 429, label: '429 - Too Many Requests', category: 'error' },
    { value: 500, label: '500 - Internal Server Error', category: 'error' },
    { value: 502, label: '502 - Bad Gateway', category: 'error' },
    { value: 503, label: '503 - Service Unavailable', category: 'error' },
    { value: 504, label: '504 - Gateway Timeout', category: 'error' },
];

export default function WebhookPage() {
    const [endpoints, setEndpoints] = useState<WebhookEndpoint[]>([]);
    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);
    const [copiedId, setCopiedId] = useState<string | null>(null);
    // Name Dialog State
    const [showNameDialog, setShowNameDialog] = useState(false);
    const [editingWebhook, setEditingWebhook] = useState<WebhookEndpoint | null>(null);
    const [nameInput, setNameInput] = useState('');
    // Test Options Dialog State
    const [showTestOptionsDialog, setShowTestOptionsDialog] = useState(false);
    const [editingTestOptions, setEditingTestOptions] = useState<WebhookEndpoint | null>(null);
    const [delayInput, setDelayInput] = useState(0);
    const [statusCodeInput, setStatusCodeInput] = useState(200);
    const [savingTestOptions, setSavingTestOptions] = useState(false);
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
                    response_delay_ms?: number;
                    response_status_code?: number;
                }) => ({
                    id: e.id,
                    name: e.name,
                    url: `${window.location.origin}/api/hook/${e.id}`,
                    created_at: e.created_at,
                    request_count: e.request_count,
                    response_delay_ms: e.response_delay_ms || 0,
                    response_status_code: e.response_status_code || 200,
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

    const openCreateDialog = () => {
        if (endpoints.length >= MAX_WEBHOOKS) {
            addToast(`Maximum ${MAX_WEBHOOKS} webhooks reached`, 'error');
            return;
        }
        setEditingWebhook(null);
        setNameInput(`Webhook #${endpoints.length + 1}`);
        setShowNameDialog(true);
    };

    const openRenameDialog = (webhook: WebhookEndpoint) => {
        setEditingWebhook(webhook);
        setNameInput(webhook.name || `Webhook`);
        setShowNameDialog(true);
    };

    const handleNameSubmit = async () => {
        if (!nameInput.trim()) {
            addToast('Name cannot be empty', 'error');
            return;
        }
        setShowNameDialog(false);

        if (editingWebhook) {
            await renameEndpoint(editingWebhook.id, nameInput.trim());
        } else {
            await createEndpoint(nameInput.trim());
        }
    };

    const renameEndpoint = async (id: string, newName: string) => {
        try {
            const response = await fetch(`/api/webhook/endpoint/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newName }),
            });

            if (!response.ok) throw new Error('Failed to rename endpoint');

            const updatedEndpoints = endpoints.map(e =>
                e.id === id ? { ...e, name: newName } : e
            );
            setEndpoints(updatedEndpoints);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedEndpoints));
            addToast('Webhook renamed', 'success');
        } catch (error) {
            console.error(error);
            addToast('Failed to rename webhook', 'error');
        }
    };

    const createEndpoint = async (name: string) => {
        if (endpoints.length >= MAX_WEBHOOKS) {
            addToast(`Maximum ${MAX_WEBHOOKS} webhooks reached`, 'error');
            return;
        }

        setCreating(true);
        try {
            const response = await fetch('/api/webhook', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: name || `Webhook #${endpoints.length + 1}` }),
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

    // Test Options Handlers
    const openTestOptionsDialog = (webhook: WebhookEndpoint) => {
        setEditingTestOptions(webhook);
        setDelayInput(webhook.response_delay_ms || 0);
        setStatusCodeInput(webhook.response_status_code || 200);
        setShowTestOptionsDialog(true);
    };

    const handleTestOptionsSubmit = async () => {
        if (!editingTestOptions) return;

        setSavingTestOptions(true);
        try {
            const response = await fetch(`/api/webhook/endpoint/${editingTestOptions.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    response_delay_ms: delayInput,
                    response_status_code: statusCodeInput,
                }),
            });

            if (!response.ok) throw new Error('Failed to update test options');

            const updatedEndpoints = endpoints.map(e =>
                e.id === editingTestOptions.id
                    ? { ...e, response_delay_ms: delayInput, response_status_code: statusCodeInput }
                    : e
            );
            setEndpoints(updatedEndpoints);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedEndpoints));
            addToast('Test options updated', 'success');
            setShowTestOptionsDialog(false);
        } catch (error) {
            console.error(error);
            addToast('Failed to update test options', 'error');
        } finally {
            setSavingTestOptions(false);
        }
    };

    const hasActiveTestOptions = (endpoint: WebhookEndpoint) => {
        return (endpoint.response_delay_ms && endpoint.response_delay_ms > 0) ||
            (endpoint.response_status_code && endpoint.response_status_code !== 200);
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
                            onClick={openCreateDialog}
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
                                        <div className={styles.nameWrapper}>
                                            <h3>{endpoint.name || `Webhook`}</h3>
                                            <button
                                                onClick={() => openRenameDialog(endpoint)}
                                                className={styles.renameButton}
                                                title="Rename webhook"
                                            >
                                                <PencilIcon size={14} />
                                            </button>
                                        </div>
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

                                    {/* Test Options Row */}
                                    <div className={styles.testOptionsRow}>
                                        <button
                                            onClick={() => openTestOptionsDialog(endpoint)}
                                            className={`${styles.testOptionsButton} ${hasActiveTestOptions(endpoint) ? styles.testOptionsActive : ''}`}
                                            title="Configure test options"
                                        >
                                            <SettingsIcon size={14} />
                                            <span>Test Options</span>
                                        </button>
                                        {hasActiveTestOptions(endpoint) && (
                                            <div className={styles.testOptionsBadges}>
                                                {endpoint.response_delay_ms && endpoint.response_delay_ms > 0 && (
                                                    <span className={styles.delayBadge}>
                                                        <ClockIcon size={12} />
                                                        {endpoint.response_delay_ms >= 1000
                                                            ? `${(endpoint.response_delay_ms / 1000).toFixed(1)}s`
                                                            : `${endpoint.response_delay_ms}ms`
                                                        }
                                                    </span>
                                                )}
                                                {endpoint.response_status_code && endpoint.response_status_code !== 200 && (
                                                    <span className={`${styles.statusBadge} ${endpoint.response_status_code >= 400 ? styles.statusError : ''}`}>
                                                        <AlertCircleIcon size={12} />
                                                        {endpoint.response_status_code}
                                                    </span>
                                                )}
                                            </div>
                                        )}
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
                                    onClick={openCreateDialog}
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

            {/* Name/Rename Dialog */}
            {showNameDialog && (
                <div className={styles.dialogOverlay} onClick={() => setShowNameDialog(false)}>
                    <div className={styles.dialog} onClick={e => e.stopPropagation()}>
                        <h3>{editingWebhook ? 'Rename Webhook' : 'Create New Webhook'}</h3>
                        <input
                            type="text"
                            value={nameInput}
                            onChange={(e) => setNameInput(e.target.value)}
                            className={styles.dialogInput}
                            placeholder="Enter webhook name"
                            autoFocus
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') handleNameSubmit();
                                if (e.key === 'Escape') setShowNameDialog(false);
                            }}
                        />
                        <div className={styles.dialogActions}>
                            <button
                                onClick={() => setShowNameDialog(false)}
                                className={styles.cancelButton}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleNameSubmit}
                                className={styles.confirmButton}
                            >
                                {editingWebhook ? 'Save' : 'Create'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Test Options Dialog */}
            {showTestOptionsDialog && editingTestOptions && (
                <div className={styles.dialogOverlay} onClick={() => setShowTestOptionsDialog(false)}>
                    <div className={styles.testOptionsDialog} onClick={e => e.stopPropagation()}>
                        <h3>
                            <SettingsIcon size={20} />
                            Test Options
                        </h3>
                        <p className={styles.dialogSubtitle}>
                            Configure how this webhook responds to requests
                        </p>

                        <div className={styles.testOptionSection}>
                            <div className={styles.testOptionHeader}>
                                <ClockIcon size={18} />
                                <span>Response Delay</span>
                            </div>
                            <p className={styles.testOptionDesc}>
                                Simulate slow response times to test timeout handling
                            </p>
                            <div className={styles.sliderContainer}>
                                <input
                                    type="range"
                                    min="0"
                                    max="30000"
                                    step="500"
                                    value={delayInput}
                                    onChange={(e) => setDelayInput(Number(e.target.value))}
                                    className={styles.slider}
                                />
                                <span className={styles.sliderValue}>
                                    {delayInput >= 1000
                                        ? `${(delayInput / 1000).toFixed(1)}s`
                                        : `${delayInput}ms`
                                    }
                                </span>
                            </div>
                        </div>

                        <div className={styles.testOptionSection}>
                            <div className={styles.testOptionHeader}>
                                <AlertCircleIcon size={18} />
                                <span>Response Status Code</span>
                            </div>
                            <p className={styles.testOptionDesc}>
                                Return custom status codes to test error handling
                            </p>
                            <select
                                value={statusCodeInput}
                                onChange={(e) => setStatusCodeInput(Number(e.target.value))}
                                className={styles.statusSelect}
                            >
                                {STATUS_CODE_OPTIONS.map((option) => (
                                    <option key={option.value} value={option.value}>
                                        {option.label}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className={styles.dialogActions}>
                            <button
                                onClick={() => setShowTestOptionsDialog(false)}
                                className={styles.cancelButton}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleTestOptionsSubmit}
                                className={styles.confirmButton}
                                disabled={savingTestOptions}
                            >
                                {savingTestOptions ? 'Saving...' : 'Save Options'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
