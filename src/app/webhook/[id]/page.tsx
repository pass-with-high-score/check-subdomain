'use client';

import { useState, useEffect, useCallback, use } from 'react';
import { useRouter } from 'next/navigation';
import Navigation from '@/components/Navigation';
import Toast, { useToast } from '@/components/Toast';
import { CopyIcon, CheckIcon, RefreshIcon, BoltIcon, TrashIcon, XIcon, AlertIcon, DownloadIcon, ArrowLeftIcon, SettingsIcon, ClockIcon, AlertCircleIcon } from '@/components/Icons';
import styles from './page.module.css';

// Language definitions with their variants
const LANGUAGE_CONFIG = {
    shell: { label: 'Shell', variants: ['curl', 'wget', 'httpie', 'powershell'] },
    javascript: { label: 'JavaScript', variants: ['fetch', 'xhr', 'jquery', 'axios'] },
    python: { label: 'Python', variants: ['requests', 'http'] },
    java: { label: 'Java', variants: ['okhttp', 'httpurlconnection'] },
    go: { label: 'Go', variants: [] },
    php: { label: 'PHP', variants: ['guzzle'] },
    ruby: { label: 'Ruby', variants: [] },
    csharp: { label: 'C#', variants: [] },
    kotlin: { label: 'Kotlin', variants: [] },
    rust: { label: 'Rust', variants: [] },
    dart: { label: 'Dart', variants: [] },
    r: { label: 'R', variants: [] },
} as const;

type LanguageKey = keyof typeof LANGUAGE_CONFIG;

// Max timeout: 10 minutes = 600000ms
const MAX_TIMEOUT_MS = 600000;

// Status code options for test options
const STATUS_CODE_OPTIONS = [
    { value: 200, label: '200 - OK' },
    { value: 201, label: '201 - Created' },
    { value: 400, label: '400 - Bad Request' },
    { value: 401, label: '401 - Unauthorized' },
    { value: 403, label: '403 - Forbidden' },
    { value: 404, label: '404 - Not Found' },
    { value: 429, label: '429 - Too Many Requests' },
    { value: 500, label: '500 - Internal Server Error' },
    { value: 502, label: '502 - Bad Gateway' },
    { value: 503, label: '503 - Service Unavailable' },
    { value: 504, label: '504 - Gateway Timeout' },
];

// Parse timeout value from string
// Supports: 2000 (ms), "2000ms", "2s", "2m", "2m 14s", "1m 30s"
const parseTimeoutInput = (value: string): number | null => {
    if (!value) return 0;
    const trimmed = value.trim().toLowerCase();
    if (trimmed === '' || trimmed === '0') return 0;

    // Try parsing combined format "2m 14s" or "1m 30s"
    const combinedMatch = trimmed.match(/^(\d+)\s*m\s+(\d+)\s*s$/);
    if (combinedMatch) {
        const mins = parseInt(combinedMatch[1], 10);
        const secs = parseInt(combinedMatch[2], 10);
        const ms = (mins * 60 + secs) * 1000;
        return Math.min(Math.max(0, ms), MAX_TIMEOUT_MS);
    }

    // Try parsing with single unit suffix
    const singleMatch = trimmed.match(/^(\d+(?:\.\d+)?)\s*(ms|s|m)?$/);
    if (!singleMatch) return null;
    const num = parseFloat(singleMatch[1]);
    const unit = singleMatch[2] || 'ms';
    let ms: number;
    switch (unit) {
        case 'm': ms = num * 60 * 1000; break;
        case 's': ms = num * 1000; break;
        default: ms = num;
    }
    return Math.min(Math.max(0, Math.round(ms)), MAX_TIMEOUT_MS);
};

