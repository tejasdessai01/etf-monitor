'use client';

import { Twitter } from 'lucide-react';
import { ETF_SOCIAL_ACCOUNTS } from '@/lib/etf-data';

export default function SocialPanel() {
  return (
    <div className="panel" style={{ display: 'flex', flexDirection: 'column' }}>
      <div className="panel-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Twitter size={14} color="#1d9bf0" />
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>ETF Community</span>
        </div>
        <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Top voices on X</span>
      </div>

      <div style={{ padding: '8px 12px', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
        {ETF_SOCIAL_ACCOUNTS.map((acct) => (
          <a
            key={acct.handle}
            href={acct.url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '7px 10px',
              borderRadius: '6px',
              border: '1px solid var(--border)',
              textDecoration: 'none',
              flex: '1 1 calc(50% - 4px)',
              minWidth: '0',
              background: 'var(--bg-primary)',
              transition: 'border-color 0.15s',
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = '#1d9bf044'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'; }}
          >
            <div style={{
              width: '28px',
              height: '28px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #1d9bf020, #1d9bf040)',
              border: '1px solid #1d9bf030',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              fontSize: '11px',
              fontWeight: 700,
              color: '#1d9bf0',
            }}>
              {acct.name.charAt(0)}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {acct.name}
              </div>
              <div style={{ fontSize: '9px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {acct.role}
              </div>
            </div>
          </a>
        ))}
      </div>

      <div style={{ padding: '8px 14px', borderTop: '1px solid var(--border)', fontSize: '10px', color: 'var(--text-muted)' }}>
        Twitter/X embedded feeds coming in v2
      </div>
    </div>
  );
}
