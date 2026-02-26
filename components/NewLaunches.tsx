'use client';

import { useEffect, useState } from 'react';
import { Rocket, ExternalLink } from 'lucide-react';
import { fmtDate, fmtRelative } from '@/lib/format';
import type { Filing } from '@/types';

export default function NewLaunches() {
  const [launches, setLaunches] = useState<Filing[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // N-1A = new fund registration (new ETF launch)
    fetch('/api/filings?days=90&form=N-1A')
      .then(r => r.json())
      .then(json => {
        setLaunches((json.data ?? []).slice(0, 20));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div className="panel" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="panel-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Rocket size={14} color="#22c55e" />
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>New ETF Launches</span>
          <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>Last 90 days · N-1A filings</span>
        </div>
        <span style={{ fontSize: '10px', color: '#22c55e', fontWeight: 600 }}>
          {launches.length} found
        </span>
      </div>

      <div style={{ overflowY: 'auto', flex: 1 }}>
        {loading
          ? Array.from({ length: 6 }).map((_, i) => (
              <div key={i} style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)' }}>
                <div className="skeleton" style={{ height: '11px', width: '75%', marginBottom: '5px' }} />
                <div className="skeleton" style={{ height: '9px', width: '35%' }} />
              </div>
            ))
          : launches.length === 0
          ? (
            <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
              No new fund registrations found.<br />
              <a href="https://efts.sec.gov/LATEST/search-index?forms=N-1A" target="_blank" rel="noopener noreferrer" style={{ color: '#3b82f6', fontSize: '11px' }}>
                Search SEC EDGAR directly →
              </a>
            </div>
          )
          : launches.map((f) => (
              <div
                key={f.id}
                className="table-row"
                style={{
                  padding: '9px 14px',
                  borderBottom: '1px solid var(--border)',
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  gap: '8px',
                }}
                onClick={() => window.open(f.url, '_blank')}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '3px' }}>
                    <span style={{
                      fontSize: '8px',
                      padding: '1px 5px',
                      borderRadius: '3px',
                      background: 'rgba(34,197,94,0.12)',
                      color: '#22c55e',
                      fontWeight: 700,
                      letterSpacing: '0.5px',
                    }}>
                      N-1A FILING
                    </span>
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
                  {f.description && (
                    <div style={{
                      fontSize: '10px',
                      color: 'var(--text-secondary)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      marginTop: '1px',
                    }}>
                      {f.description}
                    </div>
                  )}
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>
                    Filed {fmtDate(f.filedAt)}
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px', flexShrink: 0 }}>
                  <ExternalLink size={10} color="var(--text-muted)" />
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                    {fmtRelative(f.filedAt)}
                  </span>
                </div>
              </div>
            ))
        }
      </div>

      <div style={{ padding: '6px 14px', borderTop: '1px solid var(--border)', fontSize: '10px', color: 'var(--text-muted)' }}>
        Source: SEC EDGAR N-1A registration statements
      </div>
    </div>
  );
}
