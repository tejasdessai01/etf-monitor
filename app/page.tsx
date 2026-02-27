import { Suspense } from 'react';
import Header from '@/components/Header';
import StatsBar from '@/components/StatsBar';
import ETFTable from '@/components/ETFTable';
import FilingsPanel from '@/components/FilingsPanel';
import NewsPanel from '@/components/NewsPanel';
import TopMovers from '@/components/TopMovers';
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

        {/* ── Row 1 left: ETF Table ─────────────────────────────────────── */}
        <div className="dashboard-etf-table">
          <Suspense fallback={<PanelSkeleton height={560} />}>
            <ETFTable />
          </Suspense>
        </div>

        {/* ── Row 1 right: Top Movers + Filings ────────────────────────── */}
        <div className="dashboard-right-col">
          <div className="dashboard-movers">
            <Suspense fallback={<PanelSkeleton height={260} />}>
              <TopMovers />
            </Suspense>
          </div>
          <div className="dashboard-filings">
            <Suspense fallback={<PanelSkeleton height={288} />}>
              <FilingsPanel />
            </Suspense>
          </div>
        </div>

        {/* ── Row 2 left: New Launches + Issuer ────────────────────────── */}
        <div className="dashboard-bottom-left">
          <Suspense fallback={<PanelSkeleton height={360} />}>
            <NewLaunches />
          </Suspense>
          <Suspense fallback={<PanelSkeleton height={360} />}>
            <IssuerSnapshot />
          </Suspense>
        </div>

        {/* ── Row 2 right: News (full height) ──────────────────────────── */}
        <div className="dashboard-bottom-right">
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
