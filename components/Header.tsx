'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Activity, Search, X } from 'lucide-react';
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
        hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
      });
      setTime(`${et} ET`);
    };
    tick();
    const id = setInterval(tick, 1000);
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
      background: 'var(--bg-panel)',
      borderBottom: '1px solid var(--border)',
      padding: '0 20px',
      height: '52px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '12px',
      position: 'sticky',
      top: 0,
      zIndex: 100,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
        <a href="/" style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none' }}>
          <div style={{
            width: '28px', height: '28px',
            background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
            borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Activity size={16} color="#fff" />
          </div>
          <span style={{ fontSize: '15px', fontWeight: 700, letterSpacing: '-0.3px', color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
            ETF Monitor
          </span>
        </a>
        <span style={{ fontSize: '10px', fontWeight: 600, color: '#3b82f6', background: 'rgba(59,130,246,0.12)', padding: '2px 6px', borderRadius: '4px' }}>
          US
        </span>
      </div>

      <div className="header-search-wrap" style={{ position: 'relative', flex: 1, maxWidth: '480px' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          background: 'var(--bg-primary)', border: '1px solid var(--border)',
          borderRadius: '6px', padding: '0 10px', height: '32px',
        }}>
          <Search size={13} color="var(--text-muted)" style={{ flexShrink: 0 }} />
          <input
            ref={inputRef}
            value={query}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            onFocus={() => query && results.length > 0 && setShowDrop(true)}
            placeholder="Search ticker or fund name…"
            style={{ background: 'none', border: 'none', outline: 'none', color: 'var(--text-primary)', fontSize: '13px', flex: 1, minWidth: 0 }}
          />
          {query && (
            <button onClick={() => { setQuery(''); setResults([]); setShowDrop(false); inputRef.current?.focus(); }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'var(--text-muted)', display: 'flex' }}>
              <X size={12} />
            </button>
          )}
        </div>

        {showDrop && results.length > 0 && (
          <div ref={dropRef} style={{
            position: 'absolute', top: '36px', left: 0, right: 0,
            background: 'var(--bg-panel)', border: '1px solid var(--border-bright)',
            borderRadius: '8px', boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
            overflow: 'hidden', zIndex: 200,
          }}>
            {results.map((r, i) => (
              <div key={r.ticker}
                onMouseDown={() => navigate(r.ticker)}
                onMouseEnter={() => setActiveIdx(i)}
                onMouseLeave={() => setActiveIdx(-1)}
                style={{
                  padding: '9px 14px', display: 'flex', alignItems: 'center', gap: '10px',
                  cursor: 'pointer', borderBottom: i < results.length - 1 ? '1px solid var(--border)' : 'none',
                  background: i === activeIdx ? 'var(--bg-panel-hover)' : 'transparent',
                }}
              >
                <span style={{ fontSize: '13px', fontWeight: 700, fontFamily: 'monospace', color: 'var(--text-primary)', minWidth: '48px' }}>
                  {r.ticker}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {r.name}
                  </div>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{r.issuer} · {r.category}</div>
                </div>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'monospace', flexShrink: 0 }}>
                  {fmtAum(r.aum ?? 0)}
                </span>
              </div>
            ))}
            <div style={{ padding: '5px 14px', borderTop: '1px solid var(--border)', fontSize: '10px', color: 'var(--text-muted)' }}>
              ↑↓ navigate · Enter to open · Esc to close
            </div>
          </div>
        )}
        {searching && !showDrop && (
          <div style={{
            position: 'absolute', top: '36px', left: 0, right: 0,
            padding: '12px 14px', background: 'var(--bg-panel)', border: '1px solid var(--border)',
            borderRadius: '8px', fontSize: '12px', color: 'var(--text-muted)', zIndex: 200,
          }}>Searching…</div>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
        <nav className="header-nav" style={{ display: 'flex', gap: '2px' }}>
          {[{ label: 'Overview', href: '/' }, { label: 'Screener', href: '/screener' }].map(({ label, href }) => (
            <a key={label} href={href} style={{
              fontSize: '13px', color: 'var(--text-secondary)', textDecoration: 'none',
              padding: '4px 10px', borderRadius: '5px', transition: 'all 0.15s', whiteSpace: 'nowrap',
            }}
              onMouseEnter={e => { (e.target as HTMLElement).style.color = 'var(--text-primary)'; (e.target as HTMLElement).style.background = 'var(--bg-panel-hover)'; }}
              onMouseLeave={e => { (e.target as HTMLElement).style.color = 'var(--text-secondary)'; (e.target as HTMLElement).style.background = 'transparent'; }}
            >{label}</a>
          ))}
        </nav>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span className="live-dot" style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--green)', display: 'block' }} />
          <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>{time || 'LIVE'}</span>
        </div>
      </div>
    </header>
  );
}
