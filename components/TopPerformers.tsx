'use client';

import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
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
  { key: 'ytd',       label: 'YTD'  },
  { key: 'oneYear',   label: '1Y'   },
  { key: 'twoYear',   label: '2Y'   },
  { key: 'threeYear', label: '3Y'   },
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
  const PAGE_SIZE = 10;

  const [data, setData]         = useState<Entry[]>([]);
  const [loading, setLoading]   = useState(true);
  const [source, setSource]     = useState('');
  const [period, setPeriod]     = useState<Period>('ytd');
  const [category, setCategory] = useState('All');
  const [page, setPage]         = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  const changePeriod = useCallback((p: Period) => { setPeriod(p); setPage(0); }, []);
  const changeCategory = useCallback((c: string) => { setCategory(c); setPage(0); }, []);

  // Refetch whenever period or category changes — server does the filtering/sorting
  useEffect(() => {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    setLoading(true);
    fetch(`/api/performers?period=${period}&category=${encodeURIComponent(category)}&limit=100`, {
      signal: ac.signal,
    })
      .then((r) => r.json())
      .then((json) => {
        if (ac.signal.aborted) return;
        setData(json.data ?? []);
        setSource(json.source ?? '');
        setLoading(false);
      })
      .catch(() => { if (!ac.signal.aborted) setLoading(false); });

    return () => ac.abort();
  }, [period, category]);

  const totalPages = Math.max(1, Math.ceil(data.length / PAGE_SIZE));
  const pageData   = data.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  // Bar scale based on the full dataset so bars stay consistent across pages
  const maxAbs = useMemo(() => {
    if (!data.length) return 1;
    return Math.max(...data.map((e) => Math.abs((e[period] as number) ?? 0)), 0.01);
  }, [data, period]);

  return (
    <div className="panel" style={{ display: 'flex', flexDirection: 'column' }}>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="panel-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Award size={14} color="var(--yellow)" />
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
            Top Performing ETFs
          </span>
          {!loading && data.length > 0 && (
            <span style={{ fontSize: 11, color: 'var(--text-muted)', background: 'var(--border)', padding: '1px 6px', borderRadius: 10 }}>
              {data.length}
            </span>
          )}
        </div>

        {/* Period tabs */}
        <div style={{ display: 'flex', gap: 3 }}>
          {PERIODS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => changePeriod(key)}
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
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => changeCategory(cat)}
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
        ) : data.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
            No performance data available yet
          </div>
        ) : (
          pageData.map((e, idx) => {
            const val     = e[period] as number;
            const absIdx  = page * PAGE_SIZE + idx;
            const isPos   = val >= 0;
            const pct     = Math.abs(val) / maxAbs;
            const color   = isPos ? '#22c55e' : '#ef4444';
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
                  {absIdx + 1}
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

      {/* Pagination footer */}
      {!loading && data.length > 0 && (
        <div style={{
          padding: '7px 14px',
          borderTop: '1px solid var(--border)',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
        }}>
          <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
            {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, data.length)} of {data.length}
            {source === 'supabase' ? ' ETFs' : ''}
            {' · '}Annualized for 2Y &amp; 3Y
          </span>
          <div style={{ display: 'flex', gap: 4 }}>
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              style={{
                fontSize: 11, padding: '2px 10px', borderRadius: 4,
                border: '1px solid var(--border)', background: 'transparent',
                color: page === 0 ? 'var(--text-muted)' : 'var(--text-secondary)',
                cursor: page === 0 ? 'default' : 'pointer', opacity: page === 0 ? 0.4 : 1,
              }}
            >← Prev</button>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', padding: '2px 6px', alignSelf: 'center' }}>
              {page + 1} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page === totalPages - 1}
              style={{
                fontSize: 11, padding: '2px 10px', borderRadius: 4,
                border: '1px solid var(--border)', background: 'transparent',
                color: page === totalPages - 1 ? 'var(--text-muted)' : 'var(--text-secondary)',
                cursor: page === totalPages - 1 ? 'default' : 'pointer',
                opacity: page === totalPages - 1 ? 0.4 : 1,
              }}
            >Next →</button>
          </div>
        </div>
      )}
    </div>
  );
}
