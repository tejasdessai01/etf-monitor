'use client';

import { useEffect, useState } from 'react';
import { fmtDate } from '@/lib/format';
import IssuerAvatar from './IssuerAvatar';
import type { Filing } from '@/types';

export default function NewLaunches() {
  const [launches, setLaunches] = useState<Filing[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/filings?days=90&form=N-1A')
      .then(r => r.json())
      .then(json => {
        setLaunches((json.data ?? []).filter((f: Filing) => f.formType === 'N-1A').slice(0, 8));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div className="panel" style={{ display: 'flex', flexDirection: 'column' }}>
      <div className="panel-header">
        <div>
          <div className="panel-title">New launches</div>
          <div className="panel-subtitle">N-1A · 90 days</div>
        </div>
      </div>

      <div style={{ padding: '6px 8px' }}>
        {loading
          ? Array.from({ length: 4 }).map((_, i) => (
              <div key={i} style={{ padding: '10px 12px', display: 'flex', gap: 10 }}>
                <div className="skeleton" style={{ width: 24, height: 24, borderRadius: '50%' }} />
                <div style={{ flex: 1 }}>
                  <div className="skeleton" style={{ height: 10, width: '70%', marginBottom: 5 }} />
                  <div className="skeleton" style={{ height: 9, width: '40%' }} />
                </div>
              </div>
            ))
          : launches.length === 0
          ? (
            <div style={{ padding: '20px 12px', textAlign: 'center', color: 'var(--text-subtle)', fontSize: 'var(--fs-sm)' }}>
              No new registrations found.
            </div>
          )
          : launches.map(f => (
              <a
                key={f.id}
                href={f.url}
                target="_blank"
                rel="noopener noreferrer"
                className="list-row"
                style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}
              >
                <IssuerAvatar name={f.entityName} size="sm" />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 'var(--fs-sm)',
                    fontWeight: 500,
                    color: 'var(--text)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {f.entityName}
                  </div>
                  <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-subtle)', marginTop: 2 }}>
                    Filed {fmtDate(f.filedAt)}
                  </div>
                </div>
              </a>
            ))
        }
      </div>
    </div>
  );
}
