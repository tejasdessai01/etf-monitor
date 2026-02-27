'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, ExternalLink, TrendingUp, TrendingDown, AlertCircle } from 'lucide-react';
import PriceChart from '@/components/etf/PriceChart';

interface ETFDetail {
  ticker: string;
  name: string;
  price: number | null;
  change: number | null;
  changePct: number | null;
  aum: number | null;
  nav: number | null;
  expenseRatio: number | null;
  dividendYield: number | null;
  beta: number | null;
  inceptionDate: string | null;
  description: string | null;
  category: string | null;
  family: string | null;
  week52High: number | null;
  week52Low: number | null;
  volume: number | null;
  avgVolume: number | null;
  holdings: Array<{ ticker: string; name: string; weight: number }>;
  holdingsDate: string | null;
  holdingsSource: 'nport' | 'unavailable';
  sectors: Array<{ sector: string; weight: number }>;
  performance: Record<string, number | null>;
  priceHistory: Array<{ date: number; price: number }>;
}

// ── Formatters ────────────────────────────────────────────────────────────────
function fp(v: number | null, dec = 2) {
  if (v == null) return '—';
  return `$${v.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec })}`;
}
function faum(v: number | null) {
  if (v == null) return '—';
  if (v >= 1e12) return `$${(v / 1e12).toFixed(2)}T`;
  if (v >= 1e9)  return `$${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6)  return `$${(v / 1e6).toFixed(0)}M`;
  return `$${v.toLocaleString()}`;
}
function fexp(v: number | null) {
  if (v == null) return '—';
  return `${(v * 100).toFixed(2)}%`;
}
function fvol(v: number | null) {
  if (v == null) return '—';
  if (v >= 1e9) return `${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(0)}K`;
  return v.toString();
}
function fdate(s: string | null) {
  if (!s) return '—';
  return new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
function fyear(s: string | null) {
  if (!s) return '—';
  return new Date(s).getFullYear().toString();
}

// ── Sub-components ────────────────────────────────────────────────────────────
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'monospace' }}>
        {value}
      </div>
    </div>
  );
}

function PerfRow({ label, value, annualized }: { label: string; value: number | null; annualized?: boolean }) {
  const isPos = value != null && value >= 0;
  const color = value == null ? 'var(--text-muted)' : isPos ? '#22c55e' : '#ef4444';
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
      <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
        {label}
        {annualized && <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 4 }}>(ann.)</span>}
      </span>
      <span style={{ fontSize: 13, fontWeight: 700, color, fontFamily: 'monospace' }}>
        {value == null ? '—' : `${isPos ? '+' : ''}${(value * 100).toFixed(2)}%`}
      </span>
    </div>
  );
}

function SectorBar({ sector, weight, maxWeight }: { sector: string; weight: number; maxWeight: number }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
        <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{sector}</span>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'monospace' }}>
          {weight.toFixed(1)}%
        </span>
      </div>
      <div style={{ height: 5, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${(weight / maxWeight) * 100}%`, background: '#3b82f6', borderRadius: 3, transition: 'width 0.4s ease' }} />
      </div>
    </div>
  );
}

