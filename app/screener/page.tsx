'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { SlidersHorizontal, ArrowUpDown, RotateCcw, ChevronLeft } from 'lucide-react';
import Header from '@/components/Header';
import IssuerAvatar from '@/components/IssuerAvatar';
import { fmtAum, fmtBps } from '@/lib/format';

const CATEGORIES = ['All', 'US Equity', 'Fixed Income', 'Sector', 'Commodities', 'International', 'Digital Assets', 'Thematic', 'Leveraged'];
const SORT_OPTIONS = [
  { value: 'aum', label: 'AUM' },
  { value: 'expense_ratio', label: 'Expense' },
  { value: 'ytd_return', label: 'YTD' },
  { value: 'one_year_return', label: '1Y' },
  { value: 'three_year_return', label: '3Y' },
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
  const hasFilters = filters.category !== 'All' || filters.issuer || filters.aumMin ||
    filters.aumMax || filters.expenseMax || filters.ytdMin || filters.oneYearMin;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <Header />

      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '24px 24px 48px' }}>
        {/* Page header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20, flexWrap: 'wrap' }}>
          <button
            onClick={() => router.push('/')}
            className="btn-link"
            style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}
          >
            <ChevronLeft size={14} /> Dashboard
          </button>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
            <span style={{ fontSize: 'var(--fs-lg)', fontWeight: 600, color: 'var(--text)', letterSpacing: '-0.3px' }}>
              Screener
            </span>
            <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-subtle)' }}>
              {loading ? '…' : total.toLocaleString()} funds
            </span>
          </div>
          {hasFilters && (
            <button onClick={resetFilters} className="btn btn-ghost" style={{ marginLeft: 'auto', height: 30 }}>
              <RotateCcw size={12} /> Reset filters
            </button>
          )}
          <button
            onClick={() => setFiltersOpen(o => !o)}
            className="btn btn-ghost screener-toggle-btn"
            style={{ display: 'none', height: 30 }}
          >
            <SlidersHorizontal size={12} /> {filtersOpen ? 'Hide' : 'Show'} filters
          </button>
        </div>

        <div className="screener-layout" style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
          {/* Filter sidebar */}
          {filtersOpen && (
            <div
              className="screener-filters panel"
              style={{ width: 260, flexShrink: 0, padding: 20, position: 'sticky', top: 76 }}
            >
              <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-subtle)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 14 }}>
                Filters
              </div>

              {/* Category */}
              <div style={{ marginBottom: 18 }}>
                <label style={labelStyle}>Category</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {CATEGORIES.map(c => (
                    <button
                      key={c}
                      onClick={() => setFilter('category', c)}
                      style={{
                        textAlign: 'left', fontSize: 'var(--fs-sm)', padding: '6px 10px',
                        borderRadius: 'var(--radius-sm)', border: 'none', cursor: 'pointer',
                        transition: 'all 120ms ease',
                        background: filters.category === c ? 'var(--accent-soft)' : 'transparent',
                        color: filters.category === c ? 'var(--accent)' : 'var(--text-muted)',
                        fontWeight: filters.category === c ? 600 : 400,
                        fontFamily: 'inherit',
                      }}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ borderTop: '1px solid var(--border)', margin: '16px 0' }} />

              <FilterInput label="Issuer" placeholder="BlackRock, Vanguard…" value={filters.issuer} onChange={v => setFilter('issuer', v)} />

              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}>AUM ($M)</label>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <input type="number" placeholder="Min" value={filters.aumMin} onChange={e => setFilter('aumMin', e.target.value)} className="input" />
                  <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-subtle)' }}>–</span>
                  <input type="number" placeholder="Max" value={filters.aumMax} onChange={e => setFilter('aumMax', e.target.value)} className="input" />
                </div>
              </div>

              <FilterInput label="Max expense ratio (%)" placeholder="0.5" value={filters.expenseMax} onChange={v => setFilter('expenseMax', v)} type="number" />

              {perfAvailable && (
                <>
                  <div style={{ borderTop: '1px solid var(--border)', margin: '16px 0' }} />
                  <div style={{ ...labelStyle, marginBottom: 12 }}>Min performance (%)</div>
                  <FilterInput label="YTD Return" placeholder="5" value={filters.ytdMin} onChange={v => setFilter('ytdMin', v)} type="number" />
                  <FilterInput label="1Y Return" placeholder="10" value={filters.oneYearMin} onChange={v => setFilter('oneYearMin', v)} type="number" />
                </>
              )}
            </div>
          )}

          {/* Results */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="panel" style={{ overflow: 'hidden' }}>
              {/* Sort bar */}
              <div style={{
                padding: '12px 20px', borderBottom: '1px solid var(--border)',
                display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
              }}>
                <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-subtle)', fontWeight: 500 }}>Sort by</span>
                <div className="seg">
                  {SORT_OPTIONS.filter(o => ['ytd_return','one_year_return','three_year_return'].indexOf(o.value) === -1 || perfAvailable).map(o => (
                    <button
                      key={o.value}
                      className="seg-btn"
                      data-active={sort === o.value}
                      onClick={() => handleSort(o.value)}
                    >
                      {o.label} {sort === o.value && <span style={{ marginLeft: 4 }}>{sortDir === 'asc' ? '↑' : '↓'}</span>}
                    </button>
                  ))}
                </div>
                <span style={{ marginLeft: 'auto', fontSize: 'var(--fs-xs)', color: 'var(--text-subtle)' }}>
                  {loading ? 'Loading…' : `${page * LIMIT + 1}–${Math.min((page + 1) * LIMIT, total)} of ${total.toLocaleString()}`}
                </span>
              </div>

              {/* Table */}
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 640 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      <TH label="Fund" col="ticker" sort={sort} sortDir={sortDir} onSort={handleSort} align="left" />
                      <TH label="AUM" col="aum" sort={sort} sortDir={sortDir} onSort={handleSort} />
                      <TH label="Exp" col="expense_ratio" sort={sort} sortDir={sortDir} onSort={handleSort} />
                      {perfAvailable && <TH label="YTD" col="ytd_return" sort={sort} sortDir={sortDir} onSort={handleSort} />}
                      {perfAvailable && <TH label="1Y" col="one_year_return" sort={sort} sortDir={sortDir} onSort={handleSort} />}
                      {perfAvailable && <TH label="3Y ann." col="three_year_return" sort={sort} sortDir={sortDir} onSort={handleSort} />}
                    </tr>
                  </thead>
                  <tbody>
                    {loading
                      ? Array.from({ length: 10 }).map((_, i) => (
                          <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                            {Array.from({ length: perfAvailable ? 6 : 3 }).map((_, j) => (
                              <td key={j} style={{ padding: '12px 20px' }}>
                                <div className="skeleton" style={{ height: 12, width: j === 0 ? 140 : 60 }} />
                              </td>
                            ))}
                          </tr>
                        ))
                      : data.length === 0
                      ? (
                        <tr><td colSpan={perfAvailable ? 6 : 3} style={{ padding: 40, textAlign: 'center', color: 'var(--text-subtle)', fontSize: 'var(--fs-sm)' }}>
                          No ETFs match your filters. Try adjusting or resetting.
                        </td></tr>
                      )
                      : data.map((row, idx) => (
                          <tr
                            key={row.ticker}
                            className="table-row fade-in"
                            style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
                            onClick={() => router.push(`/etf/${row.ticker}`)}
                          >
                            <td style={{ padding: '12px 20px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                <span className="mono" style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-subtle)', minWidth: 28, textAlign: 'right' }}>
                                  {page * LIMIT + idx + 1}
                                </span>
                                <IssuerAvatar name={row.issuer} size="sm" />
                                <div style={{ minWidth: 0 }}>
                                  <div className="mono" style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--text)' }}>
                                    {row.ticker}
                                  </div>
                                  <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {row.name}
                                  </div>
                                  <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-subtle)' }}>
                                    {row.issuer} · {row.category}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="tabular" style={{ padding: '12px 20px', textAlign: 'right', fontSize: 'var(--fs-sm)', fontWeight: 500, color: 'var(--text)' }}>
                              {fmtAum(row.aum ?? 0)}
                            </td>
                            <td className="tabular" style={{ padding: '12px 20px', textAlign: 'right', fontSize: 'var(--fs-sm)', color: 'var(--text-muted)' }}>
                              {fmtBps(row.expense_ratio ?? 0)}
                            </td>
                            {perfAvailable && <td style={{ padding: '12px 20px', textAlign: 'right' }}><PerfCell v={row.ytd_return} /></td>}
                            {perfAvailable && <td style={{ padding: '12px 20px', textAlign: 'right' }}><PerfCell v={row.one_year_return} /></td>}
                            {perfAvailable && <td style={{ padding: '12px 20px', textAlign: 'right' }}><PerfCell v={row.three_year_return} /></td>}
                          </tr>
                        ))
                    }
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-subtle)' }}>
                    Page {page + 1} of {totalPages}
                  </span>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <PagBtn label="← Prev" disabled={page === 0} onClick={() => setPage(p => p - 1)} />
                    {page > 1 && <PagBtn label="1" disabled={false} onClick={() => setPage(0)} />}
                    {page > 2 && <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-subtle)', padding: '4px 6px' }}>…</span>}
                    {[page - 1, page, page + 1].filter(n => n >= 0 && n < totalPages).map(n => (
                      <PagBtn key={n} label={String(n + 1)} disabled={false} onClick={() => setPage(n)} active={n === page} />
                    ))}
                    {page < totalPages - 3 && <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-subtle)', padding: '4px 6px' }}>…</span>}
                    {page < totalPages - 2 && <PagBtn label={String(totalPages)} disabled={false} onClick={() => setPage(totalPages - 1)} />}
                    <PagBtn label="Next →" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)} />
                  </div>
                </div>
              )}
            </div>

            {!perfAvailable && (
              <div style={{
                marginTop: 12, padding: '12px 16px',
                background: 'var(--surface-soft)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                fontSize: 'var(--fs-sm)', color: 'var(--text-muted)',
              }}>
                Performance data not yet populated. Run the SQL migration in Supabase, then trigger the refresh-performance workflow to enable YTD/1Y/3Y filters and columns.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  fontSize: 'var(--fs-xs)',
  color: 'var(--text-subtle)',
  display: 'block',
  marginBottom: 6,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.6px',
};

function FilterInput({ label, placeholder, value, onChange, type = 'text' }: {
  label: string; placeholder: string; value: string; onChange: (v: string) => void; type?: string;
}) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={labelStyle}>{label}</label>
      <input
        type={type} placeholder={placeholder} value={value}
        onChange={e => onChange(e.target.value)}
        className="input"
      />
    </div>
  );
}

