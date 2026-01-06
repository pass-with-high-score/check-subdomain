'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import Navigation from '@/components/Navigation';
import Toast, { useToast } from '@/components/Toast';
import { CopyIcon, CheckIcon, CodeIcon, LinkIcon, ClockIcon, TrashIcon, ExternalLinkIcon, RefreshIcon, UploadIcon } from '@/components/Icons';
import styles from './page.module.css';

const STORAGE_KEY = 'json-bins-history';
const MAX_HISTORY = 20;

interface JsonBin {
    id: string;
    url: string;
    viewUrl: string;
    editUrl: string;
    editToken: string;
    expiresAt: string | null;
    ttl: string;
    createdAt: string;
    preview: string;
}

interface ValidationResult {
    valid: boolean;
    error: string | null;
    formatted: string | null;
}

const TTL_OPTIONS = [
    { value: '1h', label: '1 Hour' },
    { value: '1d', label: '1 Day' },
    { value: '7d', label: '7 Days' },
    { value: 'never', label: 'Never' },
];

function validateJson(input: string): ValidationResult {
    if (!input.trim()) {
        return { valid: false, error: null, formatted: null };
    }

    try {
        const parsed = JSON.parse(input);
        const formatted = JSON.stringify(parsed, null, 2);
        return { valid: true, error: null, formatted };
    } catch (e) {
        const error = e instanceof Error ? e.message : 'Invalid JSON';
        return { valid: false, error, formatted: null };
    }
}

function getPreview(json: string, maxLength: number = 60): string {
    try {
        const parsed = JSON.parse(json);
        const str = JSON.stringify(parsed);
        return str.length > maxLength ? str.substring(0, maxLength) + '...' : str;
    } catch {
        return json.substring(0, maxLength);
    }
}

// Generate code snippets
function generateSnippets(url: string) {
    return {
        javascript: `fetch('${url}')
  .then(res => res.json())
  .then(data => console.log(data));`,
        python: `import requests

response = requests.get('${url}')
data = response.json()
print(data)`,
        curl: `curl -X GET '${url}'`,
    };
}

