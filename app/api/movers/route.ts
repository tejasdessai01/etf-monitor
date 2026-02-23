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

export async function GET() {
  const tickers = SEED_ETFS.map((e) => e.ticker).join(',');
  const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${tickers}&fields=regularMarketPrice,regularMarketChangePercent,shortName`;

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ETFMonitor/1.0)' },
      next: { revalidate: 300 },
    });

    if (!res.ok) throw new Error('Yahoo Finance unavailable');
    const json = await res.json();
    const quotes = json?.quoteResponse?.result ?? [];

    const movers: Mover[] = quotes
      .filter((q: { regularMarketChangePercent?: number; regularMarketPrice?: number }) =>
        q.regularMarketChangePercent !== undefined && q.regularMarketPrice !== undefined
      )
      .map((q: { symbol: string; regularMarketChangePercent: number; regularMarketPrice: number }) => {
        const seed = SEED_ETFS.find((e) => e.ticker === q.symbol);
        return {
          ticker: q.symbol,
          name: seed?.name ?? q.symbol,
          changePct: q.regularMarketChangePercent,
          price: q.regularMarketPrice,
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
  } catch {
    return NextResponse.json({ data: { gainers: [], losers: [] }, updatedAt: new Date().toISOString() });
  }
}
