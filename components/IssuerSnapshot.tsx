'use client';

import { useEffect, useState, useMemo } from 'react';
import { Building2 } from 'lucide-react';
import { fmtAum } from '@/lib/format';
import type { ETF } from '@/types';

interface IssuerRow {
  issuer: string;
  totalAum: number;
  etfCount: number;
  marketShare: number;
}

const ISSUER_COLORS: Record<string, string> = {
  'BlackRock':    '#3b82f6',
  'Vanguard':     '#22c55e',
  'State Street': '#a855f7',
  'Invesco':      '#f97316',
  'Schwab':       '#06b6d4',
  'ProShares':    '#ef4444',
  'VanEck':       '#eab308',
  'ARK Invest':   '#ec4899',
  'Fidelity':     '#10b981',
  'Grayscale':    '#64748b',
};

export default function IssuerSnapshot() {
  const [etfs, setEtfs] = useState<ETF[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/etfs')
      .then(r => r.json())
      .then(json => { setEtfs(json.data ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const issuers = useMemo((): IssuerRow[] => {
    const map: Record<string, { aum: number; count: number }> = {};
    for (const e of etfs) {
      if (!map[e.issuer]) map[e.issuer] = { aum: 0, count: 0 };
      map[e.issuer].aum += e.aum;
      map[e.issuer].count += 1;
    }
    const totalAum = Object.values(map).reduce((s, v) => s + v.aum, 0);
    return Object.entries(map)
      .map(([issuer, { aum, count }]) => ({
        issuer,
        totalAum: aum,
        etfCount: count,
        marketShare: totalAum > 0 ? aum / totalAum : 0,
      }))
      .sort((a, b) => b.totalAum - a.totalAum)
      .slice(0, 10);
  }, [etfs]);

  const maxAum = issuers[0]?.totalAum ?? 1;

  return (
    <div className="panel" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="panel-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Building2 size={14} color="#06b6d4" />
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>Issuers by AUM</span>
        </div>
        <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Tracked universe</span>
      </div>

      <div style={{ overflowY: 'auto', flex: 1, padding: '8px 14px' }}>
        {loading
          ? Array.from({ length: 7 }).map((_, i) => (
              <div key={i} style={{ marginBottom: '12px' }}>
                <div className="skeleton" style={{ height: '10px', width: '80px', marginBottom: '5px' }} />
                <div className="skeleton" style={{ height: '6px', width: '100%', borderRadius: '3px' }} />
              </div>
            ))
          : issuers.map((row) => {
              const color = ISSUER_COLORS[row.issuer] ?? '#64748b';
              const pct = (row.totalAum / maxAum) * 100;
              return (
                <div key={row.issuer} style={{ marginBottom: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{
                        width: '8px', height: '8px', borderRadius: '2px', background: color, display: 'block', flexShrink: 0,
                      }} />
                      <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {row.issuer}
                      </span>
                      <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                        {row.etfCount} funds
                      </span>
                    </div>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'monospace' }}>
                      {fmtAum(row.totalAum)}
                    </span>
                  </div>
                  <div style={{ background: 'var(--border)', borderRadius: '3px', height: '5px', overflow: 'hidden' }}>
                    <div style={{
                      height: '100%',
                      width: `${pct}%`,
                      background: color,
                      borderRadius: '3px',
                      transition: 'width 0.5s ease',
                    }} />
                  </div>
                  <div style={{ fontSize: '9px', color: 'var(--text-muted)', marginTop: '2px', textAlign: 'right' }}>
                    {(row.marketShare * 100).toFixed(1)}% market share
                  </div>
                </div>
              );
            })
        }
      </div>
    </div>
  );
}
