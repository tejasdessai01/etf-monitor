/** Format AUM as $537.2B, $1.4T, $450M etc. */
export function fmtAum(n: number): string {
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9)  return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6)  return `$${(n / 1e6).toFixed(0)}M`;
  return `$${n.toLocaleString()}`;
}

/** Format price */
export function fmtPrice(n?: number): string {
  if (n === undefined || n === null) return '—';
  return `$${n.toFixed(2)}`;
}

/** Format percentage change */
export function fmtPct(n?: number): string {
  if (n === undefined || n === null) return '—';
  const sign = n >= 0 ? '+' : '';
  return `${sign}${n.toFixed(2)}%`;
}

/** Format expense ratio as basis points */
export function fmtBps(n: number): string {
  return `${(n * 100).toFixed(0)} bps`;
}

/** Format expense ratio as percentage */
export function fmtExpRatio(n: number): string {
  return `${n.toFixed(2)}%`;
}

/** Format date as "Feb 20, 2025" */
export function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
    });
  } catch {
    return iso;
  }
}

/** Format date as relative "2h ago", "3d ago" */
export function fmtRelative(iso: string): string {
  try {
    const diff = Date.now() - new Date(iso).getTime();
    const m = diff / 60000;
    if (m < 60)  return `${Math.round(m)}m ago`;
    const h = m / 60;
    if (h < 24)  return `${Math.round(h)}h ago`;
    const d = h / 24;
    if (d < 7)   return `${Math.round(d)}d ago`;
    return fmtDate(iso);
  } catch {
    return '—';
  }
}

/** Format volume as 1.2M shares */
export function fmtVol(n?: number): string {
  if (!n) return '—';
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(0)}K`;
  return String(n);
}

/** Class name helper for positive/negative/neutral */
export function chgClass(n?: number): string {
  if (n === undefined || n === null) return 'neutral';
  return n >= 0 ? 'positive' : 'negative';
}

/** Arrow helper */
export function chgArrow(n?: number): string {
  if (n === undefined || n === null) return '';
  return n >= 0 ? '▲' : '▼';
}