function PerfCell({ v }: { v?: number | null }) {
  if (v === null || v === undefined) return <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-subtle)' }}>—</span>;
  const pct = (v * 100).toFixed(1);
  const color = v >= 0 ? 'var(--positive)' : 'var(--negative)';
  return <span className="tabular" style={{ fontSize: 'var(--fs-sm)', fontWeight: 500, color }}>{v >= 0 ? '+' : ''}{pct}%</span>;
}

function TH({ label, col, sort, sortDir, onSort, align = 'right' }: {
  label: string; col: string; sort: string; sortDir: string; onSort: (c: string) => void; align?: string;
}) {
  const isActive = sort === col;
  return (
    <th
      onClick={() => onSort(col)}
      style={{
        padding: '10px 20px', textAlign: align as 'left' | 'right', fontSize: 'var(--fs-xs)',
        color: isActive ? 'var(--text)' : 'var(--text-subtle)',
        textTransform: 'uppercase', letterSpacing: '0.6px', fontWeight: 600,
        cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap',
        background: 'var(--surface)',
      }}
    >
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        {label}
        {isActive
          ? <span style={{ fontSize: 10 }}>{sortDir === 'asc' ? '↑' : '↓'}</span>
          : <ArrowUpDown size={10} style={{ opacity: 0.35 }} />
        }
      </span>
    </th>
  );
}

function PagBtn({ label, disabled, onClick, active }: { label: string; disabled: boolean; onClick: () => void; active?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      padding: '5px 10px', fontSize: 'var(--fs-xs)', borderRadius: 'var(--radius-sm)',
      border: '1px solid var(--border)',
      background: active ? 'var(--accent-soft)' : 'var(--surface)',
      color: disabled ? 'var(--text-subtle)' : active ? 'var(--accent)' : 'var(--text)',
      cursor: disabled ? 'default' : 'pointer',
      fontFamily: 'inherit',
      fontWeight: active ? 600 : 500,
    }}>{label}</button>
  );
}
