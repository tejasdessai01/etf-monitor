'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, ExternalLink, TrendingUp, TrendingDown, AlertCircle } from 'lucide-react';
import PriceChart from '@/components/etf/PriceChart';
import IssuerAvatar from '@/components/IssuerAvatar';

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
      <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-subtle)', textTransform: 'uppercase', letterSpacing: '0.6px', fontWeight: 500, marginBottom: 4 }}>
        {label}
      </div>
      <div className="tabular" style={{ fontSize: 'var(--fs-md)', fontWeight: 600, color: 'var(--text)', letterSpacing: '-0.2px' }}>
        {value}
      </div>
    </div>
  );
}

function PerfRow({ label, value, annualized }: { label: string; value: number | null; annualized?: boolean }) {
  const isPos = value != null && value >= 0;
  const color = value == null ? 'var(--text-subtle)' : isPos ? 'var(--positive)' : 'var(--negative)';
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
      <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)' }}>
        {label}
        {annualized && <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-subtle)', marginLeft: 4 }}>(ann.)</span>}
      </span>
      <span className="tabular" style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color }}>
        {value == null ? '—' : `${isPos ? '+' : ''}${(value * 100).toFixed(2)}%`}
      </span>
    </div>
  );
}

function SectorBar({ sector, weight, maxWeight }: { sector: string; weight: number; maxWeight: number }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)' }}>{sector}</span>
        <span className="tabular" style={{ fontSize: 'var(--fs-sm)', fontWeight: 500, color: 'var(--text)' }}>
          {weight.toFixed(1)}%
        </span>
      </div>
      <div style={{ height: 4, background: 'var(--surface-soft)', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${(weight / maxWeight) * 100}%`, background: 'var(--accent)', borderRadius: 2, transition: 'width 400ms ease' }} />
      </div>
    </div>
  );
}

function HoldingRow({ rank, ticker, name, weight, maxWeight }: {
  rank: number; ticker: string; name: string; weight: number; maxWeight: number;
}) {
  return (
    <div className="fund-holding-row">
      <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-subtle)', textAlign: 'right' }}>{rank}</span>
      <span className="mono" style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--text)' }}>
        {ticker || '—'}
      </span>
      <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {name}
      </span>
      <span className="tabular" style={{ fontSize: 'var(--fs-sm)', fontWeight: 500, color: 'var(--text)', textAlign: 'right' }}>
        {weight.toFixed(2)}%
      </span>
      <div className="fund-bar-col" style={{ height: 4, background: 'var(--surface-soft)', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${(weight / maxWeight) * 100}%`, background: 'var(--accent)', borderRadius: 2 }} />
      </div>
    </div>
  );
}

function Skeleton({ h, w = '100%' }: { h: number; w?: string }) {
  return <div className="skeleton" style={{ height: h, width: w, borderRadius: 6 }} />;
}

