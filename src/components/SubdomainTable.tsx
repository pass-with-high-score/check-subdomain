'use client';

import { useState, useMemo } from 'react';
import styles from './SubdomainTable.module.css';
import Toast, { useToast } from './Toast';
import { SearchIcon, CopyIcon, CloudIcon } from './Icons';

interface ScanResult {
    subdomain: string;
    ip: string | null;
    cloudflare: boolean;
}

interface SubdomainTableProps {
    subdomains: ScanResult[];
}

type SortKey = 'subdomain' | 'ip' | 'cloudflare';
type SortOrder = 'asc' | 'desc';

type FilterType = 'all' | 'cloudflare' | 'non-cloudflare' | 'has-ip' | 'no-ip';

export default function SubdomainTable({ subdomains }: SubdomainTableProps) {
    const [sortKey, setSortKey] = useState<SortKey>('subdomain');
    const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
    const [filter, setFilter] = useState<FilterType>('all');
    const [search, setSearch] = useState('');
    const { toasts, addToast, removeToast } = useToast();

    const handleSort = (key: SortKey) => {
        if (sortKey === key) {
            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
        } else {
            setSortKey(key);
            setSortOrder('asc');
        }
    };

    const filteredAndSorted = useMemo(() => {
        let result = [...subdomains];

        // Apply filter
        switch (filter) {
            case 'cloudflare':
                result = result.filter(s => s.cloudflare);
                break;
            case 'non-cloudflare':
                result = result.filter(s => !s.cloudflare && s.ip);
                break;
            case 'has-ip':
                result = result.filter(s => s.ip);
                break;
            case 'no-ip':
                result = result.filter(s => !s.ip);
                break;
        }

        // Apply search
        if (search) {
            const searchLower = search.toLowerCase();
            result = result.filter(s =>
                s.subdomain.toLowerCase().includes(searchLower) ||
                (s.ip && s.ip.includes(search))
            );
        }

        // Apply sort
        result.sort((a, b) => {
            let comparison = 0;

            switch (sortKey) {
                case 'subdomain':
                    comparison = a.subdomain.localeCompare(b.subdomain);
                    break;
                case 'ip':
                    const ipA = a.ip || '';
                    const ipB = b.ip || '';
                    comparison = ipA.localeCompare(ipB);
                    break;
                case 'cloudflare':
                    comparison = (a.cloudflare ? 1 : 0) - (b.cloudflare ? 1 : 0);
                    break;
            }

            return sortOrder === 'asc' ? comparison : -comparison;
        });

        return result;
    }, [subdomains, filter, search, sortKey, sortOrder]);

    const handleCopySubdomain = async (subdomain: string) => {
        await navigator.clipboard.writeText(subdomain);
        addToast(`Copied: ${subdomain.length > 30 ? subdomain.slice(0, 30) + '...' : subdomain}`);
    };

    const handleCopyAll = async () => {
        const text = filteredAndSorted.map(s => s.subdomain).join('\n');
        await navigator.clipboard.writeText(text);
        addToast(`Copied ${filteredAndSorted.length} subdomains!`);
    };

    return (
        <div className={styles.tableContainer}>
            {/* Toast Notifications */}
            <Toast toasts={toasts} removeToast={removeToast} />

            {/* Controls */}
            <div className={styles.controls}>
                <div className={styles.searchWrapper}>
                    <SearchIcon size={18} className={styles.searchIcon} />
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search subdomains or IPs..."
                        className={styles.searchInput}
                    />
                </div>

                <div className={styles.filterWrapper}>
                    <label>Filter:</label>
                    <select
                        value={filter}
                        onChange={(e) => setFilter(e.target.value as FilterType)}
                        className={styles.filterSelect}
                    >
                        <option value="all">All ({subdomains.length})</option>
                        <option value="cloudflare">Cloudflare ({subdomains.filter(s => s.cloudflare).length})</option>
                        <option value="non-cloudflare">Non-Cloudflare ({subdomains.filter(s => !s.cloudflare && s.ip).length})</option>
                        <option value="has-ip">Has IP ({subdomains.filter(s => s.ip).length})</option>
                        <option value="no-ip">No IP ({subdomains.filter(s => !s.ip).length})</option>
                    </select>
                </div>

                <button onClick={handleCopyAll} className={styles.copyAllButton}>
                    <CopyIcon size={16} /> Copy All ({filteredAndSorted.length})
                </button>
            </div>

            {/* Results count */}
            <div className={styles.resultsCount}>
                Showing {filteredAndSorted.length} of {subdomains.length} subdomains
            </div>

            {/* Table */}
            <div className={styles.tableWrapper}>
                <table className={styles.table}>
                    <thead>
                        <tr>
                            <th onClick={() => handleSort('subdomain')} className={styles.sortable}>
                                Subdomain
                                {sortKey === 'subdomain' && (
                                    <span className={styles.sortIndicator}>{sortOrder === 'asc' ? '↑' : '↓'}</span>
                                )}
                            </th>
                            <th onClick={() => handleSort('ip')} className={styles.sortable}>
                                IP Address
                                {sortKey === 'ip' && (
                                    <span className={styles.sortIndicator}>{sortOrder === 'asc' ? '↑' : '↓'}</span>
                                )}
                            </th>
                            <th onClick={() => handleSort('cloudflare')} className={styles.sortable}>
                                Cloudflare
                                {sortKey === 'cloudflare' && (
                                    <span className={styles.sortIndicator}>{sortOrder === 'asc' ? '↑' : '↓'}</span>
                                )}
                            </th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredAndSorted.map((item) => (
                            <tr key={item.subdomain} className={item.ip ? '' : styles.noIpRow}>
                                <td className={styles.subdomainCell}>
                                    <span className={styles.subdomain}>{item.subdomain}</span>
                                </td>
                                <td className={styles.ipCell}>
                                    {item.ip ? (
                                        <code className={styles.ip}>{item.ip}</code>
                                    ) : (
                                        <span className={styles.noIp}>—</span>
                                    )}
                                </td>
                                <td className={styles.cloudflareCell}>
                                    {item.ip && (
                                        item.cloudflare ? (
                                            <span className={styles.cloudflareYes}>
                                                <CloudIcon size={16} className={styles.cloudflareIcon} /> Yes
                                            </span>
                                        ) : (
                                            <span className={styles.cloudflareNo}>No</span>
                                        )
                                    )}
                                </td>
                                <td className={styles.actionsCell}>
                                    <button
                                        onClick={() => handleCopySubdomain(item.subdomain)}
                                        className={styles.copyButton}
                                        title="Copy subdomain"
                                    >
                                        <CopyIcon size={16} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {filteredAndSorted.length === 0 && (
                <div className={styles.emptyState}>
                    No subdomains match your filter criteria
                </div>
            )}
        </div>
    );
}
