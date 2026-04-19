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
          <Building2 size={14} color="var(--text-secondary)" />
          <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>Issuers by AUM</span>
        </div>
        <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)' }}>Tracked universe</span>
      </div>

      <div style={{ overflowY: 'auto', flex: 1, padding: '12px 18px' }}>
        {loading
          ? Array.from({ length: 7 }).map((_, i) => (
              <div key={i} style={{ marginBottom: '14px' }}>
                <div className="skeleton" style={{ height: '10px', width: '80px', marginBottom: '6px' }} />
                <div className="skeleton" style={{ height: '6px', width: '100%', borderRadius: '3px' }} />
              </div>
            ))
          : issuers.map((row) => {
              const pct = (row.totalAum / maxAum) * 100;
              return (
                <div key={row.issuer} style={{ marginBottom: '14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 500, color: 'var(--text-primary)' }}>
                        {row.issuer}
                      </span>
                      <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)' }}>
                        {row.etfCount} funds
                      </span>
                    </div>
                    <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 500, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
                      {fmtAum(row.totalAum)}
                    </span>
                  </div>
                  <div style={{ background: 'var(--bg-subtle)', borderRadius: '3px', height: '4px', overflow: 'hidden' }}>
                    <div style={{
                      height: '100%',
                      width: `${pct}%`,
                      background: 'var(--accent)',
                      borderRadius: '3px',
                      transition: 'width 0.5s ease',
                    }} />
                  </div>
                  <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', marginTop: '3px', textAlign: 'right' }}>
                    {(row.marketShare * 100).toFixed(1)}% share
                  </div>
                </div>
              );
            })
        }
      </div>
    </div>
  );
}
