'use client';

import { useEffect, useState, useMemo } from 'react';
import { ArrowUpDown, TrendingUp } from 'lucide-react';
import { fmtAum, fmtPrice, fmtPct, fmtBps, chgClass, chgArrow } from '@/lib/format';
import { CATEGORY_COLORS } from '@/lib/etf-data';
import type { ETF } from '@/types';

type SortKey = 'aum' | 'changePct' | 'expenseRatio' | 'ticker';
type SortDir = 'asc' | 'desc';

const CATEGORIES = ['All', 'US Equity', 'Fixed Income', 'Sector', 'Commodities', 'International', 'Digital Assets', 'Thematic', 'Leveraged'];

export default function ETFTable() {
  const [etfs, setEtfs] = useState<ETF[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>('aum');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [category, setCategory] = useState('All');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 15;

  useEffect(() => {
    fetch('/api/etfs')
      .then((r) => r.json())
      .then((json) => { setEtfs(json.data ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
    setPage(0);
  }

  const filtered = useMemo(() => {
    let out = etfs;
    if (category !== 'All') out = out.filter(e => e.category === category);
    if (search) {
      const q = search.toLowerCase();
      out = out.filter(e =>
        e.ticker.toLowerCase().includes(q) ||
        e.name.toLowerCase().includes(q) ||
        e.issuer.toLowerCase().includes(q)
      );
    }
    out = [...out].sort((a, b) => {
      let va: number | string = 0, vb: number | string = 0;
      if (sortKey === 'aum')         { va = a.aum; vb = b.aum; }
      if (sortKey === 'changePct')   { va = a.changePct ?? -999; vb = b.changePct ?? -999; }
      if (sortKey === 'expenseRatio'){ va = a.expenseRatio; vb = b.expenseRatio; }
      if (sortKey === 'ticker')      { va = a.ticker; vb = b.ticker; }
      if (typeof va === 'string')    return sortDir === 'asc' ? va.localeCompare(String(vb)) : String(vb).localeCompare(va);
      return sortDir === 'asc' ? (va as number) - (vb as number) : (vb as number) - (va as number);
    });
    return out;
  }, [etfs, category, search, sortKey, sortDir]);

  const pageData = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);

  function SortIcon({ k }: { k: SortKey }) {
    if (sortKey !== k) return <ArrowUpDown size={10} style={{ opacity: 0.3 }} />;
    return <span style={{ fontSize: '10px', opacity: 0.8 }}>{sortDir === 'asc' ? '↑' : '↓'}</span>;
  }

  function ColHeader({ label, k, style }: { label: string; k: SortKey; style?: React.CSSProperties }) {
    return (
      <th
        onClick={() => handleSort(k)}
        style={{
          padding: '8px 12px',
          textAlign: 'right',
          fontSize: '10px',
          color: 'var(--text-muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.6px',
          cursor: 'pointer',
          userSelect: 'none',
          whiteSpace: 'nowrap',
          ...style,
        }}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
          {label} <SortIcon k={k} />
        </span>
      </th>
    );
  }

  return (
    <div className="panel" id="top-funds" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div className="panel-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <TrendingUp size={14} color="var(--blue)" />
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>Top ETFs by AUM</span>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', background: 'var(--border)', padding: '1px 6px', borderRadius: '10px' }}>
            {filtered.length}
          </span>
        </div>
        <input
          placeholder="Search ticker, name, issuer…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(0); }}
          style={{
            background: 'var(--bg-primary)',
            border: '1px solid var(--border)',
            borderRadius: '5px',
            color: 'var(--text-primary)',
            fontSize: '12px',
            padding: '4px 10px',
            width: '180px',
            outline: 'none',
          }}
        />
      </div>

      {/* Category filter tabs */}
      <div style={{
        display: 'flex',
        gap: '4px',
        padding: '8px 12px',
        borderBottom: '1px solid var(--border)',
        overflowX: 'auto',
        flexShrink: 0,
      }}>
        {CATEGORIES.map((c) => (
          <button
            key={c}
            onClick={() => { setCategory(c); setPage(0); }}
            style={{
              fontSize: '11px',
              padding: '3px 10px',
              borderRadius: '4px',
              border: 'none',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              fontWeight: category === c ? 600 : 400,
              background: category === c ? 'rgba(59,130,246,0.15)' : 'transparent',
              color: category === c ? '#3b82f6' : 'var(--text-secondary)',
              transition: 'all 0.15s',
            }}
          >
            {c}
          </button>
        ))}
      </div>

      {/* Table */}
      <div style={{ overflowY: 'auto', flex: 1 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-panel)', zIndex: 1 }}>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }} onClick={() => handleSort('ticker')}>
                  Fund <SortIcon k="ticker" />
                </span>
              </th>
              <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>Issuer</th>
              <ColHeader label="AUM"      k="aum" />
              <ColHeader label="Price"    k="aum" style={{ color: 'var(--text-muted)' }} />
              <ColHeader label="1D Chg"   k="changePct" />
              <ColHeader label="Exp Ratio" k="expenseRatio" />
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: 10 }).map((_, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                    {Array.from({ length: 6 }).map((_, j) => (
                      <td key={j} style={{ padding: '10px 12px' }}>
                        <div className="skeleton" style={{ height: '12px', width: j === 0 ? '80px' : '60px' }} />
                      </td>
                    ))}
                  </tr>
                ))
              : pageData.map((etf, idx) => (
                  <tr
                    key={etf.ticker}
                    className="table-row fade-in"
                    style={{
                      borderBottom: '1px solid var(--border)',
                      cursor: 'pointer',
                    }}
                    onClick={() => window.open(`https://finance.yahoo.com/quote/${etf.ticker}`, '_blank')}
                  >
                    {/* Ticker + name */}
                    <td style={{ padding: '9px 12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'monospace', width: '16px', textAlign: 'right' }}>
                          {page * PAGE_SIZE + idx + 1}
                        </span>
                        <div>
                          <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'monospace' }}>
                            {etf.ticker}
                          </div>
                          <div style={{ fontSize: '10px', color: 'var(--text-secondary)', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {etf.name}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Issuer + category */}
                    <td style={{ padding: '9px 12px' }}>
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{etf.issuer}</div>
                      <span style={{
                        fontSize: '9px',
                        padding: '1px 5px',
                        borderRadius: '3px',
                        background: (CATEGORY_COLORS[etf.category] ?? '#64748b') + '22',
                        color: CATEGORY_COLORS[etf.category] ?? '#64748b',
                        fontWeight: 600,
                      }}>
                        {etf.subCategory ?? etf.category}
                      </span>
                    </td>

                    {/* AUM */}
                    <td style={{ padding: '9px 12px', textAlign: 'right', fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'monospace' }}>
                      {fmtAum(etf.aum)}
                    </td>

                    {/* Price */}
                    <td style={{ padding: '9px 12px', textAlign: 'right', fontSize: '12px', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                      {fmtPrice(etf.price)}
                    </td>

                    {/* 1D Change */}
                    <td style={{ padding: '9px 12px', textAlign: 'right' }}>
                      <span className={chgClass(etf.changePct)} style={{ fontSize: '12px', fontWeight: 600 }}>
                        {chgArrow(etf.changePct)} {fmtPct(etf.changePct)}
                      </span>
                    </td>

                    {/* Expense ratio */}
                    <td style={{ padding: '9px 12px', textAlign: 'right', fontSize: '11px', color: 'var(--text-secondary)' }}>
                      {fmtBps(etf.expenseRatio)}
                    </td>
                  </tr>
                ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{
          padding: '8px 12px',
          borderTop: '1px solid var(--border)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexShrink: 0,
        }}>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)} of {filtered.length}
          </span>
          <div style={{ display: 'flex', gap: '4px' }}>
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              style={{
                padding: '3px 10px', fontSize: '11px', borderRadius: '4px', border: '1px solid var(--border)',
                background: 'transparent', color: page === 0 ? 'var(--text-muted)' : 'var(--text-primary)', cursor: page === 0 ? 'default' : 'pointer',
              }}
            >
              ← Prev
            </button>
            <button
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page === totalPages - 1}
              style={{
                padding: '3px 10px', fontSize: '11px', borderRadius: '4px', border: '1px solid var(--border)',
                background: 'transparent', color: page === totalPages - 1 ? 'var(--text-muted)' : 'var(--text-primary)', cursor: page === totalPages - 1 ? 'default' : 'pointer',
              }}
            >
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
