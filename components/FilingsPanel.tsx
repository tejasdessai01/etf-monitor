'use client';

import { useEffect, useState } from 'react';
import { FileText, ExternalLink, RefreshCw, Sparkles } from 'lucide-react';
import { fmtRelative } from '@/lib/format';
import type { Filing } from '@/types';

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
  const [summaries, setSummaries] = useState<Record<string, string>>({});
  const [loadingSummary, setLoadingSummary] = useState<Record<string, boolean>>({});

  async function summarize(f: Filing) {
    if (summaries[f.id]) return;
    setLoadingSummary(s => ({ ...s, [f.id]: true }));
    try {
      const res = await fetch('/api/ai-summary', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ formType: f.formType, entityName: f.entityName, description: f.description }),
      });
      const json = await res.json();
      setSummaries(s => ({ ...s, [f.id]: json.summary ?? json.error ?? 'No summary available.' }));
    } catch {
      setSummaries(s => ({ ...s, [f.id]: 'Failed to generate summary.' }));
    } finally {
      setLoadingSummary(s => ({ ...s, [f.id]: false }));
    }
  }

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
          <FileText size={14} color="var(--text-secondary)" />
          <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>SEC Filings</span>
          <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)' }}>Last 30 days</span>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <div className="seg">
            {(['all', 'N-1A', '485BPOS'] as const).map(f => (
              <button
                key={f}
                className="seg-btn"
                data-active={filter === f}
                onClick={() => setFilter(f)}
              >
                {f === 'all' ? 'All' : f}
              </button>
            ))}
          </div>
          <button onClick={load} className="icon-btn" title="Refresh">
            <RefreshCw size={12} />
          </button>
        </div>
      </div>

      <div style={{ overflowY: 'auto', flex: 1, padding: '6px 6px' }}>
        {loading ? (
          Array.from({ length: 8 }).map((_, i) => (
            <div key={i} style={{ padding: '12px 18px' }}>
              <div className="skeleton" style={{ height: '11px', width: '70%', marginBottom: '6px' }} />
              <div className="skeleton" style={{ height: '9px', width: '40%' }} />
            </div>
          ))
        ) : displayed.length === 0 ? (
          <div style={{ padding: '32px 18px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 'var(--fs-sm)' }}>
            No filings found. SEC EDGAR may be unavailable.
          </div>
        ) : (
          displayed.map((f) => (
            <div
              key={f.id}
              className="list-row"
              onClick={() => window.open(f.url, '_blank')}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                    <span className={f.formType === 'N-1A' ? 'pill pill-accent' : 'pill'}>
                      {FORM_LABELS[f.formType] ?? f.formType}
                    </span>
                    {f.isNew && <span className="pill pill-positive">New</span>}
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
                  {summaries[f.id] && (
                    <div style={{
                      fontSize: 'var(--fs-xs)',
                      color: 'var(--text-secondary)',
                      marginTop: '8px',
                      lineHeight: 1.5,
                      background: 'var(--bg-subtle)',
                      borderLeft: '2px solid var(--accent-border)',
                      padding: '8px 10px',
                      borderRadius: '0 6px 6px 0',
                    }}>
                      {summaries[f.id]}
                    </div>
                  )}
                  {!summaries[f.id] && (
                    <button
                      onClick={e => { e.stopPropagation(); summarize(f); }}
                      disabled={loadingSummary[f.id]}
                      style={{
                        marginTop: '6px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontSize: 'var(--fs-xs)',
                        color: 'var(--text-muted)',
                        background: 'none',
                        border: 'none',
                        padding: 0,
                        cursor: loadingSummary[f.id] ? 'default' : 'pointer',
                      }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--accent)'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; }}
                    >
                      <Sparkles size={10} />
                      {loadingSummary[f.id] ? 'Summarizing…' : 'AI summary'}
                    </button>
                  )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '3px', flexShrink: 0 }}>
                  <ExternalLink size={11} color="var(--text-muted)" />
                  <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)' }}>
                    {fmtRelative(f.filedAt)}
                  </span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {lastUpdated && (
        <div style={{ padding: '8px 18px', borderTop: '1px solid var(--border)', fontSize: 'var(--fs-xs)', color: 'var(--text-muted)' }}>
          SEC EDGAR · updated {fmtRelative(lastUpdated)}
        </div>
      )}
    </div>
  );
}
