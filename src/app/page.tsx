'use client';

import { useState } from 'react';
import SubdomainTable from '@/components/SubdomainTable';
import styles from './page.module.css';

interface ScanResult {
  subdomain: string;
  ip: string | null;
  cloudflare: boolean;
}

interface ScanResponse {
  scan_date: string;
  domain: string;
  stats: {
    total: number;
    cloudflare: number;
    no_ip: number;
  };
  subdomains: ScanResult[];
}

export default function Home() {
  const [domain, setDomain] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ScanResponse | null>(null);

  const handleScan = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!domain.trim()) {
      setError('Please enter a domain');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: domain.trim() }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to scan domain');
      }

      const data: ScanResponse = await response.json();
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleExportJSON = () => {
    if (!result) return;

    const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${result.domain}-subdomains-${result.scan_date.replace(/[: ]/g, '-')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className={styles.container}>
      {/* Background Effects */}
      <div className={styles.backgroundGradient}></div>
      <div className={styles.backgroundGrid}></div>

      {/* Header */}
      <header className={styles.header}>
        <div className={styles.logo}>
          <span className={styles.logoIcon}>🔍</span>
          <h1>Subdomain Scanner</h1>
        </div>
        <p className={styles.tagline}>
          Discover subdomains using Certificate Transparency logs, resolve DNS records, and detect Cloudflare protection
        </p>
      </header>

      {/* Search Form */}
      <form onSubmit={handleScan} className={styles.searchForm}>
        <div className={styles.inputWrapper}>
          <input
            type="text"
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            placeholder="Enter domain (e.g., example.com)"
            className={styles.input}
            disabled={loading}
          />
          <button
            type="submit"
            className={styles.scanButton}
            disabled={loading}
          >
            {loading ? (
              <>
                <span className={styles.spinner}></span>
                Scanning...
              </>
            ) : (
              <>
                <span className={styles.buttonIcon}>⚡</span>
                Scan
              </>
            )}
          </button>
        </div>
      </form>

      {/* Error Message */}
      {error && (
        <div className={styles.errorMessage}>
          <span className={styles.errorIcon}>⚠️</span>
          {error}
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className={styles.loadingState}>
          <div className={styles.loadingSpinner}></div>
          <p>Scanning subdomains...</p>
          <p className={styles.loadingHint}>This may take a few moments depending on the domain size</p>
        </div>
      )}

      {/* Results */}
      {result && (
        <div className={styles.results}>
          {/* Stats Cards */}
          <div className={styles.statsGrid}>
            <div className={styles.statCard}>
              <span className={styles.statValue}>{result.stats.total}</span>
              <span className={styles.statLabel}>Total Subdomains</span>
            </div>
            <div className={`${styles.statCard} ${styles.statCardCloudflare}`}>
              <span className={styles.statValue}>{result.stats.cloudflare}</span>
              <span className={styles.statLabel}>Behind Cloudflare</span>
            </div>
            <div className={`${styles.statCard} ${styles.statCardNoIp}`}>
              <span className={styles.statValue}>{result.stats.no_ip}</span>
              <span className={styles.statLabel}>No IP Found</span>
            </div>
          </div>

          {/* Meta Info */}
          <div className={styles.metaInfo}>
            <span>Domain: <strong>{result.domain}</strong></span>
            <span>Scanned: <strong>{result.scan_date}</strong></span>
            <button onClick={handleExportJSON} className={styles.exportButton}>
              <span>📥</span> Export JSON
            </button>
          </div>

          {/* Table */}
          <SubdomainTable subdomains={result.subdomains} />
        </div>
      )}

      {/* Footer */}
      <footer className={styles.footer}>
        <p>Built with Next.js • Using Certificate Transparency logs from crt.sh</p>
      </footer>
    </div>
  );
}
