/**
 * POST /api/cron/refresh-prices
 *
 * Called by GitHub Actions (or Vercel Cron) to refresh ETF prices and AUM
 * from Yahoo Finance and persist them to Supabase.
 *
 * Auth: Authorization: Bearer <CRON_SECRET env var>
 * If CRON_SECRET is not set the endpoint is open (dev-only).
 *
 * Vercel's servers can reach Yahoo Finance reliably — unlike GitHub Actions
 * runners whose IPs are sometimes blocked by Yahoo's CDN.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // seconds (Vercel Pro / Hobby limit)

const YAHOO_HEADERS = {
  'User-Agent':      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept':          'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  'Referer':         'https://finance.yahoo.com/',
  'Origin':          'https://finance.yahoo.com',
};

async function fetchYahooQuotes(tickers: string[]): Promise<Record<string, {
  regularMarketPrice?: number;
  regularMarketChangePercent?: number;
  marketCap?: number;
  shortName?: string;
}>> {
  const symbols = tickers.join(',');
  const fields  = 'regularMarketPrice,regularMarketChangePercent,marketCap,shortName';
  for (const host of ['query2', 'query1']) {
    try {
      const res = await fetch(
        `https://${host}.finance.yahoo.com/v7/finance/quote?symbols=${symbols}&fields=${fields}`,
        { headers: YAHOO_HEADERS }
      );
      if (!res.ok) continue;
      const json = await res.json();
      const quotes: { symbol: string; regularMarketPrice?: number; regularMarketChangePercent?: number; marketCap?: number; shortName?: string }[] = json?.quoteResponse?.result ?? [];
      if (quotes.length > 0) return Object.fromEntries(quotes.map(q => [q.symbol, q]));
    } catch { /* try next host */ }
  }
  return {};
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

  // ── Supabase (prefer service key for RLS bypass) ──────────────────────────
  // SUPABASE_URL (no NEXT_PUBLIC_ prefix) is read at runtime on every request.
  // NEXT_PUBLIC_ vars are baked in at build time; if absent during the build
  // they are empty even when set in the Vercel dashboard later.
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  const key  = process.env.SUPABASE_SERVICE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
  if (!url || !key) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 });
  }
  const sb = createClient(url, key);

  // ── Fetch all tickers currently in the DB ─────────────────────────────────
  const { data: rows, error: fetchErr } = await sb
    .from('etfs')
    .select('ticker')
    .limit(1000);

  if (fetchErr || !rows) {
    return NextResponse.json({ error: fetchErr?.message ?? 'DB fetch failed' }, { status: 500 });
  }

  const tickers = rows.map((r: { ticker: string }) => r.ticker);
  if (tickers.length === 0) {
    return NextResponse.json({ updated: 0, message: 'No ETFs in DB — run import-etfs first' });
  }

  // ── Fetch prices in parallel chunks of 20 ────────────────────────────────
  const CHUNK = 20;
  const quoteMap: Record<string, ReturnType<typeof Object.values>[0]> = {};
  const chunks: string[][] = [];
  for (let i = 0; i < tickers.length; i += CHUNK) chunks.push(tickers.slice(i, i + CHUNK));
  const results = await Promise.all(chunks.map(fetchYahooQuotes));
  results.forEach(m => Object.assign(quoteMap, m));

  // ── Build upsert rows ─────────────────────────────────────────────────────
  const today = new Date().toISOString().split('T')[0];
  const etfRows: object[] = [];
  const historyRows: object[] = [];

  for (const ticker of tickers) {
    const q = quoteMap[ticker] as { regularMarketPrice?: number; regularMarketChangePercent?: number; marketCap?: number; shortName?: string } | undefined;
    if (!q) continue;
    const price = q.regularMarketPrice;
    if (!price) continue;
    // NOTE: Do NOT write marketCap as aum — Yahoo Finance's marketCap for ETNs
    // is the issuer's company market cap, not the fund's AUM. AUM is managed
    // separately via the import-etfs script and SEED_ETFS seed data.
    etfRows.push({
      ticker,
      price,
      change_pct: q.regularMarketChangePercent ?? null,
      updated_at: new Date().toISOString(),
    });
  }

  // ── Persist ───────────────────────────────────────────────────────────────
  let etfErr: string | null = null;
  let histErr: string | null = null;

  if (etfRows.length > 0) {
    const { error } = await sb.from('etfs').upsert(etfRows, { onConflict: 'ticker' });
    if (error) etfErr = error.message;
  }

  if (historyRows.length > 0) {
    const { error } = await sb.from('aum_history').upsert(historyRows, {
      onConflict: 'ticker,date',
      ignoreDuplicates: true,
    });
    if (error) histErr = error.message;
  }

  return NextResponse.json({
    tickers:   tickers.length,
    quotes:    Object.keys(quoteMap).length,
    updated:   etfRows.length,
    history:   historyRows.length,
    etfErr,
    histErr,
    timestamp: new Date().toISOString(),
  });
}