export default function JsonServerPage() {
    const searchParams = useSearchParams();
    const [jsonInput, setJsonInput] = useState('');
    const [validation, setValidation] = useState<ValidationResult>({ valid: false, error: null, formatted: null });
    const [ttl, setTtl] = useState('7d');
    const [saving, setSaving] = useState(false);
    const [updating, setUpdating] = useState(false);
    const [result, setResult] = useState<JsonBin | null>(null);
    const [history, setHistory] = useState<JsonBin[]>([]);
    const [copiedField, setCopiedField] = useState<string | null>(null);
    const [editMode, setEditMode] = useState<{ id: string; token: string } | null>(null);
    const [showSnippets, setShowSnippets] = useState(false);
    const [activeSnippet, setActiveSnippet] = useState<'javascript' | 'python' | 'curl'>('javascript');
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { toasts, addToast, removeToast } = useToast();

    // Load history from localStorage
    useEffect(() => {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            try {
                const parsed = JSON.parse(stored);
                setHistory(Array.isArray(parsed) ? parsed : []);
            } catch {
                setHistory([]);
            }
        }
    }, []);

    // Check for edit mode from URL params
    useEffect(() => {
        const editId = searchParams.get('edit');
        const token = searchParams.get('token');

        if (editId && token) {
            setEditMode({ id: editId, token });
            // Load the JSON content
            fetch(`/j/${editId}`)
                .then(res => {
                    if (!res.ok) throw new Error('Not found');
                    return res.json();
                })
                .then(data => {
                    setJsonInput(JSON.stringify(data, null, 2));
                    const baseUrl = window.location.origin;
                    setResult({
                        id: editId,
                        url: `${baseUrl}/j/${editId}`,
                        viewUrl: `${baseUrl}/view/${editId}`,
                        editUrl: `${baseUrl}/json?edit=${editId}&token=${token}`,
                        editToken: token,
                        expiresAt: null,
                        ttl: 'unknown',
                        createdAt: new Date().toISOString(),
                        preview: '',
                    });
                    addToast('Loaded for editing', 'success');
                })
                .catch(() => {
                    addToast('Failed to load JSON - may have expired', 'error');
                    setEditMode(null);
                });
        }
    }, [searchParams, addToast]);

    // Validate JSON on input change
    useEffect(() => {
        setValidation(validateJson(jsonInput));
    }, [jsonInput]);

    const saveToHistory = useCallback((bin: JsonBin) => {
        setHistory(prev => {
            const updated = [bin, ...prev.filter(b => b.id !== bin.id)].slice(0, MAX_HISTORY);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
            return updated;
        });
    }, []);

    const removeFromHistory = useCallback((id: string) => {
        setHistory(prev => {
            const updated = prev.filter(b => b.id !== id);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
            return updated;
        });
        addToast('Removed from history', 'info');
    }, [addToast]);

    const handleSave = async () => {
        if (!validation.valid) {
            addToast('Please enter valid JSON', 'error');
            return;
        }

        setSaving(true);
        try {
            const response = await fetch(`/api/json?ttl=${ttl}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: jsonInput,
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to save');
            }

            const data = await response.json();
            const bin: JsonBin = {
                id: data.id,
                url: data.url,
                viewUrl: data.viewUrl,
                editUrl: data.editUrl,
                editToken: data.editToken,
                expiresAt: data.expiresAt,
                ttl: data.ttl,
                createdAt: new Date().toISOString(),
                preview: getPreview(jsonInput),
            };

            setResult(bin);
            setEditMode({ id: bin.id, token: bin.editToken });
            saveToHistory(bin);
            addToast('JSON saved successfully!', 'success');
        } catch (error) {
            console.error(error);
            addToast(error instanceof Error ? error.message : 'Failed to save JSON', 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleUpdate = async () => {
        if (!validation.valid || !editMode) {
            addToast('Cannot update', 'error');
            return;
        }

        setUpdating(true);
        try {
            const response = await fetch(`/api/json?id=${editMode.id}&token=${editMode.token}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: jsonInput,
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to update');
            }

            addToast('JSON updated! Same URL works.', 'success');

            // Update history preview
            if (result) {
                const updatedBin = { ...result, preview: getPreview(jsonInput) };
                saveToHistory(updatedBin);
            }
        } catch (error) {
            console.error(error);
            addToast(error instanceof Error ? error.message : 'Failed to update', 'error');
        } finally {
            setUpdating(false);
        }
    };

    const handleFormat = () => {
        if (validation.formatted) {
            setJsonInput(validation.formatted);
            addToast('JSON formatted', 'success');
        }
    };

    const handleMinify = () => {
        if (validation.valid) {
            try {
                const minified = JSON.stringify(JSON.parse(jsonInput));
                setJsonInput(minified);
                addToast('JSON minified', 'success');
            } catch {
                addToast('Failed to minify', 'error');
            }
        }
    };

    const handleClear = () => {
        setJsonInput('');
        setResult(null);
        setEditMode(null);
        // Clear URL params
        window.history.replaceState({}, '', '/json');
    };

    const handleImportClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            const content = e.target?.result as string;
            try {
                // Try parsing to verify it's valid JSON, but allow editing even if slightly off (though requirements say valid json)
                // Actually the tool validates on input change, so we just set the text.
                // We'll throw if it's not even text.

                // Let's verify it's valid JSON for better UX before setting
                JSON.parse(content);
                setJsonInput(content);
                addToast('JSON imported successfully', 'success');
            } catch (error) {
                addToast('Invalid JSON file', 'error');
            }
        };
        reader.onerror = () => {
            addToast('Error reading file', 'error');
        };
        reader.readAsText(file);

        // Reset input so same file can be selected again
        event.target.value = '';
    };

    const handleCopy = async (text: string, field: string) => {
        await navigator.clipboard.writeText(text);
        setCopiedField(field);
        addToast('Copied!', 'success');
        setTimeout(() => setCopiedField(null), 2000);
    };

    const handleLoadFromHistory = (bin: JsonBin) => {
        fetch(bin.url)
            .then(res => res.json())
            .then(data => {
                setJsonInput(JSON.stringify(data, null, 2));
                setResult(bin);
                setEditMode({ id: bin.id, token: bin.editToken });
                addToast('Loaded from history', 'success');
            })
            .catch(() => {
                addToast('Failed to load - bin may have expired', 'error');
                removeFromHistory(bin.id);
            });
    };

    const formatExpiry = (expiresAt: string | null) => {
        if (!expiresAt) return 'Never';
        const date = new Date(expiresAt);
        const now = new Date();
        const diff = date.getTime() - now.getTime();

        if (diff < 0) return 'Expired';
        if (diff < 3600000) return `${Math.round(diff / 60000)}m`;
        if (diff < 86400000) return `${Math.round(diff / 3600000)}h`;
        return `${Math.round(diff / 86400000)}d`;
    };

    const snippets = result ? generateSnippets(result.url) : null;

    return (
        <div className={styles.container}>
            <div className={styles.backgroundGradient}></div>

            <Toast toasts={toasts} removeToast={removeToast} />
            <Navigation />

            <header className={styles.header}>
                <div className={styles.logo}>
                    <span className={styles.logoIcon}>
                        <CodeIcon size={32} />
                    </span>
                    <h1>JSON Server</h1>
                </div>
                <p className={styles.tagline}>
                    Paste JSON, get a public URL. Simple API hosting.
                </p>
            </header>

            <main className={styles.main}>
                <div className={styles.editorSection}>
                    {/* Edit Mode Indicator */}
                    {editMode && (
                        <div className={styles.editModeBar}>
                            <RefreshIcon size={16} />
                            <span>Editing: <code>{editMode.id}</code></span>
                            <button onClick={handleClear} className={styles.exitEditButton}>
                                Create New
                            </button>
                        </div>
                    )}

                    {/* Toolbar */}
                    <div className={styles.toolbar}>
                        <div className={styles.toolbarLeft}>
                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleFileChange}
                                accept="application/json"
                                style={{ display: 'none' }}
                            />
                            <button
                                onClick={handleImportClick}
                                className={styles.toolButton}
                                title="Import JSON file"
                            >
                                <UploadIcon size={16} style={{ marginRight: '6px' }} />
                                Import
                            </button>
                            <button
                                onClick={handleFormat}
                                disabled={!validation.valid}
                                className={styles.toolButton}
                                title="Format JSON"
                            >
                                Format
                            </button>
                            <button
                                onClick={handleMinify}
                                disabled={!validation.valid}
                                className={styles.toolButton}
                                title="Minify JSON"
                            >
                                Minify
                            </button>
                            <button
                                onClick={handleClear}
                                className={`${styles.toolButton} ${styles.clearButton}`}
                                title="Clear"
                            >
                                Clear
                            </button>
                        </div>
                        <div className={styles.toolbarRight}>
                            {!editMode && (
                                <select
                                    value={ttl}
                                    onChange={(e) => setTtl(e.target.value)}
                                    className={styles.ttlSelect}
                                >
                                    {TTL_OPTIONS.map(opt => (
                                        <option key={opt.value} value={opt.value}>
                                            Expires: {opt.label}
                                        </option>
                                    ))}
                                </select>
                            )}
                        </div>
                    </div>

                    {/* Editor */}
                    <div className={styles.editorWrapper}>
                        <textarea
                            ref={textareaRef}
                            value={jsonInput}
                            onChange={(e) => setJsonInput(e.target.value)}
                            placeholder='Paste your JSON here...\n\n{\n  "name": "Example",\n  "data": [1, 2, 3]\n}'
                            className={`${styles.editor} ${validation.error ? styles.editorError : validation.valid ? styles.editorValid : ''}`}
                            spellCheck={false}
                        />
                        {validation.error && (
                            <div className={styles.errorMessage}>
                                ❌ {validation.error}
                            </div>
                        )}
                        {validation.valid && jsonInput && (
                            <div className={styles.validMessage}>
                                ✓ Valid JSON
                            </div>
                        )}
                    </div>

                    {/* Action Buttons */}
                    <div className={styles.actionButtons}>
                        {editMode ? (
                            <>
                                <button
                                    onClick={handleUpdate}
                                    disabled={!validation.valid || updating}
                                    className={styles.updateButton}
                                >
                                    {updating ? 'Updating...' : 'Update (Keep URL)'}
                                </button>
                                <button
                                    onClick={handleSave}
                                    disabled={!validation.valid || saving}
                                    className={styles.saveNewButton}
                                >
                                    {saving ? 'Saving...' : 'Save as New'}
                                </button>
                            </>
                        ) : (
                            <button
                                onClick={handleSave}
                                disabled={!validation.valid || saving}
                                className={styles.saveButton}
                            >
                                {saving ? 'Saving...' : 'Save & Get URL'}
                            </button>
                        )}
                    </div>

                    {/* Result Panel */}
                    {result && (
                        <div className={styles.resultPanel}>
                            <h3>🎉 Your JSON is live!</h3>

                            <div className={styles.urlRow}>
                                <label>Public URL</label>
                                <div className={styles.urlBox}>
                                    <code>{result.url}</code>
                                    <button
                                        onClick={() => handleCopy(result.url, 'url')}
                                        className={styles.copyButton}
                                    >
                                        {copiedField === 'url' ? <CheckIcon size={16} /> : <CopyIcon size={16} />}
                                    </button>
                                    <a
                                        href={result.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className={styles.openButton}
                                    >
                                        <ExternalLinkIcon size={16} />
                                    </a>
                                </div>
                            </div>

                            <div className={styles.urlRow}>
                                <label>With Delay (test loading)</label>
                                <div className={styles.urlBox}>
                                    <code>{result.url}?delay=2s</code>
                                    <button
                                        onClick={() => handleCopy(`${result.url}?delay=2s`, 'delayUrl')}
                                        className={styles.copyButton}
                                    >
                                        {copiedField === 'delayUrl' ? <CheckIcon size={16} /> : <CopyIcon size={16} />}
                                    </button>
                                </div>
                            </div>

                            <div className={styles.resultMeta}>
                                <span><ClockIcon size={14} /> Expires: {formatExpiry(result.expiresAt)}</span>
                            </div>

                            {/* Code Snippets */}
                            <div className={styles.snippetsSection}>
                                <button
                                    onClick={() => setShowSnippets(!showSnippets)}
                                    className={styles.snippetsToggle}
                                >
                                    {showSnippets ? '▼' : '▶'} Code Snippets
                                </button>

                                {showSnippets && snippets && (
                                    <div className={styles.snippetsContent}>
                                        <div className={styles.snippetTabs}>
                                            {(['javascript', 'python', 'curl'] as const).map(lang => (
                                                <button
                                                    key={lang}
                                                    onClick={() => setActiveSnippet(lang)}
                                                    className={`${styles.snippetTab} ${activeSnippet === lang ? styles.activeTab : ''}`}
                                                >
                                                    {lang === 'javascript' ? 'JS' : lang === 'python' ? 'Python' : 'cURL'}
                                                </button>
                                            ))}
                                        </div>
                                        <div className={styles.snippetCode}>
                                            <pre>{snippets[activeSnippet]}</pre>
                                            <button
                                                onClick={() => handleCopy(snippets[activeSnippet], 'snippet')}
                                                className={styles.snippetCopy}
                                            >
                                                {copiedField === 'snippet' ? <CheckIcon size={14} /> : <CopyIcon size={14} />}
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* History Section */}
                {history.length > 0 && (
                    <div className={styles.historySection}>
                        <h3>📜 Recent Bins</h3>
                        <div className={styles.historyList}>
                            {history.map(bin => (
                                <div key={bin.id} className={styles.historyItem}>
                                    <div className={styles.historyPreview}>
                                        <code>{bin.preview}</code>
                                    </div>
                                    <div className={styles.historyMeta}>
                                        <span className={styles.historyId}>{bin.id}</span>
                                        <span className={styles.historyExpiry}>
                                            {formatExpiry(bin.expiresAt)}
                                        </span>
                                    </div>
                                    <div className={styles.historyActions}>
                                        <button
                                            onClick={() => handleLoadFromHistory(bin)}
                                            className={styles.historyButton}
                                            title="Load & Edit"
                                        >
                                            <LinkIcon size={14} />
                                        </button>
                                        <button
                                            onClick={() => handleCopy(bin.url, bin.id)}
                                            className={styles.historyButton}
                                            title="Copy URL"
                                        >
                                            {copiedField === bin.id ? <CheckIcon size={14} /> : <CopyIcon size={14} />}
                                        </button>
                                        <button
                                            onClick={() => removeFromHistory(bin.id)}
                                            className={`${styles.historyButton} ${styles.deleteButton}`}
                                            title="Remove"
                                        >
                                            <TrashIcon size={14} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Features */}
                <div className={styles.features}>
                    <div className={styles.feature}>
                        <div className={styles.featureIcon}>
                            <RefreshIcon size={24} />
                        </div>
                        <h3>Edit Mode</h3>
                        <p>Update JSON while keeping the same URL</p>
                    </div>
                    <div className={styles.feature}>
                        <div className={styles.featureIcon}>
                            <ClockIcon size={24} />
                        </div>
                        <h3>Mock Delay</h3>
                        <p>Add ?delay=2s to test loading states</p>
                    </div>
                    <div className={styles.feature}>
                        <div className={styles.featureIcon}>
                            <CodeIcon size={24} />
                        </div>
                        <h3>Code Snippets</h3>
                        <p>Ready-to-use JS, Python, cURL code</p>
                    </div>
                </div>
            </main>
        </div>
    );
}
