'use client';

import { useEffect, useState } from 'react';
import { Newspaper, ExternalLink } from 'lucide-react';
import { fmtRelative } from '@/lib/format';
import type { NewsItem } from '@/types';

export default function NewsPanel() {
  const [items, setItems] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/news')
      .then(r => r.json())
      .then(json => { setItems(json.data ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div className="panel" id="news" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="panel-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Newspaper size={14} color="#eab308" />
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>ETF News</span>
        </div>
        <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>via Google News · 15m cache</span>
      </div>

      <div style={{ overflowY: 'auto', flex: 1 }}>
        {loading
          ? Array.from({ length: 8 }).map((_, i) => (
              <div key={i} style={{ padding: '11px 14px', borderBottom: '1px solid var(--border)' }}>
                <div className="skeleton" style={{ height: '12px', width: '85%', marginBottom: '6px' }} />
                <div className="skeleton" style={{ height: '9px', width: '40%' }} />
              </div>
            ))
          : items.length === 0
          ? (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
              News feed unavailable. Google News RSS may be blocked.
            </div>
          )
          : items.map((item) => (
              <a
                key={item.id}
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="table-row"
                style={{
                  display: 'block',
                  padding: '10px 14px',
                  borderBottom: '1px solid var(--border)',
                  textDecoration: 'none',
                  cursor: 'pointer',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{
                      fontSize: '12px',
                      color: 'var(--text-primary)',
                      fontWeight: 500,
                      lineHeight: '1.4',
                      marginBottom: '4px',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    } as React.CSSProperties}>
                      {item.title}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '10px', color: '#3b82f6', fontWeight: 600 }}>
                        {item.source}
                      </span>
                      <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>·</span>
                      <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                        {fmtRelative(item.publishedAt)}
                      </span>
                    </div>
                  </div>
                  <ExternalLink size={10} color="var(--text-muted)" style={{ flexShrink: 0, marginTop: '2px' }} />
                </div>
              </a>
            ))}
      </div>
    </div>
  );
}
