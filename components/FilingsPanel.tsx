'use client';

import { useEffect, useState } from 'react';
import { FileText, ExternalLink, RefreshCw } from 'lucide-react';
import { fmtRelative, fmtDate } from '@/lib/format';
import type { Filing } from '@/types';

const FORM_COLORS: Record<string, string> = {
  'N-1A':    '#3b82f6',
  '485BPOS': '#22c55e',
  'N-14':    '#a855f7',
  'default': '#64748b',
};

const FORM_LABELS: Record<string, string> = {
  'N-1A':    'New Fund',
  '485BPOS': 'Update',
  'N-14':    'Merger',
};

export default function FilingsPanel() {
  const [filings, setFilings] = useState<Filing[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'N-1A' | '485BPOS'>('all');
  const [lastUpdated, setLastUpdated] = useState('');

  function load() {
    setLoading(true);
    fetch('/api/filings?days=30')
      .then(r => r.json())
      .then(json => {
        setFilings(json.data ?? []);
        setLastUpdated(json.updatedAt ?? '');
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  const displayed = filter === 'all'
    ? filings
    : filings.filter(f => f.formType === filter);

  return (
    <div className="panel" id="filings" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="panel-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <FileText size={14} color="#a855f7" />
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>SEC Filings</span>
          <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Last 30 days</span>
        </div>
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          {(['all', 'N-1A', '485BPOS'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                fontSize: '10px',
                padding: '2px 8px',
                borderRadius: '4px',
                border: 'none',
                cursor: 'pointer',
                background: filter === f ? 'rgba(168,85,247,0.15)' : 'transparent',
                color: filter === f ? '#a855f7' : 'var(--text-secondary)',
                fontWeight: filter === f ? 600 : 400,
              }}
            >
              {f === 'all' ? 'All' : f}
            </button>
          ))}
          <button
            onClick={load}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '2px' }}
            title="Refresh"
          >
            <RefreshCw size={11} />
          </button>
        </div>
      </div>

      <div style={{ overflowY: 'auto', flex: 1, padding: '4px 0' }}>
        {loading ? (
          Array.from({ length: 8 }).map((_, i) => (
            <div key={i} style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)' }}>
              <div className="skeleton" style={{ height: '11px', width: '70%', marginBottom: '6px' }} />
              <div className="skeleton" style={{ height: '9px', width: '40%' }} />
            </div>
          ))
        ) : displayed.length === 0 ? (
          <div style={{ padding: '24px 14px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
            No filings found. SEC EDGAR may be unavailable.
          </div>
        ) : (
          displayed.map((f) => {
            const color = FORM_COLORS[f.formType] ?? FORM_COLORS.default;
            return (
              <div
                key={f.id}
                className="table-row"
                style={{
                  padding: '9px 14px',
                  borderBottom: '1px solid var(--border)',
                  cursor: 'pointer',
                }}
                onClick={() => window.open(f.url, '_blank')}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
                      <span style={{
                        fontSize: '9px',
                        padding: '1px 5px',
                        borderRadius: '3px',
                        fontWeight: 700,
                        background: color + '22',
                        color: color,
                        letterSpacing: '0.3px',
                      }}>
                        {FORM_LABELS[f.formType] ?? f.formType}
                      </span>
                      <span style={{ fontSize: '9px', fontWeight: 700, color: color, fontFamily: 'monospace' }}>
                        {f.formType}
                      </span>
                      {f.isNew && (
                        <span style={{
                          fontSize: '8px',
                          padding: '1px 4px',
                          borderRadius: '3px',
                          background: 'rgba(34,197,94,0.15)',
                          color: '#22c55e',
                          fontWeight: 700,
                        }}>
                          NEW
                        </span>
                      )}
                    </div>
                    <div style={{
                      fontSize: '12px',
                      color: 'var(--text-primary)',
                      fontWeight: 500,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}>
                      {f.entityName}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px', flexShrink: 0 }}>
                    <ExternalLink size={10} color="var(--text-muted)" />
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                      {fmtRelative(f.filedAt)}
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {lastUpdated && (
        <div style={{ padding: '6px 14px', borderTop: '1px solid var(--border)', fontSize: '10px', color: 'var(--text-muted)' }}>
          Data from SEC EDGAR · updated {fmtRelative(lastUpdated)}
        </div>
      )}
    </div>
  );
}
