import { Suspense } from 'react';
import Header from '@/components/Header';
import StatsBar from '@/components/StatsBar';
import ETFTable from '@/components/ETFTable';
import FilingsPanel from '@/components/FilingsPanel';
import NewsPanel from '@/components/NewsPanel';
import TopMovers from '@/components/TopMovers';
import NewLaunches from '@/components/NewLaunches';
import IssuerSnapshot from '@/components/IssuerSnapshot';
import SocialPanel from '@/components/SocialPanel';
import { SEED_ETFS } from '@/lib/etf-data';
import { fmtAum } from '@/lib/format';

// Compute stats server-side from seed data
const totalAUM = SEED_ETFS.reduce((sum, e) => sum + e.aum, 0);
const TOTAL_US_ETFS = 3400; // approximate count per SEC/ICI data

export default function DashboardPage() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)' }}>
      <Header />
      <StatsBar totalETFs={TOTAL_US_ETFS} totalAUM={totalAUM} />

      {/* ── Main grid ─────────────────────────────────────────────────────── */}
      <main
        id="overview"
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 340px',
          gridTemplateRows: 'auto auto',
          gap: '12px',
          padding: '12px',
          maxWidth: '1600px',
          margin: '0 auto',
        }}
      >
        {/* ── Row 1: ETF Table (left) + Right column ──────────────────────── */}
        <div style={{ display: 'grid', gridTemplateRows: '560px', gap: '12px' }}>
          <Suspense fallback={<PanelSkeleton height={560} />}>
            <ETFTable />
          </Suspense>
        </div>

        {/* Right column — stacked panels */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ height: '260px' }}>
            <Suspense fallback={<PanelSkeleton height={260} />}>
              <TopMovers />
            </Suspense>
          </div>
          <div style={{ height: '288px' }}>
            <Suspense fallback={<PanelSkeleton height={288} />}>
              <FilingsPanel />
            </Suspense>
          </div>
        </div>

        {/* ── Row 2: bottom panels ────────────────────────────────────────── */}
        {/* Bottom left: New Launches + Issuer split */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', height: '360px' }}>
          <Suspense fallback={<PanelSkeleton height={360} />}>
            <NewLaunches />
          </Suspense>
          <Suspense fallback={<PanelSkeleton height={360} />}>
            <IssuerSnapshot />
          </Suspense>
        </div>

        {/* Bottom right: News + Social */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', height: '360px' }}>
          <div style={{ flex: '1 1 0', minHeight: 0 }}>
            <Suspense fallback={<PanelSkeleton height={260} />}>
              <NewsPanel />
            </Suspense>
          </div>
          <div style={{ flexShrink: 0 }}>
            <SocialPanel />
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer style={{
        padding: '16px 20px',
        borderTop: '1px solid var(--border)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: '12px',
      }}>
        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
          ETF Monitor · Data from SEC EDGAR &amp; Yahoo Finance · Not financial advice
        </span>
        <div style={{ display: 'flex', gap: '16px' }}>
          {[
            { label: 'SEC EDGAR', url: 'https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&type=N-1A&dateb=&owner=include&count=40' },
            { label: 'ICI Data', url: 'https://www.ici.org/research/stats' },
            { label: 'ETF.com', url: 'https://www.etf.com' },
          ].map(({ label, url }) => (
            <a
              key={label}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              style={{ fontSize: '11px', color: 'var(--text-muted)', textDecoration: 'none' }}
            >
              {label} ↗
            </a>
          ))}
        </div>
      </footer>
    </div>
  );
}

function PanelSkeleton({ height }: { height: number }) {
  return (
    <div className="panel skeleton" style={{ height, borderRadius: '8px' }} />
  );
}
