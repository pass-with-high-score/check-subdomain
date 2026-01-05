'use client';

import { useState, useEffect, useCallback, use } from 'react';
import { useRouter } from 'next/navigation';
import Navigation from '@/components/Navigation';
import Toast, { useToast } from '@/components/Toast';
import { CopyIcon, CheckIcon, RefreshIcon, BoltIcon, TrashIcon } from '@/components/Icons';
import styles from './page.module.css';

interface WebhookRequest {
    id: number;
    method: string;
    headers: Record<string, string>;
    body: string;
    query_params: Record<string, string>;
    content_length: number;
    created_at: string;
}

interface PageProps {
    params: Promise<{ id: string }>;
}

export default function WebhookDetailPage({ params }: PageProps) {
    const { id } = use(params);
    const [requests, setRequests] = useState<WebhookRequest[]>([]);
    const [selectedRequest, setSelectedRequest] = useState<WebhookRequest | null>(null);
    const [loading, setLoading] = useState(true);
    const [copied, setCopied] = useState(false);
    const { toasts, addToast, removeToast } = useToast();
    const router = useRouter();

    const webhookUrl = typeof window !== 'undefined'
        ? `${window.location.origin}/api/hook/${id}`
        : `/api/hook/${id}`;

    // Helper to parse JSON fields that might be strings
    const parseJsonField = (field: Record<string, string> | string): Record<string, string> => {
        if (typeof field === 'string') {
            try {
                return JSON.parse(field);
            } catch {
                return {};
            }
        }
        return field || {};
    };

    // Connect to SSE stream for real-time updates
    useEffect(() => {
        const eventSource = new EventSource(`/api/webhook/${id}/stream`);

        eventSource.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);

                if (data.error) {
                    addToast(data.error, 'error');
                    router.push('/webhook');
                    return;
                }

                if (data.type === 'init') {
                    // Initial load
                    setRequests(data.requests || []);
                    setLoading(false);
                } else if (data.type === 'new') {
                    // New requests - prepend to list
                    setRequests((prev) => [...data.requests, ...prev]);
                    addToast(`New ${data.requests.length === 1 ? 'request' : 'requests'} received`, 'success');
                }
            } catch (error) {
                console.error('SSE parse error:', error);
            }
        };

        eventSource.onerror = () => {
            // SSE connection error - will auto-reconnect
            console.log('SSE connection error, reconnecting...');
        };

        return () => {
            eventSource.close();
        };
    }, [id, addToast, router]);

    const copyUrl = async () => {
        await navigator.clipboard.writeText(webhookUrl);
        setCopied(true);
        addToast('URL copied', 'success');
        setTimeout(() => setCopied(false), 2000);
    };

    const formatTime = (dateStr: string) => {
        const date = new Date(dateStr);
        const now = new Date();
        const diff = Math.floor((now.getTime() - date.getTime()) / 1000);

        if (diff < 60) return `${diff}s ago`;
        if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
        if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
        return date.toLocaleDateString();
    };

    const formatSize = (bytes: number) => {
        if (bytes < 1024) return `${bytes} B`;
        return `${(bytes / 1024).toFixed(1)} KB`;
    };

    const getMethodColor = (method: string) => {
        switch (method) {
            case 'GET': return styles.methodGet;
            case 'POST': return styles.methodPost;
            case 'PUT': return styles.methodPut;
            case 'PATCH': return styles.methodPatch;
            case 'DELETE': return styles.methodDelete;
            default: return '';
        }
    };

    return (
        <div className={styles.container}>
            <div className={styles.backgroundGradient}></div>

            <Toast toasts={toasts} removeToast={removeToast} />
            <Navigation />

            <header className={styles.header}>
                <div className={styles.urlRow}>
                    <input
                        type="text"
                        value={webhookUrl}
                        readOnly
                        className={styles.urlInput}
                    />
                    <button onClick={copyUrl} className={styles.copyButton}>
                        {copied ? <CheckIcon size={18} /> : <CopyIcon size={18} />}
                    </button>
                </div>
            </header>

            <main className={styles.main}>
                <div className={styles.layout}>
                    {/* Request List */}
                    <div className={styles.requestList}>
                        <div className={styles.listHeader}>
                            <h2>Requests ({requests.length})</h2>
                        </div>

                        {loading ? (
                            <div className={styles.loading}>Loading...</div>
                        ) : requests.length === 0 ? (
                            <div className={styles.empty}>
                                <BoltIcon size={32} />
                                <p>No requests yet</p>
                                <span>Send a request to your webhook URL</span>
                            </div>
                        ) : (
                            <div className={styles.list}>
                                {requests.map((req) => (
                                    <button
                                        key={req.id}
                                        className={`${styles.requestItem} ${selectedRequest?.id === req.id ? styles.selected : ''}`}
                                        onClick={() => setSelectedRequest(req)}
                                    >
                                        <span className={`${styles.method} ${getMethodColor(req.method)}`}>
                                            {req.method}
                                        </span>
                                        <span className={styles.time}>{formatTime(req.created_at)}</span>
                                        <span className={styles.size}>{formatSize(req.content_length)}</span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Request Detail */}
                    <div className={styles.requestDetail}>
                        {selectedRequest ? (
                            <>
                                <div className={styles.detailHeader}>
                                    <span className={`${styles.method} ${getMethodColor(selectedRequest.method)}`}>
                                        {selectedRequest.method}
                                    </span>
                                    <span>{new Date(selectedRequest.created_at).toLocaleString()}</span>
                                </div>

                                <div className={styles.section}>
                                    <h3>Headers ({Object.keys(parseJsonField(selectedRequest.headers)).length})</h3>
                                    <div className={styles.tableWrapper}>
                                        <table className={styles.headersTable}>
                                            <tbody>
                                                {Object.entries(parseJsonField(selectedRequest.headers)).map(([key, value]) => (
                                                    <tr key={key}>
                                                        <td className={styles.headerKey}>{key}</td>
                                                        <td className={styles.headerValue}>{value}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                {Object.keys(parseJsonField(selectedRequest.query_params)).length > 0 && (
                                    <div className={styles.section}>
                                        <h3>Query Parameters</h3>
                                        <div className={styles.tableWrapper}>
                                            <table className={styles.headersTable}>
                                                <tbody>
                                                    {Object.entries(parseJsonField(selectedRequest.query_params)).map(([key, value]) => (
                                                        <tr key={key}>
                                                            <td className={styles.headerKey}>{key}</td>
                                                            <td className={styles.headerValue}>{value}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}

                                {selectedRequest.body && (
                                    <div className={styles.section}>
                                        <h3>Body</h3>
                                        <pre className={styles.code}>
                                            {(() => {
                                                try {
                                                    return JSON.stringify(JSON.parse(selectedRequest.body), null, 2);
                                                } catch {
                                                    return selectedRequest.body;
                                                }
                                            })()}
                                        </pre>
                                    </div>
                                )}
                            </>
                        ) : (
                            <div className={styles.noSelection}>
                                <p>Select a request to view details</p>
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}
