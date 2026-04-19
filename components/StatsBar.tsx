'use client';

import { useEffect, useState } from 'react';
import type { Filing } from '@/types';

interface Props {
  totalAUM?: number;  // kept for backwards-compat with existing imports; unused here
}

interface Stats {
  weekFilings: number | null;
  newFundsThisMonth: number | null;
  activeIssuers: number | null;
  universe: number | null;
}

function daysAgo(iso: string): number {
  const now = Date.now();
  const then = new Date(iso).getTime();
  return (now - then) / 86400000;
}

export default function StatsBar(_props: Props) {
  const [stats, setStats] = useState<Stats>({
    weekFilings: null, newFundsThisMonth: null, activeIssuers: null, universe: null,
  });

  useEffect(() => {
    // Derive intelligence KPIs from the filings feed (no extra endpoint needed)
    Promise.all([
      fetch('/api/filings?days=30').then(r => r.json()).catch(() => null),
      fetch('/api/etfs').then(r => r.json()).catch(() => null),
    ]).then(([filingsJson, etfsJson]) => {
      const filings: Filing[] = filingsJson?.data ?? [];
      const weekFilings = filings.filter(f => daysAgo(f.filedAt) <= 7).length;
      const newFundsThisMonth = filings.filter(
        f => f.formType === 'N-1A' && daysAgo(f.filedAt) <= 30,
      ).length;
      const activeIssuers = new Set(
        filings.filter(f => daysAgo(f.filedAt) <= 7).map(f => f.entityName),
      ).size;
      const universe = etfsJson?.total ?? null;
      setStats({ weekFilings, newFundsThisMonth, activeIssuers, universe });
    });
  }, []);

  const tiles = [
    { label: 'Filings this week',   value: stats.weekFilings,       delta: 'SEC EDGAR · 7 days' },
    { label: 'New funds · 30 days', value: stats.newFundsThisMonth, delta: 'N-1A registrations' },
    { label: 'Active issuers',      value: stats.activeIssuers,     delta: 'Filed in last 7 days' },
    { label: 'US ETF universe',     value: stats.universe,          delta: 'Tracked funds' },
  ];

  return (
    <div className="kpi-row">
      {tiles.map(t => (
        <div key={t.label} className="kpi-tile">
          <div className="kpi-label">{t.label}</div>
          <div className="kpi-value">
            {t.value == null ? '—' : t.value.toLocaleString()}
          </div>
          <div className="kpi-delta">{t.delta}</div>
        </div>
      ))}
    </div>
  );
}