function HoldingRow({ rank, ticker, name, weight, maxWeight }: {
  rank: number; ticker: string; name: string; weight: number; maxWeight: number;
}) {
  return (
    <div className="fund-holding-row">
      <span style={{ fontSize: 10, color: 'var(--text-muted)', textAlign: 'right' }}>{rank}</span>
      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'monospace' }}>
        {ticker || '—'}
      </span>
      <span style={{ fontSize: 12, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {name}
      </span>
      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', textAlign: 'right', fontFamily: 'monospace' }}>
        {weight.toFixed(2)}%
      </span>
      {/* Bar — hidden on mobile via .fund-bar-col */}
      <div className="fund-bar-col" style={{ height: 5, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${(weight / maxWeight) * 100}%`, background: '#3b82f6', borderRadius: 3 }} />
      </div>
    </div>
  );
}

function Skeleton({ h, w = '100%' }: { h: number; w?: string }) {
  return <div className="skeleton" style={{ height: h, width: w, borderRadius: 6 }} />;
}

const MB14: React.CSSProperties = { marginBottom: 14 };

// ── Page ──────────────────────────────────────────────────────────────────────
export default function ETFPage() {
  const params = useParams();
  const ticker = ((params?.ticker as string) ?? '').toUpperCase();

  const [data, setData]       = useState<ETFDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    if (!ticker) return;
    setLoading(true);
    setError(null);
    fetch(`/api/etf/${ticker}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) throw new Error(d.error);
        setData(d);
        setLoading(false);
      })
      .catch(e => {
        setError(e.message ?? 'Failed to load fund data');
        setLoading(false);
      });
  }, [ticker]);

  const isPos    = (data?.changePct ?? 0) >= 0;
  const chgColor = isPos ? '#22c55e' : '#ef4444';

  // ── Loading ─────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', paddingBottom: 40 }}>
        <div className="fund-wrap">
          <div style={{ marginBottom: 14 }}><Skeleton h={14} w="80px" /></div>
          <div className="panel fp-hero" style={MB14}><Skeleton h={32} w="60%" /></div>
          <div className="panel fp-stats" style={MB14}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: '14px 20px' }}>
              {Array.from({ length: 10 }).map((_, i) => <Skeleton key={i} h={34} />)}
            </div>
          </div>
          <div className="panel fp" style={MB14}><Skeleton h={260} /></div>
        </div>
      </div>
    );
  }

  // ── Error ────────────────────────────────────────────────────────────────────
  if (error || !data) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
        <div style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
          <AlertCircle size={32} style={{ marginBottom: 12, opacity: 0.5 }} />
          <div style={{ fontSize: 15, marginBottom: 6 }}>Could not load {ticker}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>{error}</div>
          <Link href="/" style={{ fontSize: 12, color: '#3b82f6', textDecoration: 'none' }}>← Back to Dashboard</Link>
        </div>
      </div>
    );
  }

  const maxSector  = data.sectors[0]?.weight  ?? 1;
  const maxHolding = data.holdings[0]?.weight ?? 1;
  const perf       = data.performance;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', paddingBottom: 48 }}>
      <div className="fund-wrap">

        {/* ── Back link ────────────────────────────────────────────────────── */}
        <Link href="/" style={{
          display: 'inline-flex', alignItems: 'center', gap: 5,
          color: 'var(--text-muted)', fontSize: 12, textDecoration: 'none', marginBottom: 14,
        }}>
          <ArrowLeft size={13} /> Back to Dashboard
        </Link>

        {/* ── Hero ─────────────────────────────────────────────────────────── */}
        <div className="panel fp-hero" style={MB14}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div style={{ flex: '1 1 0', minWidth: 0 }}>

              {/* Ticker + icon */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span className="fund-ticker" style={{ fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'monospace', letterSpacing: '-1px' }}>
                  {data.ticker}
                </span>
                {data.changePct != null && (
                  isPos
                    ? <TrendingUp size={20} color={chgColor} />
                    : <TrendingDown size={20} color={chgColor} />
                )}
              </div>

              {/* Name */}
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 10, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {data.name}
              </div>

              {/* Price + change */}
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
                <span className="fund-price" style={{ fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'monospace', letterSpacing: '-0.5px' }}>
                  {fp(data.price)}
                </span>
                {data.change != null && (
                  <span style={{ fontSize: 13, fontWeight: 600, color: chgColor }}>
                    {data.change >= 0 ? '+' : ''}{data.change.toFixed(2)}
                    {data.changePct != null && ` (${data.changePct >= 0 ? '+' : ''}${(data.changePct * 100).toFixed(2)}%)`}
                  </span>
                )}
              </div>

              {/* Tags */}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {([data.family, data.category] as (string | null)[]).filter(Boolean).map((tag, i) => (
                  <span key={i} style={{
                    fontSize: 11, padding: '2px 8px', borderRadius: 4,
                    background: 'rgba(255,255,255,0.04)', color: 'var(--text-muted)',
                    border: '1px solid var(--border)',
                  }}>
                    {tag}
                  </span>
                ))}
              </div>
            </div>

            {/* External link */}
            <a
              href={`https://finance.yahoo.com/quote/${data.ticker}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                fontSize: 11, color: 'var(--text-muted)', textDecoration: 'none',
                padding: '5px 10px', border: '1px solid var(--border)', borderRadius: 6,
                alignSelf: 'flex-start', flexShrink: 0,
              }}
            >
              <ExternalLink size={11} /> Yahoo Finance
            </a>
          </div>
        </div>

        {/* ── Key stats ────────────────────────────────────────────────────── */}
        <div className="panel fp-stats" style={MB14}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: '14px 20px' }}>
            <Stat label="AUM"           value={faum(data.aum)} />
            <Stat label="NAV"           value={fp(data.nav)} />
            <Stat label="Expense Ratio" value={fexp(data.expenseRatio)} />
            <Stat label="Dividend Yield" value={data.dividendYield != null ? `${(data.dividendYield * 100).toFixed(2)}%` : '—'} />
            <Stat label="3Y Beta"       value={data.beta != null ? data.beta.toFixed(2) : '—'} />
            <Stat label="52w High"      value={fp(data.week52High)} />
            <Stat label="52w Low"       value={fp(data.week52Low)} />
            <Stat label="Volume"        value={fvol(data.volume)} />
            <Stat label="Avg Volume"    value={fvol(data.avgVolume)} />
            <Stat label="Inception"     value={fyear(data.inceptionDate)} />
          </div>
        </div>

        {/* ── Price chart ──────────────────────────────────────────────────── */}
        <div className="panel fp" style={MB14}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 14 }}>
            Price History
          </div>
          {data.priceHistory.length >= 2
            ? <PriceChart data={data.priceHistory} />
            : <div style={{ height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 13 }}>No price history available</div>
          }
        </div>

        {/* ── Performance + Sectors ────────────────────────────────────────── */}
        <div className="fund-perf-sectors">

          {/* Performance */}
          <div className="panel fp">
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
              Total Returns
            </div>
            <PerfRow label="1 Month"  value={perf['1M']} />
            <PerfRow label="3 Month"  value={perf['3M']} />
            <PerfRow label="6 Month"  value={perf['6M']} />
            <PerfRow label="YTD"      value={perf['YTD']} />
            <PerfRow label="1 Year"   value={perf['1Y']} />
            <PerfRow label="3 Year"   value={perf['3Y']} annualized />
            <PerfRow label="5 Year"   value={perf['5Y']} annualized />
          </div>

          {/* Sector breakdown */}
          <div className="panel fp">
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 14 }}>
              Sector Breakdown
            </div>
            {data.sectors.length > 0
              ? data.sectors.map(s => (
                  <SectorBar key={s.sector} sector={s.sector} weight={s.weight} maxWeight={maxSector} />
                ))
              : <div style={{ fontSize: 12, color: 'var(--text-muted)', paddingTop: 4 }}>Sector data not available</div>
            }
          </div>
        </div>

        {/* ── Holdings ─────────────────────────────────────────────────────── */}
        <div className="panel fp" style={MB14}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 12 }}>
            Top Holdings
          </div>

          {data.holdings.length > 0 ? (
            <>
              {/* Column headers */}
              <div className="fund-holding-hdr">
                <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>#</span>
                <span style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Ticker</span>
                <span style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Name</span>
                <span style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', textAlign: 'right' }}>Wt.</span>
                <span className="fund-bar-col" />
              </div>

              {data.holdings.map((h, i) => (
                <HoldingRow key={i} rank={i + 1} ticker={h.ticker} name={h.name} weight={h.weight} maxWeight={maxHolding} />
              ))}

              {data.holdingsDate && (
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 10 }}>
                  Source: SEC EDGAR NPORT-P · as of {fdate(data.holdingsDate)}
                </div>
              )}
            </>
          ) : (
            <div style={{ fontSize: 12, color: 'var(--text-muted)', paddingTop: 4 }}>
              Holdings unavailable — no NPORT-P filing found for this fund
            </div>
          )}
        </div>

        {/* ── About ────────────────────────────────────────────────────────── */}
        {data.description && (
          <div className="panel fp" style={MB14}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 10 }}>
              About
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.75, margin: 0 }}>
              {data.description}
            </p>
            <div style={{ marginTop: 12, fontSize: 11, color: 'var(--text-muted)' }}>
              Inception: {fdate(data.inceptionDate)}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
