'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Award } from 'lucide-react';
import { CATEGORY_COLORS } from '@/lib/etf-data';

interface Entry {
  ticker: string;
  name: string;
  category: string;
  ytd: number | null;
  oneYear: number | null;
  twoYear: number | null;
  threeYear: number | null;
}

type Period = 'ytd' | 'oneYear' | 'twoYear' | 'threeYear';

const PERIODS: { key: Period; label: string }[] = [
  { key: 'ytd',       label: 'YTD'   },
  { key: 'oneYear',   label: '1Y'    },
  { key: 'twoYear',   label: '2Y'    },
  { key: 'threeYear', label: '3Y'    },
];

const CATEGORIES = ['All', 'US Equity', 'Fixed Income', 'International', 'Sector', 'Thematic'];

const CAT_SHORT: Record<string, string> = {
  'US Equity':    'US',
  'Fixed Income': 'FI',
  'International':'Intl',
  'Sector':       'Sec',
  'Thematic':     'Th',
};

function fmtReturn(v: number | null): string {
  if (v == null) return '—';
  return `${v >= 0 ? '+' : ''}${(v * 100).toFixed(1)}%`;
}

export default function TopPerformers() {
  const router = useRouter();
  const [data, setData]       = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod]   = useState<Period>('ytd');
  const [category, setCategory] = useState('All');

  useEffect(() => {
    fetch('/api/performers')
      .then(r => r.json())
      .then(json => { setData(json.data ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const ranked = useMemo(() => {
    const filtered = category === 'All' ? data : data.filter(e => e.category === category);
    return [...filtered]
      .filter(e => e[period] != null)
      .sort((a, b) => (b[period] as number) - (a[period] as number));
  }, [data, period, category]);

  // Max abs value for bar scaling
  const maxAbs = useMemo(() => {
    if (!ranked.length) return 1;
    return Math.max(...ranked.map(e => Math.abs(e[period] as number)), 0.01);
  }, [ranked, period]);

  return (
    <div className="panel" style={{ display: 'flex', flexDirection: 'column' }}>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="panel-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Award size={14} color="var(--yellow)" />
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
            Top Performing ETFs
          </span>
        </div>

        {/* Period tabs */}
        <div style={{ display: 'flex', gap: 3 }}>
          {PERIODS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setPeriod(key)}
              style={{
                fontSize: 11,
                padding: '3px 10px',
                borderRadius: 4,
                border: `1px solid ${period === key ? 'var(--blue)' : 'var(--border)'}`,
                background: period === key ? 'rgba(59,130,246,0.15)' : 'transparent',
                color: period === key ? 'var(--blue)' : 'var(--text-muted)',
                fontWeight: period === key ? 700 : 400,
                cursor: 'pointer',
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Category strip ─────────────────────────────────────────────── */}
      <div style={{
        display: 'flex',
        gap: 4,
        padding: '8px 14px',
        borderBottom: '1px solid var(--border)',
        overflowX: 'auto',
        scrollbarWidth: 'none',
        flexShrink: 0,
      }}>
        {CATEGORIES.map(cat => (
          <button
            key={cat}
            onClick={() => setCategory(cat)}
            style={{
              fontSize: 11,
              padding: '3px 10px',
              borderRadius: 12,
              border: 'none',
              whiteSpace: 'nowrap',
              cursor: 'pointer',
              background: category === cat
                ? (CATEGORY_COLORS[cat] ?? 'var(--blue)') + '28'
                : 'var(--border)',
              color: category === cat
                ? (CATEGORY_COLORS[cat] ?? 'var(--blue)')
                : 'var(--text-secondary)',
              fontWeight: category === cat ? 700 : 400,
            }}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* ── Rows ───────────────────────────────────────────────────────── */}
      <div style={{ overflowY: 'auto', flex: 1 }}>
        {loading ? (
          Array.from({ length: 8 }).map((_, i) => (
            <div key={i} style={{ padding: '9px 14px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
              <div className="skeleton" style={{ width: 16, height: 10, borderRadius: 3 }} />
              <div className="skeleton" style={{ width: 36, height: 22, borderRadius: 5 }} />
              <div className="skeleton" style={{ flex: 1, height: 10, borderRadius: 3 }} />
              <div className="skeleton" style={{ width: 80, height: 6, borderRadius: 3 }} />
              <div className="skeleton" style={{ width: 44, height: 10, borderRadius: 3 }} />
            </div>
          ))
        ) : ranked.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
            No data available
          </div>
        ) : (
          ranked.map((e, idx) => {
            const val = e[period] as number;
            const isPos = val >= 0;
            const pct = Math.abs(val) / maxAbs;
            const color = isPos ? '#22c55e' : '#ef4444';
            const catColor = CATEGORY_COLORS[e.category] ?? '#64748b';

            return (
              <div
                key={e.ticker}
                className="table-row perf-row-grid"
                onClick={() => router.push(`/etf/${e.ticker}`)}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '22px 48px 1fr auto 90px 54px',
                  alignItems: 'center',
                  gap: 10,
                  padding: '8px 14px',
                  borderBottom: '1px solid var(--border)',
                  cursor: 'pointer',
                }}
              >
                {/* Rank */}
                <span style={{ fontSize: 10, color: 'var(--text-muted)', textAlign: 'right', fontFamily: 'monospace' }}>
                  {idx + 1}
                </span>

                {/* Ticker badge */}
                <div style={{
                  background: catColor + '1a',
                  border: `1px solid ${catColor}40`,
                  borderRadius: 5,
                  padding: '3px 6px',
                  fontSize: 11,
                  fontWeight: 700,
                  fontFamily: 'monospace',
                  color: catColor,
                  textAlign: 'center',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  {e.ticker}
                </div>

                {/* Name */}
                <span style={{
                  fontSize: 12,
                  color: 'var(--text-secondary)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  {e.name}
                </span>

                {/* Category badge */}
                <span style={{
                  fontSize: 9,
                  padding: '1px 6px',
                  borderRadius: 3,
                  background: catColor + '18',
                  color: catColor,
                  fontWeight: 600,
                  letterSpacing: '0.3px',
                  whiteSpace: 'nowrap',
                }}>
                  {CAT_SHORT[e.category] ?? e.category}
                </span>

                {/* Bar — hidden on mobile via .perf-bar-col */}
                <div className="perf-bar-col" style={{ position: 'relative', height: 5, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{
                    position: 'absolute',
                    top: 0,
                    left: isPos ? '50%' : `${(0.5 - pct / 2) * 100}%`,
                    width: `${pct * 50}%`,
                    height: '100%',
                    background: color,
                    borderRadius: 3,
                  }} />
                  {/* Center line */}
                  <div style={{ position: 'absolute', top: 0, left: '50%', width: 1, height: '100%', background: 'var(--border-bright)' }} />
                </div>

                {/* Return value */}
                <span style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color,
                  fontFamily: 'monospace',
                  textAlign: 'right',
                  whiteSpace: 'nowrap',
                }}>
                  {fmtReturn(val)}
                </span>
              </div>
            );
          })
        )}
      </div>

      {/* Footer note */}
      {!loading && ranked.length > 0 && (
        <div style={{ padding: '6px 14px', fontSize: 10, color: 'var(--text-muted)', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
          Annualized for 2Y & 3Y · Computed from price history · Click any row for details
        </div>
      )}
    </div>
  );
}
