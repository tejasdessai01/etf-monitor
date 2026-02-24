'use client';

import { useState, useEffect } from 'react';
import { Activity } from 'lucide-react';

export default function Header() {
  const [time, setTime] = useState('');

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

  return (
    <header style={{
      background: 'var(--bg-panel)',
      borderBottom: '1px solid var(--border)',
      padding: '0 20px',
      height: '52px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      position: 'sticky',
      top: 0,
      zIndex: 100,
    }}>
      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div style={{
          width: '28px', height: '28px', flexShrink: 0,
          background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
          borderRadius: '6px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Activity size={16} color="#fff" />
        </div>
        <span style={{ fontSize: '15px', fontWeight: 700, letterSpacing: '-0.3px', color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
          ETF Monitor
        </span>
        <span style={{
          fontSize: '10px', fontWeight: 600, color: '#3b82f6',
          background: 'rgba(59,130,246,0.12)', padding: '2px 6px',
          borderRadius: '4px', letterSpacing: '0.5px',
        }}>
          US
        </span>
        <span style={{
          fontSize: '9px', fontWeight: 600, color: '#22c55e',
          background: 'rgba(34,197,94,0.1)', padding: '2px 6px',
          borderRadius: '4px', letterSpacing: '0.5px',
        }}>
          v1
        </span>
      </div>

      {/* Center nav — hidden on mobile via CSS */}
      <nav className="header-nav" style={{ display: 'flex', gap: '4px' }}>
        {[
          { label: 'Overview', href: '#overview' },
          { label: 'Top Funds', href: '#top-funds' },
          { label: 'Filings', href: '#filings' },
          { label: 'News', href: '#news' },
        ].map(({ label, href }) => (
          <a key={label} href={href} style={{
            fontSize: '13px', color: 'var(--text-secondary)',
            textDecoration: 'none', padding: '4px 12px', borderRadius: '5px', transition: 'all 0.15s',
          }}
            onMouseEnter={e => { (e.target as HTMLElement).style.color = 'var(--text-primary)'; (e.target as HTMLElement).style.background = 'var(--bg-panel-hover)'; }}
            onMouseLeave={e => { (e.target as HTMLElement).style.color = 'var(--text-secondary)'; (e.target as HTMLElement).style.background = 'transparent'; }}
          >
            {label}
          </a>
        ))}
      </nav>

      {/* Right: live clock */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span className="live-dot" style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--green)', display: 'block' }} />
          <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
            {time || 'LIVE'}
          </span>
        </div>
        <a className="header-edgar" href="https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&type=N-1A&dateb=&owner=include&count=40&search_text="
          target="_blank" rel="noopener noreferrer"
          style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: 'var(--text-secondary)', textDecoration: 'none' }}>
          SEC EDGAR ↗
        </a>
      </div>
    </header>
  );
}