// Format ms to human readable
const formatDelayDisplay = (ms: number): string => {
    if (ms === 0) return '0ms';
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    const mins = Math.floor(ms / 60000);
    const secs = Math.round((ms % 60000) / 1000);
    return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
};

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
    const [showClearDialog, setShowClearDialog] = useState(false);
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);
    const [methodFilter, setMethodFilter] = useState<string>('ALL');
    const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
    const [searchQuery, setSearchQuery] = useState('');
    const [bodyViewMode, setBodyViewMode] = useState<'pretty' | 'text' | 'preview'>('pretty');
    const { toasts, addToast, removeToast } = useToast();
    const router = useRouter();

    // Client Code states
    const [selectedLanguage, setSelectedLanguage] = useState<LanguageKey>('shell');
    const [selectedVariant, setSelectedVariant] = useState<string>('curl');
    const [codeCopied, setCodeCopied] = useState(false);
    const [webhookUrl, setWebhookUrl] = useState(`/api/hook/${id}`);

    // Set the full URL on client side to avoid hydration mismatch
    useEffect(() => {
        setWebhookUrl(`${window.location.origin}/api/hook/${id}`);
    }, [id]);

    // Test Options states
    const [showTestOptionsDialog, setShowTestOptionsDialog] = useState(false);
    const [delayInputText, setDelayInputText] = useState('0ms');
    const [statusCodeInput, setStatusCodeInput] = useState(200);
    const [savingTestOptions, setSavingTestOptions] = useState(false);
    const [currentTestOptions, setCurrentTestOptions] = useState({ delay: 0, statusCode: 200 });

    // Load current test options
    useEffect(() => {
        const loadTestOptions = async () => {
            try {
                const response = await fetch(`/api/webhook?id=${id}`);
                if (response.ok) {
                    const data = await response.json();
                    if (data.endpoint) {
                        const delay = data.endpoint.response_delay_ms || 0;
                        const status = data.endpoint.response_status_code || 200;
                        setCurrentTestOptions({ delay, statusCode: status });
                    }
                }
            } catch (e) {
                console.error('Failed to load test options:', e);
            }
        };
        loadTestOptions();
    }, [id]);

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

    // Parse timestamp from PostgreSQL (UTC) to local time
    const parseTimestamp = (dateStr: string) => {
        // PostgreSQL returns timestamps without timezone info
        // Append 'Z' to indicate UTC if not already present
        const utcStr = dateStr.endsWith('Z') ? dateStr : dateStr + 'Z';
        return new Date(utcStr);
    };

    const formatTime = (dateStr: string) => {
        const date = parseTimestamp(dateStr);
        const now = new Date();
        const diff = Math.floor((now.getTime() - date.getTime()) / 1000);

        if (diff < 60) return `${Math.max(0, diff)}s ago`;
        if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
        if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
        return date.toLocaleDateString();
    };

    const formatFullTime = (dateStr: string) => {
        return parseTimestamp(dateStr).toLocaleString();
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

    // Get unique methods from requests
    const availableMethods = ['ALL', ...new Set(requests.map(r => r.method))];

    // Filter and sort requests
    const filteredRequests = requests
        .filter(r => methodFilter === 'ALL' || r.method === methodFilter)
        .filter(r => {
            if (!searchQuery.trim()) return true;
            const query = searchQuery.toLowerCase();
            const headers = JSON.stringify(parseJsonField(r.headers)).toLowerCase();
            const body = (r.body || '').toLowerCase();
            const queryParams = JSON.stringify(parseJsonField(r.query_params)).toLowerCase();
            return headers.includes(query) || body.includes(query) || queryParams.includes(query);
        })
        .sort((a, b) => {
            const dateA = new Date(a.created_at).getTime();
            const dateB = new Date(b.created_at).getTime();
            return sortOrder === 'newest' ? dateB - dateA : dateA - dateB;
        });

    const copyBody = async () => {
        if (!selectedRequest?.body) return;
        try {
            const formatted = JSON.stringify(JSON.parse(selectedRequest.body), null, 2);
            await navigator.clipboard.writeText(formatted);
        } catch {
            await navigator.clipboard.writeText(selectedRequest.body);
        }
        addToast('Body copied', 'success');
    };

    const getContentType = (headers: Record<string, string> | string): string => {
        const h = parseJsonField(headers);
        return (h['content-type'] || h['Content-Type'] || '').toLowerCase();
    };

    const getMediaType = (contentType: string): 'image' | 'audio' | 'video' | 'other' => {
        if (contentType.startsWith('image/')) return 'image';
        if (contentType.startsWith('audio/')) return 'audio';
        if (contentType.startsWith('video/')) return 'video';
        return 'other';
    };

    interface MultipartPart {
        name: string;
        filename?: string;
        contentType?: string;
        data: string;
    }

    const parseMultipartFormData = (body: string, contentType: string): MultipartPart[] => {
        const parts: MultipartPart[] = [];
        const boundaryMatch = contentType.match(/boundary=([^;]+)/);
        if (!boundaryMatch) return parts;

        const boundary = '--' + boundaryMatch[1].trim();
        const sections = body.split(boundary).filter(s => s.trim() && s.trim() !== '--');

        for (const section of sections) {
            const headerEnd = section.indexOf('\r\n\r\n');
            if (headerEnd === -1) continue;

            const headerPart = section.substring(0, headerEnd);
            const dataPart = section.substring(headerEnd + 4).replace(/\r\n$/, '');

            const nameMatch = headerPart.match(/name="([^"]+)"/);
            const filenameMatch = headerPart.match(/filename="([^"]+)"/);
            const ctMatch = headerPart.match(/Content-Type:\s*([^\r\n]+)/i);

            if (nameMatch) {
                parts.push({
                    name: nameMatch[1],
                    filename: filenameMatch?.[1],
                    contentType: ctMatch?.[1]?.trim(),
                    data: dataPart
                });
            }
        }
        return parts;
    };

    // Decode body if it was stored as base64 (binary content)
    const getDecodedBody = (request: WebhookRequest): string => {
        const params = parseJsonField(request.query_params);
        if (params['_binary'] === 'true') {
            try {
                return atob(request.body);
            } catch {
                return request.body;
            }
        }
        return request.body;
    };

    const downloadBody = () => {
        if (!selectedRequest?.body) return;
        const decodedBody = getDecodedBody(selectedRequest);
        const contentType = getContentType(selectedRequest.headers);
        const blob = new Blob([decodedBody], { type: contentType || 'application/octet-stream' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `request-${selectedRequest.id}-body`;
        a.click();
        URL.revokeObjectURL(url);
    };

    // Generate curl command from request data
    const generateCurlCommand = useCallback((request: WebhookRequest): string => {
        const headers = parseJsonField(request.headers);
        const queryParams = parseJsonField(request.query_params);
        const isBinary = queryParams['_binary'] === 'true';
        const contentType = getContentType(request.headers);
        const isMultipart = contentType.includes('multipart/form-data');

        // Build URL with query params (excluding internal params like _path, _binary)
        let url = webhookUrl;
        const filteredParams = Object.entries(queryParams)
            .filter(([key]) => !key.startsWith('_'));
        if (filteredParams.length > 0) {
            const searchParams = new URLSearchParams(filteredParams);
            url += '?' + searchParams.toString();
        }

        let cmd = '';

        // For binary/multipart data, use base64 decode pipe
        if (request.body && (isBinary || isMultipart)) {
            cmd = `echo '${request.body}' | base64 -d | curl -X ${request.method} '${url}'`;
        } else {
            cmd = `curl -X ${request.method} '${url}'`;
        }

        // Add headers (excluding some internal ones)
        const skipHeaders = ['host', 'content-length', 'connection', 'accept-encoding'];
        for (const [key, value] of Object.entries(headers)) {
            if (!skipHeaders.includes(key.toLowerCase())) {
                // Escape single quotes in header values
                const escapedValue = value.replace(/'/g, "'\\''");
                cmd += ` \\\n  -H '${key}: ${escapedValue}'`;
            }
        }

        // Add body if present
        if (request.body) {
            if (isBinary || isMultipart) {
                // Binary data - use stdin from the pipe
                cmd += ` \\\n  --data-binary @-`;
            } else {
                // Regular text body
                const escapedBody = request.body.replace(/'/g, "'\\''");
                cmd += ` \\\n  -d '${escapedBody}'`;
            }
        }

        return cmd;
    }, [webhookUrl]);

    // State for generated code (fetched from server)
    const [generatedCode, setGeneratedCode] = useState('');
    const [isGeneratingCode, setIsGeneratingCode] = useState(false);

    // Generate client code via API
    useEffect(() => {
        if (!selectedRequest) {
            setGeneratedCode('');
            return;
        }

        const generateCode = async () => {
            setIsGeneratingCode(true);
            try {
                const headers = parseJsonField(selectedRequest.headers);
                const queryParams = parseJsonField(selectedRequest.query_params);
                const isBinary = queryParams['_binary'] === 'true';
                const contentType = getContentType(selectedRequest.headers);
                const isMultipart = contentType.includes('multipart/form-data');

                // Build URL with query params (excluding internal params)
                let url = webhookUrl;
                const filteredParams = Object.entries(queryParams)
                    .filter(([key]) => !key.startsWith('_'));
                if (filteredParams.length > 0) {
                    const searchParams = new URLSearchParams(filteredParams);
                    url += '?' + searchParams.toString();
                }

                // Filter out internal headers
                const skipHeaders = ['host', 'content-length', 'connection', 'accept-encoding'];
                const filteredHeaders: Record<string, string> = {};
                for (const [key, value] of Object.entries(headers)) {
                    if (!skipHeaders.includes(key.toLowerCase())) {
                        filteredHeaders[key] = value;
                    }
                }

                const response = await fetch('/api/generate-code', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        method: selectedRequest.method,
                        url,
                        headers: filteredHeaders,
                        body: selectedRequest.body || null,
                        isBinary: isBinary || isMultipart,
                        language: selectedLanguage,
                        variant: selectedVariant,
                    }),
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    setGeneratedCode(`// Error: ${errorData.error || 'Failed to generate code'}`);
                    return;
                }

                const data = await response.json();
                setGeneratedCode(data.code);
            } catch (error) {
                console.error('Code generation error:', error);
                setGeneratedCode(`// Error generating code: ${error instanceof Error ? error.message : 'Unknown error'}`);
            } finally {
                setIsGeneratingCode(false);
            }
        };

        generateCode();
    }, [selectedRequest, selectedLanguage, selectedVariant, webhookUrl]);

    // Update variant when language changes
    useEffect(() => {
        const variants = LANGUAGE_CONFIG[selectedLanguage].variants;
        if (variants.length > 0) {
            setSelectedVariant(variants[0] as string);
        } else {
            setSelectedVariant('');
        }
    }, [selectedLanguage]);

    const copyCode = async () => {
        await navigator.clipboard.writeText(generatedCode);
        setCodeCopied(true);
        addToast('Code copied', 'success');
        setTimeout(() => setCodeCopied(false), 2000);
    };

    const deleteRequest = async (requestId: number) => {
        try {
            const response = await fetch(`/api/webhook/request/${requestId}`, { method: 'DELETE' });
            if (response.ok) {
                setRequests((prev) => prev.filter((r) => r.id !== requestId));
                if (selectedRequest?.id === requestId) {
                    setSelectedRequest(null);
                }
                addToast('Request deleted', 'success');
            }
        } catch (error) {
            console.error(error);
            addToast('Failed to delete', 'error');
        }
    };

    const clearAllRequests = async () => {
        setShowClearDialog(false);
        try {
            const response = await fetch(`/api/webhook/${id}/requests`, { method: 'DELETE' });
            if (response.ok) {
                setRequests([]);
                setSelectedRequest(null);
                addToast('All requests cleared', 'success');
            }
        } catch (error) {
            console.error(error);
            addToast('Failed to clear', 'error');
        }
    };

    const exportData = () => {
        if (requests.length === 0) {
            addToast('No data to export', 'error');
            return;
        }

        const exportPayload = {
            endpoint_id: id,
            webhook_url: webhookUrl,
            exported_at: new Date().toISOString(),
            total_requests: requests.length,
            requests: requests.map(req => ({
                id: req.id,
                method: req.method,
                headers: parseJsonField(req.headers),
                body: req.body,
                query_params: parseJsonField(req.query_params),
                content_length: req.content_length,
                created_at: req.created_at,
            })),
        };

        const jsonString = JSON.stringify(exportPayload, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `webhook-${id}-export-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        addToast(`Exported ${requests.length} requests`, 'success');
    };

    const exportSingleRequest = (request: WebhookRequest) => {
        const exportPayload = {
            endpoint_id: id,
            webhook_url: webhookUrl,
            exported_at: new Date().toISOString(),
            request: {
                id: request.id,
                method: request.method,
                headers: parseJsonField(request.headers),
                body: request.body,
                query_params: parseJsonField(request.query_params),
                content_length: request.content_length,
                created_at: request.created_at,
            },
        };

        const jsonString = JSON.stringify(exportPayload, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `webhook-request-${request.id}-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        addToast('Request exported', 'success');
    };

    const deleteEndpoint = async () => {
        setShowDeleteDialog(false);
        try {
            const response = await fetch(`/api/webhook/endpoint/${id}`, { method: 'DELETE' });
            if (response.ok) {
                localStorage.removeItem('webhook-endpoint');
                addToast('Endpoint deleted', 'success');
                router.push('/webhook');
            }
        } catch (error) {
            console.error(error);
            addToast('Failed to delete endpoint', 'error');
        }
    };

    // Test Options Handlers
    const openTestOptionsDialog = () => {
        setDelayInputText(formatDelayDisplay(currentTestOptions.delay));
        setStatusCodeInput(currentTestOptions.statusCode);
        setShowTestOptionsDialog(true);
    };

    const handleTestOptionsSubmit = async () => {
        const parsedDelay = parseTimeoutInput(delayInputText);
        if (parsedDelay === null) {
            addToast('Invalid timeout format. Use: 2000, 2s, 2m. Max: 10m', 'error');
            return;
        }

        setSavingTestOptions(true);
        try {
            const response = await fetch(`/api/webhook/endpoint/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    response_delay_ms: parsedDelay,
                    response_status_code: statusCodeInput,
                }),
            });

            if (!response.ok) throw new Error('Failed to update test options');

            setCurrentTestOptions({ delay: parsedDelay, statusCode: statusCodeInput });
            addToast('Test options updated', 'success');
            setShowTestOptionsDialog(false);
        } catch (error) {
            console.error(error);
            addToast('Failed to update test options', 'error');
        } finally {
            setSavingTestOptions(false);
        }
    };

    const hasActiveTestOptions = currentTestOptions.delay > 0 || currentTestOptions.statusCode !== 200;

    return (
        <div className={styles.container}>
            <div className={styles.backgroundGradient}></div>

            <Toast toasts={toasts} removeToast={removeToast} />
            <Navigation />

            <header className={styles.header}>
                <div className={styles.urlRow}>
                    <button onClick={() => router.push('/webhook')} className={styles.backButton} title="Back to Webhooks">
                        <ArrowLeftIcon size={20} />
                    </button>
                    <p className={styles.urlDisplay}>{webhookUrl}</p>
                    <button onClick={copyUrl} className={styles.copyButton}>
                        {copied ? <CheckIcon size={18} /> : <CopyIcon size={18} />}
                    </button>
                    <button
                        onClick={openTestOptionsDialog}
                        className={`${styles.settingsButton} ${hasActiveTestOptions ? styles.settingsActive : ''}`}
                        title="Test Options"
                    >
                        <SettingsIcon size={18} />
                        {hasActiveTestOptions && (
                            <span className={styles.activeDot}></span>
                        )}
                    </button>
                    <button onClick={() => setShowDeleteDialog(true)} className={styles.dangerButton} title="Delete Endpoint">
                        <TrashIcon size={18} />
                    </button>
                </div>
            </header>

            <main className={styles.main}>
                <div className={styles.layout}>
                    {/* Request List */}
                    <div className={styles.requestList}>
                        <div className={styles.listHeader}>
                            <h2>Requests <span className={styles.requestCount}>({filteredRequests.length}/{requests.length})</span></h2>
                            {requests.length > 0 && (
                                <div className={styles.headerActions}>
                                    <button onClick={exportData} className={styles.exportButton} title="Export all requests as JSON">
                                        <DownloadIcon size={12} />
                                    </button>
                                    <button onClick={() => setShowClearDialog(true)} className={styles.clearButton} title="Clear all requests">
                                        <TrashIcon size={12} />
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Filters */}
                        {requests.length > 0 && (
                            <div className={styles.filterRow}>
                                <select
                                    value={methodFilter}
                                    onChange={(e) => setMethodFilter(e.target.value)}
                                    className={styles.filterSelect}
                                >
                                    {availableMethods.map(method => (
                                        <option key={method} value={method}>{method}</option>
                                    ))}
                                </select>
                                <input
                                    type="text"
                                    placeholder="Search..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className={styles.searchInput}
                                />
                                <button
                                    onClick={() => setSortOrder(sortOrder === 'newest' ? 'oldest' : 'newest')}
                                    className={styles.sortButton}
                                >
                                    {sortOrder === 'newest' ? '↓ Newest' : '↑ Oldest'}
                                </button>
                            </div>
                        )}

                        {loading ? (
                            <div className={styles.loading}>Loading...</div>
                        ) : requests.length === 0 ? (
                            <div className={styles.empty}>
                                <BoltIcon size={32} />
                                <p>No requests yet</p>
                                <span>Send a request to your webhook URL</span>
                            </div>
                        ) : filteredRequests.length === 0 ? (
                            <div className={styles.empty}>
                                <p>No {methodFilter} requests</p>
                            </div>
                        ) : (
                            <div className={styles.list}>
                                {filteredRequests.map((req) => (
                                    <div
                                        key={req.id}
                                        className={`${styles.requestItem} ${selectedRequest?.id === req.id ? styles.selected : ''}`}
                                    >
                                        <button
                                            className={styles.requestItemContent}
                                            onClick={() => setSelectedRequest(req)}
                                        >
                                            <span className={`${styles.method} ${getMethodColor(req.method)}`}>
                                                {req.method}
                                            </span>
                                            <span className={styles.time}>{formatTime(req.created_at)}</span>
                                            <span className={styles.size}>{formatSize(req.content_length)}</span>
                                        </button>
                                        {selectedRequest?.id === req.id && (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    deleteRequest(req.id);
                                                }}
                                                className={styles.deleteItemButton}
                                                title="Delete request"
                                            >
                                                <TrashIcon size={14} />
                                            </button>
                                        )}
                                    </div>
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
                                    <span className={styles.timestamp}>{formatFullTime(selectedRequest.created_at)}</span>
                                    <button
                                        onClick={() => exportSingleRequest(selectedRequest)}
                                        className={styles.exportRequestButton}
                                        title="Export this request"
                                    >
                                        <DownloadIcon size={14} /> Export
                                    </button>
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

                                {(() => {
                                    const allParams = parseJsonField(selectedRequest.query_params);
                                    const pathParam = allParams['_path'];
                                    const queryParams = Object.fromEntries(
                                        Object.entries(allParams).filter(([key]) => key !== '_path')
                                    );

                                    return (
                                        <>
                                            {pathParam && (
                                                <div className={styles.section}>
                                                    <h3>Path</h3>
                                                    <div className={styles.pathDisplay}>{pathParam}</div>
                                                </div>
                                            )}

                                            {Object.keys(queryParams).length > 0 && (
                                                <div className={styles.section}>
                                                    <h3>Query Parameters</h3>
                                                    <div className={styles.tableWrapper}>
                                                        <table className={styles.headersTable}>
                                                            <tbody>
                                                                {Object.entries(queryParams).map(([key, value]) => (
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
                                        </>
                                    );
                                })()}

                                {selectedRequest.body && (
                                    <div className={styles.section}>
                                        <div className={styles.sectionHeader}>
                                            <h3>Body</h3>
                                            <div className={styles.bodyTabs}>
                                                <button
                                                    className={`${styles.bodyTab} ${bodyViewMode === 'pretty' ? styles.bodyTabActive : ''}`}
                                                    onClick={() => setBodyViewMode('pretty')}
                                                >
                                                    Pretty
                                                </button>
                                                <button
                                                    className={`${styles.bodyTab} ${bodyViewMode === 'text' ? styles.bodyTabActive : ''}`}
                                                    onClick={() => setBodyViewMode('text')}
                                                >
                                                    Text
                                                </button>
                                                <button
                                                    className={`${styles.bodyTab} ${bodyViewMode === 'preview' ? styles.bodyTabActive : ''}`}
                                                    onClick={() => setBodyViewMode('preview')}
                                                >
                                                    Preview
                                                </button>
                                            </div>
                                            <button onClick={copyBody} className={styles.copyBodyButton} title="Copy body">
                                                <CopyIcon size={14} /> Copy
                                            </button>
                                        </div>

                                        {(() => {
                                            const decodedBody = getDecodedBody(selectedRequest);
                                            const contentType = getContentType(selectedRequest.headers);
                                            const isMultipart = contentType.includes('multipart/form-data');

                                            return (
                                                <>
                                                    {bodyViewMode === 'pretty' && (
                                                        isMultipart ? (
                                                            <div className={styles.multipartSummary}>
                                                                {parseMultipartFormData(decodedBody, contentType).map((part, i) => (
                                                                    <div key={i} className={styles.partSummary}>
                                                                        <div className={styles.partSummaryHeader}>
                                                                            <strong>{part.name}</strong>
                                                                            {part.filename && <span className={styles.partFilename}>{part.filename}</span>}
                                                                        </div>
                                                                        {part.contentType ? (
                                                                            <div className={styles.partMeta}>
                                                                                <span>Type: {part.contentType}</span>
                                                                                <span>Size: {part.data.length} bytes</span>
                                                                            </div>
                                                                        ) : (
                                                                            <pre className={styles.partValue}>{part.data}</pre>
                                                                        )}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        ) : (
                                                            <pre className={styles.code}>
                                                                {(() => {
                                                                    try {
                                                                        return JSON.stringify(JSON.parse(decodedBody), null, 2);
                                                                    } catch {
                                                                        return decodedBody;
                                                                    }
                                                                })()}
                                                            </pre>
                                                        )
                                                    )}

                                                    {bodyViewMode === 'text' && (
                                                        isMultipart ? (
                                                            <div className={styles.multipartSummary}>
                                                                {parseMultipartFormData(decodedBody, contentType).map((part, i) => (
                                                                    <div key={i} className={styles.partSummary}>
                                                                        <div className={styles.partSummaryHeader}>
                                                                            <strong>{part.name}</strong>
                                                                            {part.filename && <span className={styles.partFilename}>{part.filename}</span>}
                                                                        </div>
                                                                        {part.contentType ? (
                                                                            <pre className={styles.partValue}>[Binary: {part.data.length} bytes]</pre>
                                                                        ) : (
                                                                            <pre className={styles.partValue}>{part.data}</pre>
                                                                        )}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        ) : (
                                                            <pre className={styles.code}>{decodedBody}</pre>
                                                        )
                                                    )}

                                                    {bodyViewMode === 'preview' && (
                                                        <div className={styles.previewContainer}>
                                                            {(() => {
                                                                const contentType = getContentType(selectedRequest.headers);
                                                                const mediaType = getMediaType(contentType);

                                                                // Handle multipart/form-data
                                                                if (contentType.includes('multipart/form-data')) {
                                                                    const parts = parseMultipartFormData(decodedBody, contentType);
                                                                    const fileParts = parts.filter(p => p.filename && p.contentType);

                                                                    if (fileParts.length === 0) {
                                                                        return (
                                                                            <div className={styles.noPreview}>
                                                                                <p>No file parts found in multipart data</p>
                                                                                <p className={styles.partsInfo}>
                                                                                    Found {parts.length} field(s): {parts.map(p => p.name).join(', ')}
                                                                                </p>
                                                                            </div>
                                                                        );
                                                                    }

                                                                    return (
                                                                        <div className={styles.multipartParts}>
                                                                            {fileParts.map((part, index) => {
                                                                                const partMediaType = getMediaType(part.contentType || '');
                                                                                return (
                                                                                    <div key={index} className={styles.partItem}>
                                                                                        <div className={styles.partHeader}>
                                                                                            <strong>{part.filename}</strong>
                                                                                            <span className={styles.partType}>{part.contentType}</span>
                                                                                        </div>
                                                                                        {partMediaType === 'image' && (
                                                                                            <img
                                                                                                src={`data:${part.contentType};base64,${btoa(part.data)}`}
                                                                                                alt={part.filename}
                                                                                                className={styles.mediaPreview}
                                                                                            />
                                                                                        )}
                                                                                        {partMediaType === 'audio' && (
                                                                                            <audio controls className={styles.mediaPreview}>
                                                                                                <source src={`data:${part.contentType};base64,${btoa(part.data)}`} type={part.contentType} />
                                                                                            </audio>
                                                                                        )}
                                                                                        {partMediaType === 'video' && (
                                                                                            <video controls className={styles.mediaPreview}>
                                                                                                <source src={`data:${part.contentType};base64,${btoa(part.data)}`} type={part.contentType} />
                                                                                            </video>
                                                                                        )}
                                                                                        {partMediaType === 'other' && (
                                                                                            <p className={styles.noMediaPreview}>Cannot preview this file type</p>
                                                                                        )}
                                                                                    </div>
                                                                                );
                                                                            })}
                                                                        </div>
                                                                    );
                                                                }

                                                                if (mediaType === 'image') {
                                                                    return (
                                                                        <img
                                                                            src={`data:${contentType};base64,${btoa(decodedBody)}`}
                                                                            alt="Preview"
                                                                            className={styles.mediaPreview}
                                                                        />
                                                                    );
                                                                }

                                                                if (mediaType === 'audio') {
                                                                    return (
                                                                        <audio controls className={styles.mediaPreview}>
                                                                            <source src={`data:${contentType};base64,${btoa(decodedBody)}`} type={contentType} />
                                                                        </audio>
                                                                    );
                                                                }

                                                                if (mediaType === 'video') {
                                                                    return (
                                                                        <video controls className={styles.mediaPreview}>
                                                                            <source src={`data:${contentType};base64,${btoa(decodedBody)}`} type={contentType} />
                                                                        </video>
                                                                    );
                                                                }

                                                                // Handle text/JSON content - show formatted
                                                                if (contentType.includes('json') || contentType.startsWith('text/') || !contentType) {
                                                                    return (
                                                                        <pre className={styles.code}>
                                                                            {(() => {
                                                                                try {
                                                                                    return JSON.stringify(JSON.parse(decodedBody), null, 2);
                                                                                } catch {
                                                                                    return decodedBody;
                                                                                }
                                                                            })()}
                                                                        </pre>
                                                                    );
                                                                }

                                                                return (
                                                                    <div className={styles.noPreview}>
                                                                        <p>Preview not available for {contentType || 'this content type'}</p>
                                                                        <button onClick={downloadBody} className={styles.downloadButton}>
                                                                            Download Body
                                                                        </button>
                                                                    </div>
                                                                );
                                                            })()}
                                                        </div>
                                                    )}
                                                </>
                                            );
                                        })()}
                                    </div>
                                )}

                                {/* Client Code Section */}
                                <div className={styles.section}>
                                    <div className={styles.sectionHeader}>
                                        <h3>Client Code</h3>
                                        <button onClick={copyCode} className={styles.copyBodyButton} title="Copy code">
                                            {codeCopied ? <CheckIcon size={14} /> : <CopyIcon size={14} />} Copy
                                        </button>
                                    </div>

                                    {/* Language Tabs */}
                                    <div className={styles.languageTabs}>
                                        {(Object.keys(LANGUAGE_CONFIG) as LanguageKey[]).map((lang) => (
                                            <button
                                                key={lang}
                                                className={`${styles.languageTab} ${selectedLanguage === lang ? styles.languageTabActive : ''}`}
                                                onClick={() => setSelectedLanguage(lang)}
                                            >
                                                {LANGUAGE_CONFIG[lang].label}
                                            </button>
                                        ))}
                                    </div>

                                    {/* Variant Sub-tabs */}
                                    {LANGUAGE_CONFIG[selectedLanguage].variants.length > 0 && (
                                        <div className={styles.variantTabs}>
                                            {LANGUAGE_CONFIG[selectedLanguage].variants.map((variant) => (
                                                <button
                                                    key={variant}
                                                    className={`${styles.variantTab} ${selectedVariant === variant ? styles.variantTabActive : ''}`}
                                                    onClick={() => setSelectedVariant(variant)}
                                                >
                                                    {variant}
                                                </button>
                                            ))}
                                        </div>
                                    )}

                                    {/* Generated Code */}
                                    <pre className={styles.code}>{generatedCode}</pre>
                                </div>
                            </>
                        ) : (
                            <div className={styles.noSelection}>
                                <p>Select a request to view details</p>
                            </div>
                        )}
                    </div>
                </div>
            </main>

            {/* Clear All Dialog */}
            {
                showClearDialog && (
                    <div className={styles.dialogOverlay} onClick={() => setShowClearDialog(false)}>
                        <div className={styles.dialog} onClick={e => e.stopPropagation()}>
                            <button className={styles.dialogClose} onClick={() => setShowClearDialog(false)}>
                                <XIcon size={24} />
                            </button>
                            <div className={styles.dialogHeader}>
                                <AlertIcon size={28} />
                                <h2>Clear All Requests?</h2>
                            </div>
                            <p className={styles.dialogText}>
                                This will delete all {requests.length} requests from this endpoint.
                            </p>
                            <div className={styles.dialogActions}>
                                <button onClick={clearAllRequests} className={styles.dialogDanger}>
                                    Yes, Clear All
                                </button>
                                <button onClick={() => setShowClearDialog(false)} className={styles.dialogSecondary}>
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Delete Endpoint Dialog */}
            {
                showDeleteDialog && (
                    <div className={styles.dialogOverlay} onClick={() => setShowDeleteDialog(false)}>
                        <div className={styles.dialogDangerBox} onClick={e => e.stopPropagation()}>
                            <button className={styles.dialogClose} onClick={() => setShowDeleteDialog(false)}>
                                <XIcon size={24} />
                            </button>
                            <div className={styles.dialogHeader}>
                                <TrashIcon size={28} />
                                <h2>Delete Endpoint?</h2>
                            </div>
                            <div className={styles.warningBox}>
                                <p><strong>Warning:</strong> This action cannot be undone!</p>
                                <ul>
                                    <li>The webhook URL will stop working</li>
                                    <li>All requests will be permanently deleted</li>
                                </ul>
                            </div>
                            <div className={styles.dialogActions}>
                                <button onClick={deleteEndpoint} className={styles.dialogDanger}>
                                    Yes, Delete Endpoint
                                </button>
                                <button onClick={() => setShowDeleteDialog(false)} className={styles.dialogSecondary}>
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Test Options Dialog */}
            {showTestOptionsDialog && (
                <div className={styles.dialogOverlay} onClick={() => setShowTestOptionsDialog(false)}>
                    <div className={styles.testOptionsDialog} onClick={e => e.stopPropagation()}>
                        <button className={styles.dialogClose} onClick={() => setShowTestOptionsDialog(false)}>
                            <XIcon size={24} />
                        </button>
                        <div className={styles.dialogHeader}>
                            <SettingsIcon size={28} />
                            <h2>Test Options</h2>
                        </div>
                        <p className={styles.dialogSubtitle}>
                            Configure how this webhook responds. Override via query params: ?timeout=5s&status=500
                        </p>

                        <div className={styles.testOptionSection}>
                            <div className={styles.testOptionLabel}>
                                <ClockIcon size={16} />
                                <span>Response Delay</span>
                            </div>
                            <div className={styles.sliderWithInput}>
                                <input
                                    type="range"
                                    min="0"
                                    max="600000"
                                    step="1000"
                                    value={parseTimeoutInput(delayInputText) ?? 0}
                                    onChange={(e) => setDelayInputText(formatDelayDisplay(Number(e.target.value)))}
                                    className={styles.slider}
                                />
                                <input
                                    type="text"
                                    value={delayInputText}
                                    onChange={(e) => setDelayInputText(e.target.value)}
                                    className={styles.delayTextInput}
                                    placeholder="0ms"
                                />
                            </div>
                        </div>

                        <div className={styles.testOptionSection}>
                            <div className={styles.testOptionLabel}>
                                <AlertCircleIcon size={16} />
                                <span>Response Status Code</span>
                            </div>
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
                                onClick={handleTestOptionsSubmit}
                                className={styles.dialogPrimary}
                                disabled={savingTestOptions}
                            >
                                {savingTestOptions ? 'Saving...' : 'Save Options'}
                            </button>
                            <button onClick={() => setShowTestOptionsDialog(false)} className={styles.dialogSecondary}>
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div >
    );
}
