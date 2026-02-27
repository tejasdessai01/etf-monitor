'use client';

import { useState, useRef, useCallback } from 'react';

type Point = { date: number; price: number };

const PERIODS: Record<string, number> = {
  '1M': 30, '3M': 91, '6M': 182, '1Y': 365, '3Y': 1095, '5Y': 1825,
};

const W = 800, H = 256;
const PAD = { top: 16, right: 16, bottom: 36, left: 60 };
const CW = W - PAD.left - PAD.right;
const CH = H - PAD.top - PAD.bottom;

function filterByPeriod(data: Point[], days: number): Point[] {
  const cutoff = Date.now() - days * 86_400_000;
  return data.filter(p => p.date >= cutoff);
}

function toCoords(data: Point[], minP: number, maxP: number) {
  const minD = data[0].date;
  const maxD = data[data.length - 1].date;
  const dRange = maxD - minD || 1;
  const pRange = maxP - minP || 1;
  return data.map(p => ({
    x: PAD.left + ((p.date - minD) / dRange) * CW,
    y: PAD.top  + (1 - (p.price - minP) / pRange) * CH,
    price: p.price,
    date:  p.date,
  }));
}

function fmtDateLabel(ts: number, compact: boolean) {
  const d = new Date(ts);
  return compact
    ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
}

function fmtTooltipDate(ts: number) {
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function PriceChart({ data }: { data: Point[] }) {
  const [period, setPeriod] = useState<string>('1Y');
  const [hover, setHover] = useState<{ x: number; y: number; price: number; date: number } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const filtered = filterByPeriod(data, PERIODS[period]);

  if (filtered.length < 2) {
    return (
      <div style={{ height: H, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
        Not enough price data for this period
      </div>
    );
  }

  const prices   = filtered.map(p => p.price);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const pad      = (maxPrice - minPrice) * 0.06;
  const lo = minPrice - pad;
  const hi = maxPrice + pad;

  const pts   = toCoords(filtered, lo, hi);
  const start = filtered[0].price;
  const end   = filtered[filtered.length - 1].price;
  const periodReturn = (end - start) / start;
  const isPos = periodReturn >= 0;
  const color = isPos ? '#22c55e' : '#ef4444';

  const linePath = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  const fillPath = `${linePath} L ${pts[pts.length - 1].x.toFixed(1)} ${(PAD.top + CH).toFixed(1)} L ${pts[0].x.toFixed(1)} ${(PAD.top + CH).toFixed(1)} Z`;

  // 5 y-axis gridlines
  const yLines = Array.from({ length: 5 }, (_, i) => {
    const frac = i / 4;
    return { v: lo + frac * (hi - lo), y: PAD.top + (1 - frac) * CH };
  });

  // 6 x-axis labels evenly spaced
  const xLabels = Array.from({ length: 6 }, (_, i) => {
    const idx = Math.round(i * (pts.length - 1) / 5);
    return pts[idx];
  });

  const compact = period === '1M' || period === '3M';

  const handleMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const mx = ((e.clientX - rect.left) / rect.width) * W;
    let nearest = pts[0];
    let best = Infinity;
    for (const p of pts) {
      const d = Math.abs(p.x - mx);
      if (d < best) { best = d; nearest = p; }
    }
    setHover({ x: nearest.x, y: nearest.y, price: nearest.price, date: nearest.date });
  }, [pts]);

  // Tooltip positioning: flip left if too close to right edge
  const tipX = hover ? (hover.x + 104 > W ? hover.x - 108 : hover.x + 10) : 0;
  const tipY = hover ? Math.max(hover.y - 34, PAD.top) : 0;

  const gradId = `chart-grad-${period}`;

  return (
    <div>
      {/* Controls row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, gap: 8, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
          {Object.keys(PERIODS).map(p => (
            <button
              key={p}
              onClick={() => { setPeriod(p); setHover(null); }}
              style={{
                padding: '4px 10px',
                fontSize: 11,
                fontWeight: period === p ? 700 : 400,
                border: `1px solid ${period === p ? color : 'var(--border)'}`,
                borderRadius: 4,
                background: period === p ? `${color}22` : 'transparent',
                color: period === p ? color : 'var(--text-muted)',
                cursor: 'pointer',
                transition: 'all 0.12s',
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              {p}
            </button>
          ))}
        </div>
        <div style={{ fontSize: 15, fontWeight: 700, color, letterSpacing: '-0.3px' }}>
          {isPos ? '+' : ''}{(periodReturn * 100).toFixed(2)}%
          <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--text-muted)', marginLeft: 6 }}>
            {period} return
          </span>
        </div>
      </div>

      {/* SVG */}
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        style={{ width: '100%', height: H, display: 'block', overflow: 'visible', cursor: 'crosshair' }}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor={color} stopOpacity={0.22} />
            <stop offset="100%" stopColor={color} stopOpacity={0.01} />
          </linearGradient>
          <clipPath id="chart-clip">
            <rect x={PAD.left} y={PAD.top} width={CW} height={CH} />
          </clipPath>
        </defs>

        {/* Grid */}
        {yLines.map(({ y }, i) => (
          <line key={i} x1={PAD.left} y1={y} x2={PAD.left + CW} y2={y}
            stroke="var(--border)" strokeWidth={0.5} strokeDasharray="4 4" />
        ))}

        {/* Area fill */}
        <path d={fillPath} fill={`url(#${gradId})`} clipPath="url(#chart-clip)" />

        {/* Line */}
        <path d={linePath} fill="none" stroke={color} strokeWidth={1.8}
          strokeLinejoin="round" strokeLinecap="round" clipPath="url(#chart-clip)" />

        {/* Y-axis labels */}
        {yLines.map(({ v, y }, i) => (
          <text key={i} x={PAD.left - 8} y={y + 4} textAnchor="end" fontSize={10}
            style={{ fill: 'var(--text-muted)', fontFamily: 'inherit' }}>
            {v >= 1000 ? `$${(v / 1000).toFixed(1)}k` : `$${v.toFixed(0)}`}
          </text>
        ))}

        {/* X-axis labels */}
        {xLabels.map((p, i) => (
          <text key={i} x={p.x} y={H - 4} textAnchor="middle" fontSize={10}
            style={{ fill: 'var(--text-muted)', fontFamily: 'inherit' }}>
            {fmtDateLabel(p.date, compact)}
          </text>
        ))}

        {/* Hover crosshair */}
        {hover && (
          <>
            <line x1={hover.x} y1={PAD.top} x2={hover.x} y2={PAD.top + CH}
              stroke={color} strokeWidth={1} strokeDasharray="3 3" opacity={0.6} />
            <circle cx={hover.x} cy={hover.y} r={4}
              fill={color} stroke="var(--bg-panel)" strokeWidth={2} />
            {/* Tooltip box */}
            <g transform={`translate(${tipX},${tipY})`}>
              <rect x={0} y={0} width={96} height={34} rx={5}
                fill="var(--bg-secondary)" stroke="var(--border)" strokeWidth={1} />
              <text x={8} y={14} fontSize={12} fontWeight={700}
                style={{ fill: 'var(--text-primary)', fontFamily: 'inherit' }}>
                ${hover.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </text>
              <text x={8} y={27} fontSize={9}
                style={{ fill: 'var(--text-muted)', fontFamily: 'inherit' }}>
                {fmtTooltipDate(hover.date)}
              </text>
            </g>
          </>
        )}
      </svg>
    </div>
  );
}
