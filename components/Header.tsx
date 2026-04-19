'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Search, X } from 'lucide-react';
import { fmtAum } from '@/lib/format';

interface SearchResult {
  ticker: string;
  name: string;
  issuer: string;
  category: string;
  aum: number;
}

export default function Header() {
  const router = useRouter();
  const [time, setTime] = useState('');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [showDrop, setShowDrop] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const [searching, setSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const tick = () => {
      const et = new Date().toLocaleString('en-US', {
        timeZone: 'America/New_York',
        hour: '2-digit', minute: '2-digit', hour12: false,
      });
      setTime(`${et} ET`);
    };
    tick();
    const id = setInterval(tick, 30000);
    return () => clearInterval(id);
  }, []);

  const doSearch = useCallback((q: string) => {
    abortRef.current?.abort();
    if (!q.trim()) { setResults([]); setShowDrop(false); setSearching(false); return; }
    const ac = new AbortController();
    abortRef.current = ac;
    setSearching(true);
    fetch(`/api/search?q=${encodeURIComponent(q)}&limit=8`, { signal: ac.signal })
      .then(r => r.json())
      .then(json => {
        if (ac.signal.aborted) return;
        setResults(json.data ?? []);
        setShowDrop(true);
        setSearching(false);
        setActiveIdx(-1);
      })
      .catch(() => { if (!ac.signal.aborted) setSearching(false); });
  }, []);

  function handleInput(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value;
    setQuery(v);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(v), 220);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, results.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, -1)); }
    else if (e.key === 'Enter') {
      e.preventDefault();
      const target = activeIdx >= 0 ? results[activeIdx] : results[0];
      if (target) navigate(target.ticker);
    } else if (e.key === 'Escape') {
      setShowDrop(false); setQuery(''); inputRef.current?.blur();
    }
  }

  function navigate(ticker: string) {
    setShowDrop(false); setQuery(''); setResults([]);
    router.push(`/etf/${ticker}`);
  }

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (dropRef.current && !dropRef.current.contains(e.target as Node) &&
          inputRef.current && !inputRef.current.contains(e.target as Node))
        setShowDrop(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <header style={{
      background: 'var(--surface)',
      borderBottom: '1px solid var(--border)',
      padding: '0 24px',
      height: '60px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '16px',
      position: 'sticky',
      top: 0,
      zIndex: 100,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '24px', flexShrink: 0 }}>
        <a href="/" style={{
          display: 'flex', alignItems: 'baseline', gap: '8px',
          textDecoration: 'none', color: 'var(--text)',
        }}>
          <span style={{ fontSize: 'var(--fs-md)', fontWeight: 600, letterSpacing: '-0.3px' }}>
            ETF Monitor
          </span>
          <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-subtle)', fontWeight: 500 }}>
            US
          </span>
        </a>

        <nav className="header-nav" style={{ display: 'flex', gap: '4px' }}>
          {[{ label: 'Overview', href: '/' }, { label: 'Screener', href: '/screener' }].map(({ label, href }) => (
            <a key={label} href={href} style={{
              fontSize: 'var(--fs-sm)', color: 'var(--text-muted)', textDecoration: 'none',
              padding: '6px 12px', borderRadius: 'var(--radius-sm)', transition: 'all 120ms ease',
              whiteSpace: 'nowrap', fontWeight: 500,
            }}
              onMouseEnter={e => { (e.target as HTMLElement).style.color = 'var(--text)'; (e.target as HTMLElement).style.background = 'var(--surface-soft)'; }}
              onMouseLeave={e => { (e.target as HTMLElement).style.color = 'var(--text-muted)'; (e.target as HTMLElement).style.background = 'transparent'; }}
            >{label}</a>
          ))}
        </nav>
      </div>

      <div className="header-search-wrap" style={{ position: 'relative', flex: 1, maxWidth: '440px' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          background: 'var(--surface-soft)',
          border: '1px solid transparent',
          borderRadius: 'var(--radius-sm)', padding: '0 12px', height: '36px',
          transition: 'border-color 120ms ease, background 120ms ease',
        }}
        onFocus={e => { e.currentTarget.style.borderColor = 'var(--accent-border)'; e.currentTarget.style.background = 'var(--surface)'; }}
        onBlur={e => { e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.background = 'var(--surface-soft)'; }}
        >
          <Search size={14} color="var(--text-subtle)" style={{ flexShrink: 0 }} />
          <input
            ref={inputRef}
            value={query}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            onFocus={() => query && results.length > 0 && setShowDrop(true)}
            placeholder="Search ticker or fund name"
            style={{
              background: 'none', border: 'none', outline: 'none',
              color: 'var(--text)', fontSize: 'var(--fs-sm)',
              flex: 1, minWidth: 0, fontFamily: 'inherit',
            }}
          />
          {query && (
            <button onClick={() => { setQuery(''); setResults([]); setShowDrop(false); inputRef.current?.focus(); }}
              className="icon-btn" style={{ padding: 2 }}>
              <X size={12} />
            </button>
          )}
        </div>

        {showDrop && results.length > 0 && (
          <div ref={dropRef} style={{
            position: 'absolute', top: '42px', left: 0, right: 0,
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-pop)',
            overflow: 'hidden', zIndex: 200,
          }}>
            {results.map((r, i) => (
              <div key={r.ticker}
                onMouseDown={() => navigate(r.ticker)}
                onMouseEnter={() => setActiveIdx(i)}
                onMouseLeave={() => setActiveIdx(-1)}
                style={{
                  padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '12px',
                  cursor: 'pointer',
                  background: i === activeIdx ? 'var(--surface-hover)' : 'transparent',
                  borderBottom: i < results.length - 1 ? '1px solid var(--border)' : 'none',
                }}
              >
                <span className="mono" style={{
                  fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--text)', minWidth: '52px',
                }}>
                  {r.ticker}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {r.name}
                  </div>
                  <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-subtle)' }}>{r.issuer} · {r.category}</div>
                </div>
                <span className="mono" style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', flexShrink: 0 }}>
                  {fmtAum(r.aum ?? 0)}
                </span>
              </div>
            ))}
            <div style={{ padding: '6px 14px', borderTop: '1px solid var(--border)', fontSize: 'var(--fs-xs)', color: 'var(--text-subtle)', background: 'var(--surface-soft)' }}>
              ↑↓ navigate · Enter to open · Esc to close
            </div>
          </div>
        )}
        {searching && !showDrop && (
          <div style={{
            position: 'absolute', top: '42px', left: 0, right: 0,
            padding: '12px 14px', background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)', fontSize: 'var(--fs-sm)', color: 'var(--text-subtle)', zIndex: 200,
          }}>Searching…</div>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
        <span className="live-dot" style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--positive)', display: 'block' }} />
        <span className="mono" style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)' }}>{time || 'LIVE'}</span>
      </div>
    </header>
  );
}
