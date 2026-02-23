'use client';

import { useEffect, useState } from 'react';
import { X, Layers, ExternalLink } from 'lucide-react';
import type { HoldingsResult } from '@/types';

interface Props {
  ticker: string;
  name: string;
  onClose: () => void;
}

function fmt(n: number) {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtVal(n: number) {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  return `$${n.toLocaleString()}`;
}

export default function HoldingsDrawer({ ticker, name, onClose }: Props) {
  const [result, setResult] = useState<HoldingsResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(false);
    setResult(null);

    fetch(`/api/holdings?ticker=${ticker}`)
      .then(r => r.json())
      .then(json => {
        setResult(json.data as HoldingsResult);
        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  }, [ticker]);

  const hasHoldings = result && result.source === 'nport' && result.holdings.length > 0;

  return (
    /* Backdrop */
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.55)',
        zIndex: 50,
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        padding: '0 0 0 0',
      }}
    >
      {/* Drawer panel */}
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--bg-panel)',
          border: '1px solid var(--border)',
          borderRadius: '12px 12px 0 0',
          width: '100%',
          maxWidth: '680px',
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 -8px 40px rgba(0,0,0,0.4)',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '16px 20px',
          borderBottom: '1px solid var(--border)',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Layers size={16} color="var(--blue)" />
            <div>
              <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'monospace' }}>
                {ticker}
              </span>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)', marginLeft: '8px' }}>
                {name}
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {hasHoldings && (
              <span style={{ fontSize: '10px', color: 'var(--text-muted)', background: 'var(--border)', padding: '2px 8px', borderRadius: '10px' }}>
                NPORT-P · {result.asOfDate}
              </span>
            )}
            <a
              href={`https://finance.yahoo.com/quote/${ticker}/holdings`}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}
              title="View on Yahoo Finance"
            >
              <ExternalLink size={14} />
            </a>
            <button
              onClick={onClose}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: 0 }}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div style={{ overflowY: 'auto', flex: 1, padding: '12px 20px 20px' }}>
          {loading && (
            <div style={{ padding: '20px 0' }}>
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                  <div className="skeleton" style={{ height: '12px', width: '200px' }} />
                  <div className="skeleton" style={{ height: '12px', width: '60px' }} />
                </div>
              ))}
            </div>
          )}

          {!loading && error && (
            <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
              Could not load holdings data.
            </div>
          )}

          {!loading && !error && !hasHoldings && (
            <div style={{ padding: '40px 0', textAlign: 'center' }}>
              <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: '8px' }}>
                No NPORT-P filing found for {ticker}.
              </p>
              <p style={{ color: 'var(--text-muted)', fontSize: '11px' }}>
                Some ETFs (e.g. Bitcoin funds) are exempt from NPORT-P filing requirements.
              </p>
              <a
                href={`https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&company=&CIK=${ticker}&type=NPORT-P&dateb=&owner=include&count=10`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ display: 'inline-block', marginTop: '12px', fontSize: '11px', color: 'var(--blue)', textDecoration: 'none' }}
              >
                Search SEC EDGAR directly ↗
              </a>
            </div>
          )}

          {!loading && hasHoldings && (
            <>
              {/* Holdings table */}
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    <th style={{ padding: '8px 0', textAlign: 'left', fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px', fontWeight: 500 }}>
                      #
                    </th>
                    <th style={{ padding: '8px 0', textAlign: 'left', fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px', fontWeight: 500 }}>
                      Holding
                    </th>
                    <th style={{ padding: '8px 0', textAlign: 'right', fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px', fontWeight: 500 }}>
                      Weight
                    </th>
                    <th style={{ padding: '8px 0', textAlign: 'right', fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px', fontWeight: 500 }}>
                      Value
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {result.holdings.map((h, i) => (
                    <tr
                      key={i}
                      style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.1s' }}
                      className="table-row"
                    >
                      <td style={{ padding: '10px 0', fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'monospace', width: '24px' }}>
                        {i + 1}
                      </td>
                      <td style={{ padding: '10px 8px' }}>
                        {h.ticker ? (
                          <a
                            href={`https://finance.yahoo.com/quote/${h.ticker}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ textDecoration: 'none' }}
                          >
                            <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--blue)', fontFamily: 'monospace', marginRight: '6px' }}>
                              {h.ticker}
                            </span>
                            <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                              {h.name}
                            </span>
                          </a>
                        ) : (
                          <span style={{ fontSize: '12px', color: 'var(--text-primary)' }}>
                            {h.name}
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '10px 0', textAlign: 'right' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }}>
                          {/* Mini bar */}
                          <div style={{
                            width: '60px',
                            height: '4px',
                            background: 'var(--border)',
                            borderRadius: '2px',
                            overflow: 'hidden',
                          }}>
                            <div style={{
                              height: '100%',
                              width: `${Math.min(100, (h.weight / (result.holdings[0]?.weight ?? 1)) * 100)}%`,
                              background: 'var(--blue)',
                              borderRadius: '2px',
                            }} />
                          </div>
                          <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'monospace', minWidth: '45px', textAlign: 'right' }}>
                            {fmt(h.weight)}%
                          </span>
                        </div>
                      </td>
                      <td style={{ padding: '10px 0', textAlign: 'right', fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                        {h.value > 0 ? fmtVal(h.value) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <p style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '16px' }}>
                Source: SEC EDGAR NPORT-P filing · Top {result.holdings.length} holdings shown ·{' '}
                <a
                  href={`https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${ticker}&type=NPORT-P&dateb=&owner=include&count=10`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: 'var(--blue)', textDecoration: 'none' }}
                >
                  View on EDGAR ↗
                </a>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
