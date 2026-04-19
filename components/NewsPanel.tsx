'use client';

import { useEffect, useState } from 'react';
import { fmtRelative } from '@/lib/format';
import type { NewsItem } from '@/types';

export default function NewsPanel() {
  const [items, setItems] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/news')
      .then(r => r.json())
      .then(json => { setItems((json.data ?? []).slice(0, 5)); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div className="panel" id="news" style={{ display: 'flex', flexDirection: 'column' }}>
      <div className="panel-header">
        <div>
          <div className="panel-title">Headlines</div>
          <div className="panel-subtitle">Yahoo · Reuters</div>
        </div>
      </div>

      <div style={{ padding: '6px 8px' }}>
        {loading
          ? Array.from({ length: 4 }).map((_, i) => (
              <div key={i} style={{ padding: '10px 12px' }}>
                <div className="skeleton" style={{ height: 11, width: '90%', marginBottom: 5 }} />
                <div className="skeleton" style={{ height: 9, width: '40%' }} />
              </div>
            ))
          : items.length === 0
          ? (
            <div style={{ padding: '20px 12px', textAlign: 'center', color: 'var(--text-subtle)', fontSize: 'var(--fs-sm)' }}>
              News feed unavailable.
            </div>
          )
          : items.map(item => (
              <a
                key={item.id}
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="list-row"
              >
                <div style={{
                  fontSize: 'var(--fs-sm)',
                  color: 'var(--text)',
                  fontWeight: 500,
                  lineHeight: 1.4,
                  marginBottom: 4,
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                } as React.CSSProperties}>
                  {item.title}
                </div>
                <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-subtle)' }}>
                  {item.source} · {fmtRelative(item.publishedAt)}
                </div>
              </a>
            ))}
      </div>
    </div>
  );
}
