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
        <a
          href="https://github.com/pass-with-high-score/check-subdomain"
          target="_blank"
          rel="noopener noreferrer"
          className={styles.githubLink}
        >
          <svg viewBox="0 0 24 24" className={styles.githubIcon} fill="currentColor">
            <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
          </svg>
          GitHub
        </a>
        <p>Built with Next.js • Using Certificate Transparency logs from crt.sh</p>
      </footer>
    </div>
  );
}
