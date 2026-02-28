/**
 * POST /api/cron/refresh-performance?offset=0&limit=200
 *
 * Fetches monthly price history from Stooq for ETFs in the Supabase DB and
 * writes computed YTD / 1Y / 2Y / 3Y returns back to the etfs table.
 *
 * Run in offset chunks so each call fits within the 60s Vercel timeout:
 *   offset=0,200,400,... until `processed` comes back 0.
 *
 * Auth: Authorization: Bearer <CRON_SECRET env var>
 *   If CRON_SECRET is not set the endpoint is open (dev-only).
 *
 * Schema prerequisite — run once in Supabase SQL editor:
 *   ALTER TABLE etfs ADD COLUMN IF NOT EXISTS ytd_return        NUMERIC(10,6);
 *   ALTER TABLE etfs ADD COLUMN IF NOT EXISTS one_year_return   NUMERIC(10,6);
 *   ALTER TABLE etfs ADD COLUMN IF NOT EXISTS two_year_return   NUMERIC(10,6);
 *   ALTER TABLE etfs ADD COLUMN IF NOT EXISTS three_year_return NUMERIC(10,6);
 *   ALTER TABLE etfs ADD COLUMN IF NOT EXISTS perf_updated_at   TIMESTAMPTZ;
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic     = 'force-dynamic';
export const maxDuration = 60;

async function fetchStooq(ticker: string): Promise<{ date: number; price: number }[] | null> {
  const url = `https://stooq.com/q/d/l/?s=${ticker.toLowerCase()}.us&i=m`;
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      // no Next.js cache here — this is a cron, we always want fresh data
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const text = await res.text();
    const lines = text.trim().split('\n');
    if (lines.length < 3) return null; // header + at least 2 data rows
    return lines
      .slice(1)
      .map((line) => {
        const cols = line.split(',');
        const date = new Date(cols[0]).getTime();
        const price = parseFloat(cols[4]); // Close
        return { date, price };
      })
      .filter((p) => !isNaN(p.price) && !isNaN(p.date));
  } catch {
    return null;
  }
}

function computePerf(history: { date: number; price: number }[]) {
  if (history.length < 3) return null;

  const latest = history[history.length - 1].price;
  const thisYear = new Date().getFullYear();

  // YTD: Dec close of the prior year
  const decPrev = history.filter((p) => new Date(p.date).getFullYear() === thisYear - 1).at(-1)?.price ?? null;

  // Price closest to N days ago, within a 46-day window (monthly data tolerance)
  function priceAt(daysAgo: number): number | null {
    const target = Date.now() - daysAgo * 86_400_000;
    let best: { date: number; price: number } | null = null;
    let bestDiff = Infinity;
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
    ytd_return:        decPrev ? (latest - decPrev) / decPrev : null,
    one_year_return:   ret(365),
    two_year_return:   ret(730, 2),
    three_year_return: ret(1095, 3),
    perf_updated_at:   new Date().toISOString(),
  };
}

export async function POST(req: Request) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get('Authorization') ?? '';
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  // ── Params ────────────────────────────────────────────────────────────────
  const { searchParams } = new URL(req.url);
  const offset = parseInt(searchParams.get('offset') ?? '0', 10);
  const limit  = Math.min(parseInt(searchParams.get('limit')  ?? '200', 10), 200);

  // ── Supabase ──────────────────────────────────────────────────────────────
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  const key = process.env.SUPABASE_SERVICE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
  if (!url || !key) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 });
  }
  const sb = createClient(url, key);

  // ── Fetch tickers for this page ───────────────────────────────────────────
  const { data: rows, error } = await sb
    .from('etfs')
    .select('ticker')
    .order('ticker')
    .range(offset, offset + limit - 1);

  if (error || !rows) {
    return NextResponse.json({ error: error?.message ?? 'DB read failed' }, { status: 500 });
  }

  const tickers = rows.map((r: { ticker: string }) => r.ticker);
  if (tickers.length === 0) {
    return NextResponse.json({ offset, processed: 0, updated: 0, hasMore: false });
  }

  // ── Fetch Stooq in batches of 4 with a 250ms pause between batches ────────
  const BATCH = 4;
  const DELAY = 250;
  const histories: ({ date: number; price: number }[] | null)[] = [];

  for (let i = 0; i < tickers.length; i += BATCH) {
    const batch = tickers.slice(i, i + BATCH);
    const results = await Promise.allSettled(batch.map(fetchStooq));
    for (const r of results) {
      histories.push(r.status === 'fulfilled' ? r.value : null);
    }
    if (i + BATCH < tickers.length) {
      await new Promise((res) => setTimeout(res, DELAY));
    }
  }

  // ── Compute returns and build upsert rows ─────────────────────────────────
  const upsertRows: object[] = [];
  for (let i = 0; i < tickers.length; i++) {
    const history = histories[i];
    if (!history) continue;
    const perf = computePerf(history);
    if (!perf) continue;
    upsertRows.push({ ticker: tickers[i], ...perf });
  }

  // ── Upsert ────────────────────────────────────────────────────────────────
  let dbError: string | null = null;
  if (upsertRows.length > 0) {
    const { error: uErr } = await sb
      .from('etfs')
      .upsert(upsertRows, { onConflict: 'ticker' });
    if (uErr) dbError = uErr.message;
  }

  return NextResponse.json({
    offset,
    processed: tickers.length,
    updated:   upsertRows.length,
    hasMore:   tickers.length === limit,
    dbError,
    timestamp: new Date().toISOString(),
  });
}
