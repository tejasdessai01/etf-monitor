'use client';

import { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, Activity } from 'lucide-react';
import type { FlowEntry } from '@/types';

function fmtFlow(n: number): string {
  const abs = Math.abs(n);
  const sign = n >= 0 ? '+' : '-';
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(0)}M`;
  return `${sign}$${abs.toLocaleString()}`;
}

const CATEGORY_COLORS: Record<string, string> = {
  'US Equity':      '#3b82f6',
  'Fixed Income':   '#a855f7',
  'Commodities':    '#eab308',
  'International':  '#06b6d4',
  'Real Estate':    '#f97316',
  'Sector':         '#22c55e',
  'Thematic':       '#ec4899',
  'Digital Assets': '#f59e0b',
  'Leveraged':      '#ef4444',
  'Multi-Asset':    '#64748b',
  'ESG':            '#10b981',
};

export default function FlowsPanel() {
  const [flows, setFlows] = useState<FlowEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/flows')
      .then(r => r.json())
      .then(json => { setFlows(json.data ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const maxAbs = Math.max(...flows.map(f => Math.abs(f.weeklyFlow)), 1);

  return (
    <div className="panel" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="panel-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Activity size={14} color="#a855f7" />
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>Estimated Fund Flows</span>
        </div>
        <span style={{
          fontSize: '9px',
          color: '#a855f7',
          background: 'rgba(168,85,247,0.12)',
          padding: '2px 6px',
          borderRadius: '4px',
        }}>
          AUM-BASED PROXY
        </span>
      </div>

      <div style={{ overflowY: 'auto', flex: 1, padding: '8px 14px 12px' }}>
        {loading
          ? Array.from({ length: 7 }).map((_, i) => (
              <div key={i} style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                <div className="skeleton" style={{ height: '10px', width: '100px', marginBottom: '6px' }} />
                <div className="skeleton" style={{ height: '5px', width: '100%', borderRadius: '3px' }} />
              </div>
            ))
          : flows.map((f) => {
              const isInflow = f.weeklyFlow >= 0;
              const pct = (Math.abs(f.weeklyFlow) / maxAbs) * 100;
              const color = CATEGORY_COLORS[f.category] ?? '#64748b';
              const flowColor = isInflow ? '#22c55e' : '#ef4444';

              return (
                <div key={f.category} style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{
                        width: '8px', height: '8px', borderRadius: '2px',
                        background: color, display: 'block', flexShrink: 0,
                      }} />
                      <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {f.category}
                      </span>
                      <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                        {f.etfCount} ETFs
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {isInflow
                        ? <TrendingUp size={11} color={flowColor} />
                        : <TrendingDown size={11} color={flowColor} />}
                      <span style={{ fontSize: '12px', fontWeight: 700, color: flowColor, fontFamily: 'monospace' }}>
                        {fmtFlow(f.weeklyFlow)}
                      </span>
                      <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>wk</span>
                    </div>
                  </div>

                  {/* Diverging bar chart */}
                  <div style={{ position: 'relative', height: '5px', background: 'var(--border)', borderRadius: '3px', overflow: 'hidden' }}>
                    {isInflow ? (
                      <div style={{
                        position: 'absolute',
                        left: '50%',
                        top: 0,
                        height: '100%',
                        width: `${pct / 2}%`,
                        background: flowColor,
                        borderRadius: '0 3px 3px 0',
                      }} />
                    ) : (
                      <div style={{
                        position: 'absolute',
                        right: '50%',
                        top: 0,
                        height: '100%',
                        width: `${pct / 2}%`,
                        background: flowColor,
                        borderRadius: '3px 0 0 3px',
                      }} />
                    )}
                    {/* Center divider */}
                    <div style={{
                      position: 'absolute',
                      left: '50%',
                      top: 0,
                      width: '1px',
                      height: '100%',
                      background: 'var(--text-muted)',
                      opacity: 0.4,
                    }} />
                  </div>
                </div>
              );
            })
        }
      </div>

      <div style={{
        padding: '8px 14px',
        borderTop: '1px solid var(--border)',
        fontSize: '9px',
        color: 'var(--text-muted)',
        flexShrink: 0,
      }}>
        Estimated weekly net flows · AUM delta vs seed baseline · Not official ICI data
      </div>
    </div>
  );
}
