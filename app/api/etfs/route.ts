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

async function fetchYahooQuotes(tickers: string[]): Promise<Record<string, YahooQuote>> {
  const symbols = tickers.join(',');
  const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${symbols}&fields=regularMarketPrice,regularMarketChange,regularMarketChangePercent,regularMarketVolume,marketCap`;
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ETFMonitor/1.0)', 'Accept': 'application/json' },
      next: { revalidate: 300 },
    });
    if (!res.ok) return {};
    const json = await res.json();
    const quotes: YahooQuote[] = json?.quoteResponse?.result ?? [];
    return Object.fromEntries(quotes.map((q) => [q.symbol, q]));
  } catch {
    return {};
  }
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

      // Enrich top 100 with live Yahoo Finance prices
      const topTickers = etfs.slice(0, 100).map((e) => e.ticker);
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
