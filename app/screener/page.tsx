'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { SlidersHorizontal, ArrowUpDown, RotateCcw, ChevronLeft } from 'lucide-react';
import Header from '@/components/Header';
import { fmtAum, fmtPct, fmtBps, chgClass } from '@/lib/format';

const CATEGORIES = ['All', 'US Equity', 'Fixed Income', 'Sector', 'Commodities', 'International', 'Digital Assets', 'Thematic', 'Leveraged'];
const SORT_OPTIONS = [
  { value: 'aum', label: 'AUM' },
  { value: 'expense_ratio', label: 'Expense Ratio' },
  { value: 'ytd_return', label: 'YTD Return' },
  { value: 'one_year_return', label: '1Y Return' },
  { value: 'three_year_return', label: '3Y Return' },
  { value: 'ticker', label: 'Ticker' },
];

interface Row {
  ticker: string;
  name: string;
  issuer: string;
  category: string;
  aum: number;
  expense_ratio: number;
  ytd_return?: number;
  one_year_return?: number;
  three_year_return?: number;
}

const DEFAULT_FILTERS = {
  category: 'All',
  issuer: '',
  aumMin: '',
  aumMax: '',
  expenseMax: '',
  ytdMin: '',
  oneYearMin: '',
};

export default function ScreenerPage() {
  const router = useRouter();
  const [filters, setFilters] = useState({ ...DEFAULT_FILTERS });
  const [sort, setSort] = useState('aum');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(0);
  const [data, setData] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [perfAvailable, setPerfAvailable] = useState(true);
  const [filtersOpen, setFiltersOpen] = useState(true);
  const abortRef = useRef<AbortController | null>(null);
  const LIMIT = 25;

  const fetchData = useCallback((f: typeof filters, s: string, sd: 'asc' | 'desc', p: number) => {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setLoading(true);

    const params = new URLSearchParams({
      sort: s, sort_dir: sd, page: String(p), limit: String(LIMIT),
    });
    if (f.category && f.category !== 'All') params.set('category', f.category);
    if (f.issuer) params.set('issuer', f.issuer);
    if (f.aumMin) params.set('aum_min', f.aumMin);
    if (f.aumMax) params.set('aum_max', f.aumMax);
    if (f.expenseMax) params.set('expense_max', f.expenseMax);
    if (f.ytdMin) params.set('ytd_min', f.ytdMin);
    if (f.oneYearMin) params.set('one_year_min', f.oneYearMin);

    fetch(`/api/screener?${params}`, { signal: ac.signal })
      .then(r => r.json())
      .then(json => {
        if (ac.signal.aborted) return;
        setData(json.data ?? []);
        setTotal(json.total ?? 0);
        setPerfAvailable(json.perfAvailable !== false);
        setLoading(false);
      })
      .catch(() => { if (!ac.signal.aborted) setLoading(false); });
  }, []);

  useEffect(() => {
    fetchData(filters, sort, sortDir, page);
  }, [filters, sort, sortDir, page, fetchData]);

  function setFilter<K extends keyof typeof filters>(key: K, val: string) {
    setFilters(f => ({ ...f, [key]: val }));
    setPage(0);
  }

  function handleSort(col: string) {
    if (sort === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSort(col); setSortDir('desc'); }
    setPage(0);
  }

  function resetFilters() {
    setFilters({ ...DEFAULT_FILTERS });
    setSort('aum');
    setSortDir('desc');
    setPage(0);
  }

  const totalPages = Math.ceil(total / LIMIT);

  function SortArrow({ col }: { col: string }) {
    if (sort !== col) return <ArrowUpDown size={10} style={{ opacity: 0.3 }} />;
    return <span style={{ fontSize: '10px' }}>{sortDir === 'asc' ? '↑' : '↓'}</span>;
  }

  const hasFilters = filters.category !== 'All' || filters.issuer || filters.aumMin ||
    filters.aumMax || filters.expenseMax || filters.ytdMin || filters.oneYearMin;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)' }}>
      <Header />

      <div style={{ maxWidth: '1600px', margin: '0 auto', padding: '16px 20px' }}>
        {/* Page header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
          <button
            onClick={() => router.push('/')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', padding: 0 }}
          >
            <ChevronLeft size={14} /> Dashboard
          </button>
          <span style={{ color: 'var(--border)', fontSize: '14px' }}>·</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <SlidersHorizontal size={16} color="#3b82f6" />
            <span style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.3px' }}>
              ETF Screener
            </span>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)', background: 'var(--border)', padding: '2px 8px', borderRadius: '10px' }}>
              {loading ? '…' : total.toLocaleString()} ETFs
            </span>
          </div>
          {hasFilters && (
            <button
              onClick={resetFilters}
              style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: 'var(--text-secondary)', background: 'none', border: '1px solid var(--border)', borderRadius: '5px', padding: '4px 10px', cursor: 'pointer' }}
            >
              <RotateCcw size={11} /> Reset filters
            </button>
          )}
          <button
            onClick={() => setFiltersOpen(o => !o)}
            className="screener-toggle-btn"
            style={{ display: 'none', alignItems: 'center', gap: '5px', fontSize: '12px', color: 'var(--text-secondary)', background: 'none', border: '1px solid var(--border)', borderRadius: '5px', padding: '4px 10px', cursor: 'pointer' }}
          >
            <SlidersHorizontal size={11} /> {filtersOpen ? 'Hide' : 'Show'} filters
          </button>
        </div>

        <div className="screener-layout" style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
          {/* Filter sidebar */}
          {filtersOpen && (
            <div className="screener-filters" style={{
              width: '240px', flexShrink: 0, background: 'var(--bg-panel)',
              border: '1px solid var(--border)', borderRadius: '8px', padding: '16px',
              position: 'sticky', top: '64px',
            }}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '14px', letterSpacing: '0.3px' }}>
                FILTERS
              </div>

              {/* Category */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '6px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Category
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  {CATEGORIES.map(c => (
                    <button key={c} onClick={() => setFilter('category', c)} style={{
                      textAlign: 'left', fontSize: '12px', padding: '5px 8px', borderRadius: '4px', border: 'none',
                      cursor: 'pointer', transition: 'all 0.1s',
                      background: filters.category === c ? 'rgba(59,130,246,0.15)' : 'transparent',
                      color: filters.category === c ? '#3b82f6' : 'var(--text-secondary)',
                      fontWeight: filters.category === c ? 600 : 400,
                    }}>{c}</button>
                  ))}
                </div>
              </div>

              <div style={{ borderTop: '1px solid var(--border)', margin: '14px 0' }} />

              {/* Issuer */}
              <FilterInput label="Issuer" placeholder="e.g. BlackRock, Vanguard" value={filters.issuer} onChange={v => setFilter('issuer', v)} />

              {/* AUM */}
              <div style={{ marginBottom: '14px' }}>
                <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '6px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  AUM ($M)
                </label>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <input
                    type="number" placeholder="Min" value={filters.aumMin}
                    onChange={e => setFilter('aumMin', e.target.value)}
                    style={inputStyle}
                  />
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>–</span>
                  <input
                    type="number" placeholder="Max" value={filters.aumMax}
                    onChange={e => setFilter('aumMax', e.target.value)}
                    style={inputStyle}
                  />
                </div>
              </div>

              {/* Expense ratio */}
              <FilterInput label="Max Expense Ratio (%)" placeholder="e.g. 0.5" value={filters.expenseMax} onChange={v => setFilter('expenseMax', v)} type="number" />

              {perfAvailable && (
                <>
                  <div style={{ borderTop: '1px solid var(--border)', margin: '14px 0' }} />
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Performance (min %)
                  </div>
                  <FilterInput label="YTD Return" placeholder="e.g. 5" value={filters.ytdMin} onChange={v => setFilter('ytdMin', v)} type="number" />
                  <FilterInput label="1Y Return" placeholder="e.g. 10" value={filters.oneYearMin} onChange={v => setFilter('oneYearMin', v)} type="number" />
                </>
              )}
            </div>
          )}

          {/* Results */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ background: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden' }}>
              {/* Sort bar */}
              <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Sort by:</span>
                {SORT_OPTIONS.filter(o => o.value !== 'ytd_return' && o.value !== 'one_year_return' && o.value !== 'three_year_return' || perfAvailable).map(o => (
                  <button key={o.value} onClick={() => handleSort(o.value)} style={{
                    fontSize: '11px', padding: '3px 10px', borderRadius: '4px', border: 'none', cursor: 'pointer',
                    background: sort === o.value ? 'rgba(59,130,246,0.15)' : 'transparent',
                    color: sort === o.value ? '#3b82f6' : 'var(--text-secondary)',
                    fontWeight: sort === o.value ? 600 : 400,
                    display: 'flex', alignItems: 'center', gap: '4px',
                  }}>
                    {o.label} {sort === o.value && <span>{sortDir === 'asc' ? '↑' : '↓'}</span>}
                  </button>
                ))}
                <span style={{ marginLeft: 'auto', fontSize: '11px', color: 'var(--text-muted)' }}>
                  {loading ? 'Loading…' : `${page * LIMIT + 1}–${Math.min((page + 1) * LIMIT, total)} of ${total.toLocaleString()}`}
                </span>
              </div>

              {/* Table */}
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '600px' }}>
                  <thead style={{ background: 'var(--bg-panel)' }}>
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      <TH label="Fund" col="ticker" sort={sort} sortDir={sortDir} onSort={handleSort} align="left" />
                      <TH label="AUM" col="aum" sort={sort} sortDir={sortDir} onSort={handleSort} />
                      <TH label="Exp Ratio" col="expense_ratio" sort={sort} sortDir={sortDir} onSort={handleSort} />
                      {perfAvailable && <TH label="YTD" col="ytd_return" sort={sort} sortDir={sortDir} onSort={handleSort} />}
                      {perfAvailable && <TH label="1Y" col="one_year_return" sort={sort} sortDir={sortDir} onSort={handleSort} />}
                      {perfAvailable && <TH label="3Y Ann." col="three_year_return" sort={sort} sortDir={sortDir} onSort={handleSort} />}
                    </tr>
                  </thead>
                  <tbody>
                    {loading
                      ? Array.from({ length: 10 }).map((_, i) => (
                          <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                            {Array.from({ length: perfAvailable ? 6 : 3 }).map((_, j) => (
                              <td key={j} style={{ padding: '10px 14px' }}>
                                <div className="skeleton" style={{ height: '12px', width: j === 0 ? '120px' : '60px' }} />
                              </td>
                            ))}
                          </tr>
                        ))
                      : data.length === 0
                      ? (
                        <tr><td colSpan={perfAvailable ? 6 : 3} style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                          No ETFs match your filters. Try adjusting or resetting the filters.
                        </td></tr>
                      )
                      : data.map((row, idx) => (
                          <tr
                            key={row.ticker}
                            className="table-row fade-in"
                            style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
                            onClick={() => router.push(`/etf/${row.ticker}`)}
                          >
                            <td style={{ padding: '9px 14px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'monospace', minWidth: '24px', textAlign: 'right' }}>
                                  {page * LIMIT + idx + 1}
                                </span>
                                <div>
                                  <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'monospace' }}>
                                    {row.ticker}
                                  </div>
                                  <div style={{ fontSize: '10px', color: 'var(--text-secondary)', maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {row.name}
                                  </div>
                                  <div style={{ fontSize: '9px', color: 'var(--text-muted)' }}>
                                    {row.issuer} · <span style={{ color: '#64748b' }}>{row.category}</span>
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td style={{ padding: '9px 14px', textAlign: 'right', fontSize: '12px', fontWeight: 600, fontFamily: 'monospace', color: 'var(--text-primary)' }}>
                              {fmtAum(row.aum ?? 0)}
                            </td>
                            <td style={{ padding: '9px 14px', textAlign: 'right', fontSize: '11px', color: 'var(--text-secondary)' }}>
                              {fmtBps(row.expense_ratio ?? 0)}
                            </td>
                            {perfAvailable && (
                              <td style={{ padding: '9px 14px', textAlign: 'right' }}>
                                <PerfCell v={row.ytd_return} />
                              </td>
                            )}
                            {perfAvailable && (
                              <td style={{ padding: '9px 14px', textAlign: 'right' }}>
                                <PerfCell v={row.one_year_return} />
                              </td>
                            )}
                            {perfAvailable && (
                              <td style={{ padding: '9px 14px', textAlign: 'right' }}>
                                <PerfCell v={row.three_year_return} />
                              </td>
                            )}
                          </tr>
                        ))
                    }
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div style={{ padding: '10px 14px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    Page {page + 1} of {totalPages}
                  </span>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <PagBtn label="← Prev" disabled={page === 0} onClick={() => setPage(p => p - 1)} />
                    {page > 1 && <PagBtn label="1" disabled={false} onClick={() => setPage(0)} />}
                    {page > 2 && <span style={{ fontSize: '11px', color: 'var(--text-muted)', padding: '3px 6px' }}>…</span>}
                    {[page - 1, page, page + 1].filter(n => n >= 0 && n < totalPages).map(n => (
                      <PagBtn key={n} label={String(n + 1)} disabled={false} onClick={() => setPage(n)} active={n === page} />
                    ))}
                    {page < totalPages - 3 && <span style={{ fontSize: '11px', color: 'var(--text-muted)', padding: '3px 6px' }}>…</span>}
                    {page < totalPages - 2 && <PagBtn label={String(totalPages)} disabled={false} onClick={() => setPage(totalPages - 1)} />}
                    <PagBtn label="Next →" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)} />
                  </div>
                </div>
              )}
            </div>

            {!perfAvailable && (
              <div style={{ marginTop: '10px', padding: '10px 14px', background: 'rgba(234,179,8,0.08)', border: '1px solid rgba(234,179,8,0.2)', borderRadius: '6px', fontSize: '12px', color: '#eab308' }}>
                Performance data not yet populated. Run the SQL migration in Supabase, then trigger the refresh-performance workflow to enable YTD/1Y/3Y filters and columns.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function FilterInput({ label, placeholder, value, onChange, type = 'text' }: {
  label: string; placeholder: string; value: string; onChange: (v: string) => void; type?: string;
}) {
  return (
    <div style={{ marginBottom: '14px' }}>
      <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '5px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
        {label}
      </label>
      <input
        type={type} placeholder={placeholder} value={value}
        onChange={e => onChange(e.target.value)}
        style={inputStyle}
      />
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%', background: 'var(--bg-primary)', border: '1px solid var(--border)',
  borderRadius: '5px', color: 'var(--text-primary)', fontSize: '12px',
  padding: '5px 9px', outline: 'none',
};

function PerfCell({ v }: { v?: number | null }) {
  if (v === null || v === undefined) return <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>—</span>;
  const pct = (v * 100).toFixed(1);
  const color = v >= 0 ? 'var(--green)' : 'var(--red)';
  return <span style={{ fontSize: '12px', fontWeight: 600, fontFamily: 'monospace', color }}>{v >= 0 ? '+' : ''}{pct}%</span>;
}

function TH({ label, col, sort, sortDir, onSort, align = 'right' }: {
  label: string; col: string; sort: string; sortDir: string; onSort: (c: string) => void; align?: string;
}) {
  return (
    <th
      onClick={() => onSort(col)}
      style={{
        padding: '8px 14px', textAlign: align as 'left' | 'right', fontSize: '10px',
        color: sort === col ? '#3b82f6' : 'var(--text-muted)',
        textTransform: 'uppercase', letterSpacing: '0.6px',
        cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap',
      }}
    >
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
        {label}
        {sort === col
          ? <span style={{ fontSize: '10px' }}>{sortDir === 'asc' ? '↑' : '↓'}</span>
          : <ArrowUpDown size={9} style={{ opacity: 0.3 }} />
        }
      </span>
    </th>
  );
}

function PagBtn({ label, disabled, onClick, active }: { label: string; disabled: boolean; onClick: () => void; active?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      padding: '3px 8px', fontSize: '11px', borderRadius: '4px',
      border: '1px solid var(--border)',
      background: active ? 'rgba(59,130,246,0.15)' : 'transparent',
      color: disabled ? 'var(--text-muted)' : active ? '#3b82f6' : 'var(--text-primary)',
      cursor: disabled ? 'default' : 'pointer',
    }}>{label}</button>
  );
}
