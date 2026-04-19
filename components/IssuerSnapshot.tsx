'use client';

import { useEffect, useState, useMemo } from 'react';
import { fmtAum } from '@/lib/format';
import IssuerAvatar from './IssuerAvatar';
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
      .slice(0, 6);
  }, [etfs]);

  return (
    <div className="panel" style={{ display: 'flex', flexDirection: 'column' }}>
      <div className="panel-header">
        <div>
          <div className="panel-title">Top issuers</div>
          <div className="panel-subtitle">By total AUM</div>
        </div>
      </div>

      <div style={{ padding: '6px 8px' }}>
        {loading
          ? Array.from({ length: 5 }).map((_, i) => (
              <div key={i} style={{ padding: '10px 12px', display: 'flex', gap: 10 }}>
                <div className="skeleton" style={{ width: 24, height: 24, borderRadius: '50%' }} />
                <div style={{ flex: 1 }}>
                  <div className="skeleton" style={{ height: 10, width: '55%', marginBottom: 5 }} />
                  <div className="skeleton" style={{ height: 9, width: '30%' }} />
                </div>
              </div>
            ))
          : issuers.map(row => (
              <div key={row.issuer} className="list-row" style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <IssuerAvatar name={row.issuer} size="sm" />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 500, color: 'var(--text)' }}>
                    {row.issuer}
                  </div>
                  <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-subtle)', marginTop: 1 }}>
                    {row.etfCount} funds · {(row.marketShare * 100).toFixed(1)}% share
                  </div>
                </div>
                <span className="tabular" style={{ fontSize: 'var(--fs-sm)', fontWeight: 500, color: 'var(--text)' }}>
                  {fmtAum(row.totalAum)}
                </span>
              </div>
            ))
        }
      </div>
    </div>
  );
}
