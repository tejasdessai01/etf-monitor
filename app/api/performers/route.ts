/**
 * GET /api/performers?period=ytd&category=All&limit=100
 *
 * Returns top ETFs ranked by the requested performance period.
 * Reads from Supabase etfs table (columns populated by the
 * /api/cron/refresh-performance cron job).
 *
 * Falls back to Stooq for a curated 28-ETF list if the DB has no
 * performance data yet (e.g., before first cron run).
 *
 * Query params:
 *   period   — ytd | oneYear | twoYear | threeYear  (default: ytd)
 *   category — All | US Equity | Fixed Income | International | Sector | Thematic
 *   limit    — max rows to return (default 100, max 500)
 */

import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabase';
import { SEED_ETFS } from '@/lib/etf-data';

// ── Stooq fallback universe (used when DB has no performance data) ────────────
const FALLBACK_UNIVERSE: { ticker: string; category: string }[] = [
  { ticker: 'SPY',  category: 'US Equity' },
  { ticker: 'VOO',  category: 'US Equity' },
  { ticker: 'QQQ',  category: 'US Equity' },
  { ticker: 'VTI',  category: 'US Equity' },
  { ticker: 'IWM',  category: 'US Equity' },
  { ticker: 'VUG',  category: 'US Equity' },
  { ticker: 'VTV',  category: 'US Equity' },
  { ticker: 'SCHD', category: 'US Equity' },
  { ticker: 'RSP',  category: 'US Equity' },
  { ticker: 'BND',  category: 'Fixed Income' },
  { ticker: 'AGG',  category: 'Fixed Income' },
  { ticker: 'TLT',  category: 'Fixed Income' },
  { ticker: 'HYG',  category: 'Fixed Income' },
  { ticker: 'SGOV', category: 'Fixed Income' },
  { ticker: 'IEFA', category: 'International' },
  { ticker: 'VEA',  category: 'International' },
  { ticker: 'VWO',  category: 'International' },
  { ticker: 'EEM',  category: 'International' },
  { ticker: 'XLK',  category: 'Sector' },
  { ticker: 'XLF',  category: 'Sector' },
  { ticker: 'XLE',  category: 'Sector' },
  { ticker: 'XLV',  category: 'Sector' },
  { ticker: 'VGT',  category: 'Sector' },
  { ticker: 'SOXX', category: 'Sector' },
  { ticker: 'GLD',  category: 'Thematic' },
  { ticker: 'IBIT', category: 'Thematic' },
  { ticker: 'ARKK', category: 'Thematic' },
  { ticker: 'TQQQ', category: 'Thematic' },
];

const SEED_NAMES: Record<string, string> = Object.fromEntries(
  SEED_ETFS.map((e) => [e.ticker, e.name])
);

const PERIOD_COLS: Record<string, string> = {
  ytd:       'ytd_return',
  oneYear:   'one_year_return',
  twoYear:   'two_year_return',
  threeYear: 'three_year_return',
};

export interface PerformerEntry {
  ticker: string;
  name: string;
  category: string;
  ytd: number | null;
  oneYear: number | null;
  twoYear: number | null;
  threeYear: number | null;
}

// ── Stooq fallback helpers ────────────────────────────────────────────────────

async function fetchStooq(ticker: string): Promise<{ date: number; price: number }[] | null> {
  const url = `https://stooq.com/q/d/l/?s=${ticker.toLowerCase()}.us&i=m`;
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    const text = await res.text();
    const lines = text.trim().split('\n');
    if (lines.length < 3) return null;
    return lines
      .slice(1)
      .map((line) => {
        const cols = line.split(',');
        return { date: new Date(cols[0]).getTime(), price: parseFloat(cols[4]) };
      })
      .filter((p) => !isNaN(p.price) && !isNaN(p.date));
  } catch {
    return null;
  }
}

