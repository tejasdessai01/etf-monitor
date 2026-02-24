import { NextResponse } from 'next/server';
import { SEED_ETFS } from '@/lib/etf-data';

export const revalidate = 300;

// Returns top 5 gainers and top 5 losers among our ETF universe
// by pulling live quotes from Yahoo Finance.

interface Mover {
  ticker: string;
  name: string;
  changePct: number;
  price: number;
  category: string;
}

const YAHOO_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  'Referer': 'https://finance.yahoo.com/',
};

export async function GET() {
  const tickers = SEED_ETFS.map((e) => e.ticker).join(',');
  const fields = 'regularMarketPrice,regularMarketChangePercent,shortName';
  const endpoints = [
    `https://query2.finance.yahoo.com/v7/finance/quote?symbols=${tickers}&fields=${fields}`,
    `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${tickers}&fields=${fields}`,
  ];

  let rawQuotes: unknown[] = [];
  for (const url of endpoints) {
    try {
      const res = await fetch(url, { headers: YAHOO_HEADERS, next: { revalidate: 300 } });
      if (!res.ok) continue;
      const json = await res.json();
      const result = json?.quoteResponse?.result ?? [];
      if (result.length > 0) { rawQuotes = result; break; }
    } catch { /* try next endpoint */ }
  }

  type RawQuote = { symbol: string; regularMarketChangePercent?: number; regularMarketPrice?: number };
  const movers: Mover[] = (rawQuotes as RawQuote[])
    .filter((q) => q.regularMarketChangePercent !== undefined && q.regularMarketPrice !== undefined)
    .map((q) => {
      const seed = SEED_ETFS.find((e) => e.ticker === q.symbol);
      return {
        ticker: q.symbol,
        name: seed?.name ?? q.symbol,
        changePct: q.regularMarketChangePercent!,
        price: q.regularMarketPrice!,
        category: seed?.category ?? 'Unknown',
      };
    });

  movers.sort((a, b) => b.changePct - a.changePct);

  return NextResponse.json({
    data: {
      gainers: movers.slice(0, 5),
      losers: movers.slice(-5).reverse(),
    },
    updatedAt: new Date().toISOString(),
  });
}
