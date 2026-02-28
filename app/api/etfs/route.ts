import { NextResponse } from 'next/server';
import { SEED_ETFS, TICKER_CHUNKS } from '@/lib/etf-data';
import { getSupabaseClient } from '@/lib/supabase';
import type { ETF } from '@/types';

export const revalidate = 300;

interface YahooQuote {
  symbol: string;
  regularMarketPrice?: number;
  regularMarketChange?: number;
  regularMarketChangePercent?: number;
  regularMarketVolume?: number;
  marketCap?: number;
}

const YAHOO_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  'Referer': 'https://finance.yahoo.com/',
  'Origin': 'https://finance.yahoo.com',
};

async function fetchYahooQuotes(tickers: string[]): Promise<Record<string, YahooQuote>> {
  const symbols = tickers.join(',');
  const fields = 'regularMarketPrice,regularMarketChange,regularMarketChangePercent,regularMarketVolume,marketCap';
  // Try query2 first (less aggressively rate-limited from cloud IPs), fall back to query1
  const endpoints = [
    `https://query2.finance.yahoo.com/v7/finance/quote?symbols=${symbols}&fields=${fields}`,
    `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${symbols}&fields=${fields}`,
  ];
  for (const url of endpoints) {
    try {
      const res = await fetch(url, {
        headers: YAHOO_HEADERS,
        next: { revalidate: 300 },
      });
      if (!res.ok) continue;
      const json = await res.json();
      const quotes: YahooQuote[] = json?.quoteResponse?.result ?? [];
      if (quotes.length > 0) return Object.fromEntries(quotes.map((q) => [q.symbol, q]));
    } catch {
      // try next endpoint
    }
  }
  return {};
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limitParam = parseInt(searchParams.get('limit') ?? '500', 10);

  // ── Try Supabase first ───────────────────────────────────────────────────
  const sb = await getSupabaseClient();

  if (sb) {
    const { data, error, count } = await sb
      .from('etfs')
      .select('*', { count: 'exact' })
      .order('aum', { ascending: false, nullsFirst: false })
      .limit(limitParam);

    if (!error && data && data.length > 0) {
      const etfs: ETF[] = data.map((row) => ({
        ticker:        row.ticker,
        name:          row.name,
        issuer:        row.issuer ?? '',
        category:      row.category ?? 'Unknown',
        subCategory:   row.sub_category ?? undefined,
        aum:           row.aum ?? 0,
        expenseRatio:  row.expense_ratio ?? 0,
        inceptionDate: row.inception_date ?? '',
        exchange:      row.exchange ?? '',
        price:         row.price ?? undefined,
        changePct:     row.change_pct ?? undefined,
      }));

      // Always enrich the known top ETFs by ticker, not by DB position.
      // If their DB AUM is stale/null they'd be buried in the sorted array and
      // never reach the top-100 slice, so we pin them at the front of the enrich list.
      const PRIORITY = [
        'SPY','IVV','VOO','VTI','QQQ','BND','AGG','IEFA','VEA','VWO',
        'GLD','IBIT','TLT','IWM','SCHD','XLK','VUG','VTV','VCIT','EFA',
      ];
      const dbTop     = etfs.slice(0, 80).map((e) => e.ticker);
      const topTickers = [...new Set([...PRIORITY, ...dbTop])].slice(0, 100);

      const liveChunks: string[][] = [];
      for (let i = 0; i < topTickers.length; i += 20) liveChunks.push(topTickers.slice(i, i + 20));
      const quoteMaps = await Promise.all(liveChunks.map(fetchYahooQuotes));
      const quoteMap: Record<string, YahooQuote> = Object.assign({}, ...quoteMaps);

      for (const etf of etfs) {
        const q = quoteMap[etf.ticker];
        if (!q) continue;
        etf.price     = q.regularMarketPrice ?? etf.price;
        etf.change    = q.regularMarketChange;
        etf.changePct = q.regularMarketChangePercent ?? etf.changePct;
        etf.volume    = q.regularMarketVolume;
        if (q.marketCap && q.marketCap > 1e8) etf.aum = q.marketCap;
      }

      // Re-sort after live AUM updates so the response order is correct
      // (client also sorts, but this makes SSR / initial renders right too).
      etfs.sort((a, b) => b.aum - a.aum);

      return NextResponse.json({
        data: etfs,
        total: count ?? etfs.length,
        source: 'supabase',
        updatedAt: new Date().toISOString(),
      });
    }
  }

  // ── Fallback: seed data + Yahoo Finance ─────────────────────────────────
  const chunks = TICKER_CHUNKS(20);
  const quoteMaps = await Promise.all(chunks.map(fetchYahooQuotes));
  const quoteMap: Record<string, YahooQuote> = Object.assign({}, ...quoteMaps);

  const enriched: ETF[] = SEED_ETFS.map((etf) => {
    const q = quoteMap[etf.ticker];
    return {
      ...etf,
      price:     q?.regularMarketPrice,
      change:    q?.regularMarketChange,
      changePct: q?.regularMarketChangePercent,
      volume:    q?.regularMarketVolume,
      aum:       q?.marketCap && q.marketCap > 1e8 ? q.marketCap : etf.aum,
    };
  });

  enriched.sort((a, b) => b.aum - a.aum);

  return NextResponse.json({
    data: enriched,
    total: enriched.length,
    source: 'seed',
    updatedAt: new Date().toISOString(),
  });
}
