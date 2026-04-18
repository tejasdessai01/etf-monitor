import { Suspense } from 'react';
import Header from '@/components/Header';
import StatsBar from '@/components/StatsBar';
import FilingsPanel from '@/components/FilingsPanel';
import NewsPanel from '@/components/NewsPanel';
import NewLaunches from '@/components/NewLaunches';
import IssuerSnapshot from '@/components/IssuerSnapshot';
import { SEED_ETFS } from '@/lib/etf-data';

const totalAUM = SEED_ETFS.reduce((sum, e) => sum + e.aum, 0);

export default function DashboardPage() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)' }}>
      <Header />
      <StatsBar totalAUM={totalAUM} />

      <main id="overview" className="dashboard-grid">

        {/* ── Hero row: SEC Filings + New ETF Launches ─────────────────── */}
        <div className="dashboard-filings-hero">
          <Suspense fallback={<PanelSkeleton height={620} />}>
            <FilingsPanel />
          </Suspense>
        </div>
        <div className="dashboard-launches-hero">
          <Suspense fallback={<PanelSkeleton height={620} />}>
            <NewLaunches />
          </Suspense>
        </div>

        {/* ── Secondary row: Issuer + News ─────────────────────────────── */}
        <div className="dashboard-issuer">
          <Suspense fallback={<PanelSkeleton height={360} />}>
            <IssuerSnapshot />
          </Suspense>
        </div>
        <div className="dashboard-news">
          <Suspense fallback={<PanelSkeleton height={360} />}>
            <NewsPanel />
          </Suspense>
        </div>

      </main>

      <footer style={{
        padding: '16px 20px',
        borderTop: '1px solid var(--border)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: '12px',
        flexWrap: 'wrap',
        gap: '8px',
      }}>
        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
          ETF Monitor · SEC EDGAR &amp; Yahoo Finance · Not financial advice
        </span>
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
          {[
            { label: 'SEC EDGAR', url: 'https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&type=N-1A&dateb=&owner=include&count=40' },
            { label: 'ICI Data',  url: 'https://www.ici.org/research/stats' },
            { label: 'ETF.com',   url: 'https://www.etf.com' },
          ].map(({ label, url }) => (
            <a key={label} href={url} target="_blank" rel="noopener noreferrer"
              style={{ fontSize: '11px', color: 'var(--text-muted)', textDecoration: 'none' }}>
              {label} ↗
            </a>
          ))}
        </div>
      </footer>
    </div>
  );
}

function PanelSkeleton({ height }: { height: number }) {
  return <div className="panel skeleton" style={{ height, borderRadius: '8px' }} />;
}