const MB14: React.CSSProperties = { marginBottom: 16 };

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
  const chgColor = isPos ? 'var(--positive)' : 'var(--negative)';

  // ── Loading ─────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg)', paddingBottom: 48 }}>
        <div className="fund-wrap">
          <div style={{ marginBottom: 16 }}><Skeleton h={14} w="80px" /></div>
          <div className="panel fp-hero" style={MB14}><Skeleton h={32} w="60%" /></div>
          <div className="panel fp-stats" style={MB14}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '16px 24px' }}>
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
      <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
          <AlertCircle size={32} style={{ marginBottom: 12, opacity: 0.5 }} />
          <div style={{ fontSize: 'var(--fs-md)', marginBottom: 6, color: 'var(--text)' }}>Could not load {ticker}</div>
          <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-subtle)', marginBottom: 16 }}>{error}</div>
          <Link href="/" style={{ fontSize: 'var(--fs-sm)', color: 'var(--accent)', textDecoration: 'none' }}>← Back to Dashboard</Link>
        </div>
      </div>
    );
  }

  const maxSector  = data.sectors[0]?.weight  ?? 1;
  const maxHolding = data.holdings[0]?.weight ?? 1;
  const perf       = data.performance;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', paddingBottom: 48 }}>
      <div className="fund-wrap">

        {/* ── Back link ────────────────────────────────────────────────────── */}
        <Link href="/" style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          color: 'var(--text-muted)', fontSize: 'var(--fs-sm)', textDecoration: 'none', marginBottom: 16,
        }}>
          <ArrowLeft size={14} /> Back to Dashboard
        </Link>

        {/* ── Hero ─────────────────────────────────────────────────────────── */}
        <div className="panel fp-hero" style={MB14}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
            <div style={{ flex: '1 1 0', minWidth: 0, display: 'flex', gap: 16, alignItems: 'flex-start' }}>
              <IssuerAvatar name={data.family || data.name} size="lg" />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                  <span className="fund-ticker mono" style={{ fontWeight: 700, color: 'var(--text)', letterSpacing: '-1px' }}>
                    {data.ticker}
                  </span>
                  {data.changePct != null && (
                    isPos
                      ? <TrendingUp size={20} color="var(--positive)" />
                      : <TrendingDown size={20} color="var(--negative)" />
                  )}
                </div>

                <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)', marginBottom: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {data.name}
                </div>

                <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
                  <span className="fund-price tabular" style={{ fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.5px' }}>
                    {fp(data.price)}
                  </span>
                  {data.change != null && (
                    <span className="tabular" style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: chgColor }}>
                      {data.change >= 0 ? '+' : ''}{data.change.toFixed(2)}
                      {data.changePct != null && ` (${data.changePct >= 0 ? '+' : ''}${(data.changePct * 100).toFixed(2)}%)`}
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {([data.family, data.category] as (string | null)[]).filter(Boolean).map((tag, i) => (
                    <span key={i} className="tag">{tag}</span>
                  ))}
                </div>
              </div>
            </div>

            <a
              href={`https://finance.yahoo.com/quote/${data.ticker}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-ghost"
              style={{ fontSize: 'var(--fs-xs)', height: 30, padding: '0 12px' }}
            >
              <ExternalLink size={12} /> Yahoo Finance
            </a>
          </div>
        </div>

        {/* ── Key stats ────────────────────────────────────────────────────── */}
        <div className="panel fp-stats" style={MB14}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '16px 24px' }}>
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
          <div style={{ fontSize: 'var(--fs-base)', fontWeight: 600, color: 'var(--text)', marginBottom: 16 }}>
            Price history
          </div>
          {data.priceHistory.length >= 2
            ? <PriceChart data={data.priceHistory} />
            : <div style={{ height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-subtle)', fontSize: 'var(--fs-sm)' }}>No price history available</div>
          }
        </div>

        {/* ── Performance + Sectors ────────────────────────────────────────── */}
        <div className="fund-perf-sectors">
          <div className="panel fp">
            <div style={{ fontSize: 'var(--fs-base)', fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>
              Total returns
            </div>
            <PerfRow label="1 Month"  value={perf['1M']} />
            <PerfRow label="3 Month"  value={perf['3M']} />
            <PerfRow label="6 Month"  value={perf['6M']} />
            <PerfRow label="YTD"      value={perf['YTD']} />
            <PerfRow label="1 Year"   value={perf['1Y']} />
            <PerfRow label="3 Year"   value={perf['3Y']} annualized />
            <PerfRow label="5 Year"   value={perf['5Y']} annualized />
          </div>

          <div className="panel fp">
            <div style={{ fontSize: 'var(--fs-base)', fontWeight: 600, color: 'var(--text)', marginBottom: 16 }}>
              Sector breakdown
            </div>
            {data.sectors.length > 0
              ? data.sectors.map(s => (
                  <SectorBar key={s.sector} sector={s.sector} weight={s.weight} maxWeight={maxSector} />
                ))
              : <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-subtle)', paddingTop: 4 }}>Sector data not available</div>
            }
          </div>
        </div>

        {/* ── Holdings ─────────────────────────────────────────────────────── */}
        <div className="panel fp" style={MB14}>
          <div style={{ fontSize: 'var(--fs-base)', fontWeight: 600, color: 'var(--text)', marginBottom: 14 }}>
            Top holdings
          </div>

          {data.holdings.length > 0 ? (
            <>
              <div className="fund-holding-hdr">
                <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-subtle)' }}>#</span>
                <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-subtle)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Ticker</span>
                <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-subtle)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Name</span>
                <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-subtle)', textTransform: 'uppercase', letterSpacing: '0.5px', textAlign: 'right' }}>Wt.</span>
                <span className="fund-bar-col" />
              </div>

              {data.holdings.map((h, i) => (
                <HoldingRow key={i} rank={i + 1} ticker={h.ticker} name={h.name} weight={h.weight} maxWeight={maxHolding} />
              ))}

              {data.holdingsDate && (
                <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-subtle)', marginTop: 12 }}>
                  Source: SEC EDGAR NPORT-P · as of {fdate(data.holdingsDate)}
                </div>
              )}
            </>
          ) : (
            <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-subtle)', paddingTop: 4 }}>
              Holdings unavailable — no NPORT-P filing found for this fund
            </div>
          )}
        </div>

        {/* ── About ────────────────────────────────────────────────────────── */}
        {data.description && (
          <div className="panel fp" style={MB14}>
            <div style={{ fontSize: 'var(--fs-base)', fontWeight: 600, color: 'var(--text)', marginBottom: 12 }}>
              About
            </div>
            <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)', lineHeight: 1.7, margin: 0 }}>
              {data.description}
            </p>
            <div style={{ marginTop: 14, fontSize: 'var(--fs-xs)', color: 'var(--text-subtle)' }}>
              Inception: {fdate(data.inceptionDate)}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
