'use client';

import { useEffect, useState } from 'react';
import { Rocket, ExternalLink } from 'lucide-react';
import { fmtDate, fmtRelative } from '@/lib/format';
import type { Filing } from '@/types';

export default function NewLaunches() {
  const [launches, setLaunches] = useState<Filing[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/filings?days=180&form=N-1A')
      .then(r => r.json())
      .then(json => {
        setLaunches((json.data ?? []).slice(0, 20));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const newCount = launches.filter(f => f.formType === 'N-1A').length;
  const amendedCount = launches.filter(f => f.formType !== 'N-1A').length;

  return (
    <div className="panel" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="panel-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Rocket size={14} color="var(--text-secondary)" />
          <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>New ETF Launches</span>
          <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)' }}>N-1A · 180d</span>
        </div>
        <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)' }}>
          {newCount} new · {amendedCount} amended
        </span>
      </div>

      <div style={{ overflowY: 'auto', flex: 1, padding: '6px 6px' }}>
        {loading
          ? Array.from({ length: 6 }).map((_, i) => (
              <div key={i} style={{ padding: '12px 18px' }}>
                <div className="skeleton" style={{ height: '11px', width: '75%', marginBottom: '6px' }} />
                <div className="skeleton" style={{ height: '9px', width: '35%' }} />
              </div>
            ))
          : launches.length === 0
          ? (
            <div style={{ padding: '32px 18px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 'var(--fs-sm)' }}>
              No new fund registrations found.<br />
              <a href="https://efts.sec.gov/LATEST/search-index?forms=N-1A" target="_blank" rel="noopener noreferrer"
                 style={{ color: 'var(--accent)', fontSize: 'var(--fs-xs)' }}>
                Search SEC EDGAR directly →
              </a>
            </div>
          )
          : launches.map((f) => (
              <div
                key={f.id}
                className="list-row"
                onClick={() => window.open(f.url, '_blank')}
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ marginBottom: '4px' }}>
                    <span className={f.formType === 'N-1A' ? 'pill pill-positive' : 'pill'}>
                      {f.formType === 'N-1A' ? 'New fund' : 'Amendment'}
                    </span>
                  </div>
                  <div style={{
                    fontSize: 'var(--fs-sm)',
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
                      fontSize: 'var(--fs-xs)',
                      color: 'var(--text-secondary)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      marginTop: '2px',
                    }}>
                      {f.description}
                    </div>
                  )}
                  <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', marginTop: '3px' }}>
                    Filed {fmtDate(f.filedAt)}
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '3px', flexShrink: 0 }}>
                  <ExternalLink size={11} color="var(--text-muted)" />
                  <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)' }}>
                    {fmtRelative(f.filedAt)}
                  </span>
                </div>
              </div>
            ))
        }
      </div>

      <div style={{ padding: '8px 18px', borderTop: '1px solid var(--border)', fontSize: 'var(--fs-xs)', color: 'var(--text-muted)' }}>
        SEC EDGAR · N-1A registrations
      </div>
    </div>
  );
}
