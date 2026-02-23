import { NextResponse } from 'next/server';
import { SEED_ETFS, TICKER_CHUNKS } from '@/lib/etf-data';
import type { ETF } from '@/types';

export const revalidate = 300; // cache 5 minutes

interface YahooQuote {
  symbol: string;
  regularMarketPrice?: number;
  regularMarketChange?: number;
  regularMarketChangePercent?: number;
  regularMarketVolume?: number;
  marketCap?: number;
  shortName?: string;
}

async function fetchYahooQuotes(tickers: string[]): Promise<Record<string, YahooQuote>> {
  const symbols = tickers.join(',');
  const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${symbols}&fields=regularMarketPrice,regularMarketChange,regularMarketChangePercent,regularMarketVolume,marketCap,shortName`;

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; ETFMonitor/1.0)',
        'Accept': 'application/json',
      },
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

export async function GET() {
  // Fetch Yahoo quotes in chunks of 20 to stay within URL limits
  const chunks = TICKER_CHUNKS(20);
  const quoteMaps = await Promise.all(chunks.map(fetchYahooQuotes));
  const quoteMap: Record<string, YahooQuote> = Object.assign({}, ...quoteMaps);

  const enriched: ETF[] = SEED_ETFS.map((etf) => {
    const q = quoteMap[etf.ticker];
    return {
      ...etf,
      price: q?.regularMarketPrice,
      change: q?.regularMarketChange,
      changePct: q?.regularMarketChangePercent,
      volume: q?.regularMarketVolume,
      // For ETFs, marketCap ≈ AUM; use seeded AUM as baseline, Yahoo as override
      aum: q?.marketCap && q.marketCap > 1e8 ? q.marketCap : etf.aum,
    };
  });

  // Sort by AUM descending
  enriched.sort((a, b) => b.aum - a.aum);

  return NextResponse.json({
    data: enriched,
    updatedAt: new Date().toISOString(),
  });
}
