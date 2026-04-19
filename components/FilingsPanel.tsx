'use client';

import { useEffect, useMemo, useState } from 'react';
import { RefreshCw, Sparkles, ChevronRight } from 'lucide-react';
import { fmtRelative } from '@/lib/format';
import IssuerAvatar from './IssuerAvatar';
import type { Filing } from '@/types';

const FORM_LABELS: Record<string, string> = {
  'N-1A':    'New fund',
  '485BPOS': 'Update',
  'N-14':    'Merger',
};

type FilterKey = 'all' | 'N-1A' | '485BPOS';

function dateGroup(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yest = new Date(today.getTime() - 86400000);
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  if (sameDay(d, today)) return 'Today';
  if (sameDay(d, yest)) return 'Yesterday';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function FilingsPanel() {
  const [filings, setFilings] = useState<Filing[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterKey>('all');
  const [lastUpdated, setLastUpdated] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
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

  const displayed = useMemo(
    () => filter === 'all' ? filings : filings.filter(f => f.formType === filter),
    [filings, filter],
  );

  const grouped = useMemo(() => {
    const out: Array<{ label: string; items: Filing[] }> = [];
    let current = '';
    for (const f of displayed) {
      const label = dateGroup(f.filedAt);
      if (label !== current) {
        out.push({ label, items: [] });
        current = label;
      }
      out[out.length - 1].items.push(f);
    }
    return out;
  }, [displayed]);

  function toggle(id: string, f: Filing) {
    if (expanded === id) {
      setExpanded(null);
      return;
    }
    setExpanded(id);
    if (!summaries[id]) summarize(f);
  }

  return (
    <div className="panel" id="filings" style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div className="panel-header">
        <div>
          <div className="panel-title">SEC Filings</div>
          <div className="panel-subtitle">Last 30 days · updated {lastUpdated ? fmtRelative(lastUpdated) : 'just now'}</div>
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
                {f === 'all' ? 'All' : f === 'N-1A' ? 'New funds' : 'Updates'}
              </button>
            ))}
          </div>
          <button onClick={load} className="icon-btn" title="Refresh">
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      <div style={{ overflowY: 'auto' }}>
        {loading ? (
          Array.from({ length: 8 }).map((_, i) => (
            <div key={i} style={{ padding: '16px 24px', display: 'flex', gap: '12px', borderBottom: '1px solid var(--border)' }}>
              <div className="skeleton" style={{ width: 32, height: 32, borderRadius: '50%' }} />
              <div style={{ flex: 1 }}>
                <div className="skeleton" style={{ height: 12, width: '60%', marginBottom: 6 }} />
                <div className="skeleton" style={{ height: 10, width: '40%' }} />
              </div>
            </div>
          ))
        ) : displayed.length === 0 ? (
          <div style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--text-subtle)', fontSize: 'var(--fs-sm)' }}>
            No filings found. SEC EDGAR may be unavailable.
          </div>
        ) : (
          grouped.map(group => (
            <div key={group.label}>
              <div className="feed-date">{group.label}</div>
              {group.items.map(f => {
                const isExpanded = expanded === f.id;
                const tagClass = f.formType === 'N-1A'
                  ? 'tag tag-positive'
                  : f.formType === 'N-14'
                    ? 'tag tag-accent'
                    : 'tag';
                return (
                  <div
                    key={f.id}
                    className={`feed-item${f.isNew ? ' is-new' : ''}`}
                    onClick={() => toggle(f.id, f)}
                  >
                    <IssuerAvatar name={f.entityName} size="md" />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4, flexWrap: 'wrap' }}>
                        <span className={tagClass}>{FORM_LABELS[f.formType] ?? f.formType}</span>
                        <span className="tag tag-mono">{f.formType}</span>
                        {f.isNew && <span className="tag tag-accent">New</span>}
                      </div>
                      <div style={{
                        fontSize: 'var(--fs-base)',
                        fontWeight: 500,
                        color: 'var(--text)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        letterSpacing: '-0.1px',
                      }}>
                        {f.entityName}
                      </div>
                      {f.description && (
                        <div style={{
                          fontSize: 'var(--fs-sm)',
                          color: 'var(--text-muted)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          marginTop: 2,
                        }}>
                          {f.description}
                        </div>
                      )}
                      {isExpanded && (
                        <div style={{
                          marginTop: 12,
                          padding: 14,
                          background: 'var(--surface-soft)',
                          borderRadius: 'var(--radius-sm)',
                          fontSize: 'var(--fs-sm)',
                          color: 'var(--text)',
                          lineHeight: 1.6,
                        }} onClick={e => e.stopPropagation()}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 'var(--fs-xs)', color: 'var(--text-subtle)', marginBottom: 8, fontWeight: 500 }}>
                            <Sparkles size={11} /> AI summary
                          </div>
                          {loadingSummary[f.id] || !summaries[f.id]
                            ? <span style={{ color: 'var(--text-subtle)' }}>Generating summary…</span>
                            : <span>{summaries[f.id]}</span>}
                          <div style={{ marginTop: 12, display: 'flex', gap: 12, fontSize: 'var(--fs-xs)' }}>
                            <a href={f.url} target="_blank" rel="noopener noreferrer"
                               onClick={e => e.stopPropagation()}
                               style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 500 }}>
                              Open on SEC EDGAR →
                            </a>
                          </div>
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0, paddingTop: 2 }}>
                      <span className="tabular" style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-subtle)' }}>
                        {fmtRelative(f.filedAt)}
                      </span>
                      <ChevronRight
                        size={14}
                        color="var(--text-subtle)"
                        style={{ transform: isExpanded ? 'rotate(90deg)' : 'none', transition: 'transform 120ms ease' }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