function computePerf(history: { date: number; price: number }[]) {
  if (history.length < 3) return { ytd: null, oneYear: null, twoYear: null, threeYear: null };
  const latest   = history[history.length - 1].price;
  const thisYear = new Date().getFullYear();
  const decPrev  = history.filter((p) => new Date(p.date).getFullYear() === thisYear - 1).at(-1)?.price ?? null;

  function priceAt(daysAgo: number): number | null {
    const target = Date.now() - daysAgo * 86_400_000;
    let best: { date: number; price: number } | null = null, bestDiff = Infinity;
    for (const p of history) {
      const d = Math.abs(p.date - target);
      if (d < bestDiff) { bestDiff = d; best = p; }
    }
    return best && bestDiff < 46 * 86_400_000 ? best.price : null;
  }

  const ret = (daysAgo: number, years?: number) => {
    const past = priceAt(daysAgo);
    if (!past || past === 0) return null;
    const r = (latest - past) / past;
    return years ? Math.pow(1 + r, 1 / years) - 1 : r;
  };

  return {
    ytd:       decPrev ? (latest - decPrev) / decPrev : null,
    oneYear:   ret(365),
    twoYear:   ret(730, 2),
    threeYear: ret(1095, 3),
  };
}

async function stooqFallback(
  period: string,
  category: string,
  limit: number,
): Promise<PerformerEntry[]> {
  const universe = category === 'All'
    ? FALLBACK_UNIVERSE
    : FALLBACK_UNIVERSE.filter((e) => e.category === category);

  const BATCH = 4, DELAY = 250;
  const histories: ({ date: number; price: number }[] | null)[] = [];

  for (let i = 0; i < universe.length; i += BATCH) {
    const batch = universe.slice(i, i + BATCH);
    const results = await Promise.allSettled(batch.map(({ ticker }) => fetchStooq(ticker)));
    for (const r of results) histories.push(r.status === 'fulfilled' ? r.value : null);
    if (i + BATCH < universe.length) await new Promise((res) => setTimeout(res, DELAY));
  }

  const entries: PerformerEntry[] = [];
  for (let i = 0; i < universe.length; i++) {
    if (!histories[i]) continue;
    entries.push({
      ticker:   universe[i].ticker,
      name:     SEED_NAMES[universe[i].ticker] ?? universe[i].ticker,
      category: universe[i].category,
      ...computePerf(histories[i]!),
    });
  }

  const periodKey = period as keyof PerformerEntry;
  return entries
    .filter((e) => e[periodKey] != null)
    .sort((a, b) => (b[periodKey] as number) - (a[periodKey] as number))
    .slice(0, limit);
}

// ── Main handler ──────────────────────────────────────────────────────────────

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const period   = searchParams.get('period')   ?? 'ytd';
  const category = searchParams.get('category') ?? 'All';
  const limit    = Math.min(parseInt(searchParams.get('limit') ?? '100', 10), 500);

  const col = PERIOD_COLS[period] ?? 'ytd_return';

  // ── Try Supabase first ────────────────────────────────────────────────────
  const sb = await getSupabaseClient();
  if (sb) {
    let query = sb
      .from('etfs')
      .select('ticker, name, category, ytd_return, one_year_return, two_year_return, three_year_return')
      .not(col, 'is', null);

    if (category !== 'All') {
      query = query.eq('category', category);
    }

    const { data } = await query
      .order(col, { ascending: false })
      .limit(limit);

    if (data && data.length > 0) {
      const entries: PerformerEntry[] = data.map((r) => ({
        ticker:    r.ticker,
        name:      r.name,
        category:  r.category ?? 'Unknown',
        ytd:       r.ytd_return        ?? null,
        oneYear:   r.one_year_return   ?? null,
        twoYear:   r.two_year_return   ?? null,
        threeYear: r.three_year_return ?? null,
      }));
      return NextResponse.json(
        { data: entries, source: 'supabase', updatedAt: new Date().toISOString() },
        { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60' } },
      );
    }
  }

  // ── Fallback: Stooq for 28 curated ETFs ──────────────────────────────────
  const entries = await stooqFallback(period, category, limit);
  return NextResponse.json(
    { data: entries, source: 'stooq-fallback', updatedAt: new Date().toISOString() },
    { headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=300' } },
  );
}
