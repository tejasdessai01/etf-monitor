'use client';

import { useEffect, useState } from 'react';
import { fmtAum, fmtPct, chgClass } from '@/lib/format';
import type { ETF } from '@/types';

interface TickerItem {
  ticker: string;
  price?: number;
  changePct?: number;
}

interface StatsBarProps {
  totalETFs: number;
  totalAUM: number;
}

export default function StatsBar({ totalETFs, totalAUM }: StatsBarProps) {
  const [tickers, setTickers] = useState<TickerItem[]>([]);

  useEffect(() => {
    fetch('/api/etfs')
      .then((r) => r.json())
      .then((json) => {
        const items: TickerItem[] = (json.data as ETF[])
          .filter((e) => e.price !== undefined)
          .slice(0, 20)
          .map((e) => ({ ticker: e.ticker, price: e.price, changePct: e.changePct }));
        setTickers(items);
      })
      .catch(() => {});
  }, []);

  const duplicated = [...tickers, ...tickers]; // seamless loop

  return (
    <div
      style={{
        borderBottom: '1px solid var(--border)',
        background: 'var(--bg-panel)',
      }}
    >
      {/* Stats row */}
      <div
        style={{
          display: 'flex',
          gap: 0,
          borderBottom: '1px solid var(--border)',
          padding: '0 20px',
        }}
      >
        {[
          { label: 'Total US ETFs', value: totalETFs.toLocaleString() + '+' },
          { label: 'Total AUM',      value: fmtAum(totalAUM) },
          { label: 'Tracked Funds',  value: '70+' },
          { label: 'Data Source',    value: 'SEC EDGAR + Yahoo Finance' },
          { label: 'Updated',        value: 'Every 5 min' },
        ].map(({ label, value }) => (
          <div
            key={label}
            style={{
              padding: '10px 24px 10px 0',
              marginRight: '24px',
              borderRight: '1px solid var(--border)',
              minWidth: '140px',
            }}
          >
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '2px' }}>
              {label}
            </div>
            <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
              {value}
            </div>
          </div>
        ))}
      </div>

      {/* Live ticker strip */}
      <div style={{ overflow: 'hidden', padding: '8px 0', height: '36px' }}>
        {tickers.length > 0 ? (
          <div className="ticker-track" style={{ gap: '0' }}>
            {duplicated.map((item, i) => (
              <span
                key={i}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '0 20px',
                  borderRight: '1px solid var(--border)',
                  fontSize: '12px',
                }}
              >
                <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'monospace' }}>
                  {item.ticker}
                </span>
                {item.price !== undefined && (
                  <span style={{ color: 'var(--text-secondary)' }}>${item.price.toFixed(2)}</span>
                )}
                {item.changePct !== undefined && (
                  <span className={chgClass(item.changePct)} style={{ fontWeight: 600 }}>
                    {fmtPct(item.changePct)}
                  </span>
                )}
              </span>
            ))}
          </div>
        ) : (
          <div style={{ padding: '0 20px', fontSize: '12px', color: 'var(--text-muted)' }}>
            Loading live prices…
          </div>
        )}
      </div>
    </div>
  );
}
