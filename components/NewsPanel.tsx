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
          <Newspaper size={14} color="var(--text-secondary)" />
          <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>ETF News</span>
        </div>
        <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)' }}>Yahoo · Reuters</span>
      </div>

      <div style={{ overflowY: 'auto', flex: 1, padding: '6px 6px' }}>
        {loading
          ? Array.from({ length: 8 }).map((_, i) => (
              <div key={i} style={{ padding: '12px 18px' }}>
                <div className="skeleton" style={{ height: '12px', width: '85%', marginBottom: '6px' }} />
                <div className="skeleton" style={{ height: '9px', width: '40%' }} />
              </div>
            ))
          : items.length === 0
          ? (
            <div style={{ padding: '32px 18px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 'var(--fs-sm)' }}>
              News feed unavailable.
            </div>
          )
          : items.map((item) => (
              <a
                key={item.id}
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="list-row"
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{
                      fontSize: 'var(--fs-sm)',
                      color: 'var(--text-primary)',
                      fontWeight: 500,
                      lineHeight: '1.4',
                      marginBottom: '5px',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    } as React.CSSProperties}>
                      {item.title}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)', fontWeight: 500 }}>
                        {item.source}
                      </span>
                      <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)' }}>·</span>
                      <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)' }}>
                        {fmtRelative(item.publishedAt)}
                      </span>
                    </div>
                  </div>
                  <ExternalLink size={11} color="var(--text-muted)" style={{ flexShrink: 0, marginTop: '2px' }} />
                </div>
              </a>
            ))}
      </div>
    </div>
  );
}
