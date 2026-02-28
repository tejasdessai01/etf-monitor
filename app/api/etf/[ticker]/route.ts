import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabase';
import { SEED_ETFS } from '@/lib/etf-data';
import { fetchHoldings } from '@/lib/edgar-holdings';

export const revalidate = 900; // 15 min

// ── Stooq daily price history ─────────────────────────────────────────────────
interface DayBar { date: number; price: number; volume: number }

async function fetchStooqDaily(ticker: string): Promise<DayBar[] | null> {
  const today      = new Date();
  const fiveYrsAgo = new Date(today.getFullYear() - 5, today.getMonth(), today.getDate());
  const d1 = fiveYrsAgo.toISOString().split('T')[0].replace(/-/g, '');
  const d2 = today.toISOString().split('T')[0].replace(/-/g, '');
  const url = `https://stooq.com/q/d/l/?s=${ticker.toLowerCase()}.us&d1=${d1}&d2=${d2}&i=d`;

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      next: { revalidate: 900 },
    });
    if (!res.ok) return null;
    const text = await res.text();
    const lines = text.trim().split('\n');
    if (lines.length < 3) return null;
    // CSV: Date,Open,High,Low,Close,Volume
    return lines
      .slice(1)
      .map((line) => {
        const c = line.split(',');
        return { date: new Date(c[0]).getTime(), price: parseFloat(c[4]), volume: parseInt(c[5], 10) || 0 };
      })
      .filter((p) => !isNaN(p.price) && !isNaN(p.date));
  } catch {
    return null;
  }
}

// ── Performance from daily price history ──────────────────────────────────────
function computePerformance(history: DayBar[]) {
  if (history.length < 2) return {};

  const latest = history[history.length - 1].price;

  function priceAt(daysAgo: number): number | null {
    const target = Date.now() - daysAgo * 86_400_000;
    let best: DayBar | null = null, bestDiff = Infinity;
    for (const p of history) {
      const d = Math.abs(p.date - target);
      if (d < bestDiff) { bestDiff = d; best = p; }
    }
    return best && bestDiff < 7 * 86_400_000 ? best.price : null;
  }

  const thisYear = new Date().getFullYear();
  const decPrev  = history.filter((p) => new Date(p.date).getFullYear() === thisYear - 1).at(-1)?.price ?? null;
  let ytdStart: number | null = decPrev;
  if (!ytdStart) {
    const jan1 = new Date(thisYear, 0, 1).getTime();
    let best: DayBar | null = null, bestDiff = Infinity;
    for (const p of history) {
      const d = Math.abs(p.date - jan1);
      if (d < bestDiff) { bestDiff = d; best = p; }
    }
    ytdStart = best?.price ?? null;
  }

  const ret = (daysAgo: number, years?: number) => {
    const past = priceAt(daysAgo);
    if (!past || past === 0) return null;
    const r = (latest - past) / past;
    return years ? Math.pow(1 + r, 1 / years) - 1 : r;
  };

  return {
    '1M':  ret(30),
    '3M':  ret(91),
    '6M':  ret(182),
    'YTD': ytdStart ? (latest - ytdStart) / ytdStart : null,
    '1Y':  ret(365),
    '3Y':  ret(1095, 3),
    '5Y':  ret(1825, 5),
  };
}

// ── Route handler ─────────────────────────────────────────────────────────────
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ ticker: string }> },
) {
  const { ticker } = await params;
  const sym = ticker.toUpperCase();

  // Run Stooq + EDGAR concurrently
  const [stooqResult, holdingsResult] = await Promise.allSettled([
    fetchStooqDaily(sym),
    fetchHoldings(sym),
  ]);

  const history: DayBar[] = stooqResult.status === 'fulfilled' ? (stooqResult.value ?? []) : [];

  if (history.length === 0) {
    return NextResponse.json(
      { error: `No price data found for ${sym} — ticker may not be listed on a US exchange` },
      { status: 404 },
    );
  }

  // ── Price stats from Stooq daily ──────────────────────────────────────────
  const latest      = history[history.length - 1];
  const prev        = history[history.length - 2] ?? null;
  const price       = latest.price;
  const change      = prev ? price - prev.price : null;
  const changePct   = prev && prev.price !== 0 ? change! / prev.price : null;

  const oneYearAgo  = Date.now() - 365 * 86_400_000;
  const last52w     = history.filter((p) => p.date >= oneYearAgo);
  const week52High  = last52w.length ? Math.max(...last52w.map((p) => p.price)) : null;
  const week52Low   = last52w.length ? Math.min(...last52w.map((p) => p.price)) : null;
  const volume      = latest.volume || null;
  const recentVols  = history.slice(-30).map((p) => p.volume).filter(Boolean);
  const avgVolume   = recentVols.length
    ? Math.round(recentVols.reduce((s, v) => s + v, 0) / recentVols.length)
    : null;

  const performance  = computePerformance(history);
  const priceHistory = history.map((p) => ({ date: p.date, price: p.price }));

  // ── Metadata: Supabase first, then SEED_ETFS ──────────────────────────────
  let dbRow: Record<string, unknown> | null = null;
  const sb = await getSupabaseClient();
  if (sb) {
    const { data } = await sb.from('etfs').select('*').eq('ticker', sym).single();
    if (data) dbRow = data as Record<string, unknown>;
  }

  const seed = SEED_ETFS.find((e) => e.ticker === sym);

  const name          = (dbRow?.name           as string) ?? seed?.name          ?? sym;
  const aum           = (dbRow?.aum            as number) ?? seed?.aum           ?? null;
  const expenseRatio  = (dbRow?.expense_ratio  as number) ?? seed?.expenseRatio  ?? null;
  const category      = (dbRow?.category       as string) ?? seed?.category      ?? null;
  const family        = (dbRow?.issuer         as string) ?? seed?.issuer        ?? null;
  const inceptionDate = (dbRow?.inception_date as string) ?? seed?.inceptionDate ?? null;

  // ── EDGAR holdings ────────────────────────────────────────────────────────
  const edgarResult = holdingsResult.status === 'fulfilled' ? holdingsResult.value : null;
  const holdings = (edgarResult?.holdings ?? []).map((h) => ({
    ticker: h.ticker ?? '',
    name:   h.name,
    weight: h.weight,
  }));

  return NextResponse.json({
    ticker:        sym,
    name,
    price,
    change,
    changePct,
    aum,
    nav:           price,        // Stooq close ≈ NAV for ETFs
    expenseRatio,
    dividendYield: null,         // not available from Stooq
    beta:          null,
    inceptionDate,
    description:   null,
    category,
    family,
    week52High,
    week52Low,
    volume,
    avgVolume,
    holdings,
    holdingsDate:   edgarResult?.asOfDate ?? null,
    holdingsSource: edgarResult?.source ?? 'unavailable',
    sectors:        [],          // not available without Yahoo Finance quoteSummary
    performance,
    priceHistory,
  });
}
