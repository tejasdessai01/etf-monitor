'use client';

import { useEffect, useState } from 'react';
import { Zap } from 'lucide-react';
import { fmtPct, fmtPrice, chgClass, chgArrow } from '@/lib/format';
import { CATEGORY_COLORS } from '@/lib/etf-data';

interface Mover {
  ticker: string;
  name: string;
  changePct: number;
  price: number;
  category: string;
}

export default function TopMovers() {
  const [gainers, setGainers] = useState<Mover[]>([]);
  const [losers, setLosers] = useState<Mover[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'gainers' | 'losers'>('gainers');

  useEffect(() => {
    fetch('/api/movers')
      .then(r => r.json())
      .then(json => {
        setGainers(json.data?.gainers ?? []);
        setLosers(json.data?.losers ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const list = tab === 'gainers' ? gainers : losers;

  function MoverRow({ m }: { m: Mover }) {
    const color = CATEGORY_COLORS[m.category] ?? '#64748b';
    return (
      <div
        className="table-row"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '9px 14px',
          borderBottom: '1px solid var(--border)',
          cursor: 'pointer',
        }}
        onClick={() => window.open(`https://finance.yahoo.com/quote/${m.ticker}`, '_blank')}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '6px',
              background: color + '20',
              border: `1px solid ${color}40`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '9px',
              fontWeight: 700,
              color: color,
              fontFamily: 'monospace',
              letterSpacing: '-0.5px',
            }}
          >
            {m.ticker.length > 4 ? m.ticker.slice(0, 4) : m.ticker}
          </div>
          <div>
            <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'monospace' }}>
              {m.ticker}
            </div>
            <div style={{ fontSize: '10px', color: 'var(--text-secondary)', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {m.name}
            </div>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontFamily: 'monospace', marginBottom: '2px' }}>
            {fmtPrice(m.price)}
          </div>
          <div className={chgClass(m.changePct)} style={{ fontSize: '13px', fontWeight: 700 }}>
            {chgArrow(m.changePct)} {fmtPct(m.changePct)}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="panel" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="panel-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Zap size={14} color="#eab308" />
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>Top Movers</span>
          <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>Today</span>
        </div>
        <div style={{ display: 'flex', gap: '4px' }}>
          {(['gainers', 'losers'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                fontSize: '11px',
                padding: '2px 10px',
                borderRadius: '4px',
                border: 'none',
                cursor: 'pointer',
                background: tab === t ? (t === 'gainers' ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)') : 'transparent',
                color: tab === t ? (t === 'gainers' ? '#22c55e' : '#ef4444') : 'var(--text-secondary)',
                fontWeight: tab === t ? 600 : 400,
                textTransform: 'capitalize',
              }}
            >
              {t === 'gainers' ? '↑ Gainers' : '↓ Losers'}
            </button>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {loading
          ? Array.from({ length: 5 }).map((_, i) => (
              <div key={i} style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}>
                <div className="skeleton" style={{ height: '32px', width: '32px', borderRadius: '6px' }} />
                <div style={{ flex: 1, marginLeft: '10px' }}>
                  <div className="skeleton" style={{ height: '12px', width: '60px', marginBottom: '5px' }} />
                  <div className="skeleton" style={{ height: '9px', width: '100px' }} />
                </div>
              </div>
            ))
          : list.length === 0
          ? <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>No mover data available</div>
          : list.map(m => <MoverRow key={m.ticker} m={m} />)
        }
      </div>
    </div>
  );
}
