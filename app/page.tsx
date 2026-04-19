import { Suspense } from 'react';
import Header from '@/components/Header';
import StatsBar from '@/components/StatsBar';
import FilingsPanel from '@/components/FilingsPanel';
import NewsPanel from '@/components/NewsPanel';
import NewLaunches from '@/components/NewLaunches';
import IssuerSnapshot from '@/components/IssuerSnapshot';

export default function DashboardPage() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <Header />
      <StatsBar />

      <main id="overview" className="dashboard-grid">
        <div className="dashboard-main">
          <Suspense fallback={<CardSkeleton height={600} />}>
            <FilingsPanel />
          </Suspense>
        </div>

        <aside className="dashboard-rail">
          <Suspense fallback={<CardSkeleton height={300} />}>
            <NewLaunches />
          </Suspense>
          <Suspense fallback={<CardSkeleton height={300} />}>
            <IssuerSnapshot />
          </Suspense>
          <Suspense fallback={<CardSkeleton height={280} />}>
            <NewsPanel />
          </Suspense>
        </aside>
      </main>

      <footer style={{
        padding: '20px 24px 32px',
        marginTop: 24,
        maxWidth: 1280,
        margin: '24px auto 0',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 12,
        borderTop: '1px solid var(--border)',
      }}>
        <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-subtle)' }}>
          ETF Monitor · SEC EDGAR &amp; Yahoo Finance · Not financial advice
        </span>
        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
          {[
            { label: 'SEC EDGAR', url: 'https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&type=N-1A&dateb=&owner=include&count=40' },
            { label: 'ICI Data',  url: 'https://www.ici.org/research/stats' },
            { label: 'ETF.com',   url: 'https://www.etf.com' },
          ].map(({ label, url }) => (
            <a key={label} href={url} target="_blank" rel="noopener noreferrer"
              style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', textDecoration: 'none' }}>
              {label} ↗
            </a>
          ))}
        </div>
      </footer>
    </div>
  );
}

function CardSkeleton({ height }: { height: number }) {
  return <div className="panel skeleton" style={{ height, borderRadius: 'var(--radius-lg)' }} />;
}
