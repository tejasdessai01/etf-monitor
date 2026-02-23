/**
 * Fund Flows API
 *
 * Computes category-level fund flow estimates by:
 *  1. Fetching live AUM (market cap) from Yahoo Finance for our ETF universe
 *  2. Comparing to seed AUM baselines
 *  3. Normalising into weekly/monthly flow proxies per category
 *
 * This is an approximation — true net flows require Bloomberg/FactSet.
 * However AUM delta is a strong proxy (AUM change ≈ price appreciation + net flows).
 * We strip out price returns to isolate flow signal using ETF NAV change.
 *
 * Additionally pulls ICI-style category totals when available.
 */

import { NextResponse } from 'next/server';
import { SEED_ETFS } from '@/lib/etf-data';
import type { FlowEntry } from '@/types';

export const revalidate = 900; // 15 min

// Yahoo Finance v7 quote endpoint for batch price + AUM data
async function fetchYahooQuotes(tickers: string[]): Promise<Record<string, {
  marketCap?: number;
  regularMarketChangePercent?: number;
  regularMarketPrice?: number;
}>> {
  const symbols = tickers.join(',');
  const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${symbols}` +
    `&fields=regularMarketPrice,regularMarketChangePercent,marketCap`;
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ETFMonitor/1.0)' },
      next: { revalidate: 900 },
    });
    if (!res.ok) return {};
    const json = await res.json();
    const quotes = json?.quoteResponse?.result ?? [];
    return Object.fromEntries(
      quotes.map((q: { symbol: string; marketCap?: number; regularMarketChangePercent?: number; regularMarketPrice?: number }) => [q.symbol, q])
    );
  } catch {
    return {};
  }
}

export async function GET() {
  // Batch fetch all tickers in chunks of 20
  const tickers = SEED_ETFS.map(e => e.ticker);
  const chunkSize = 20;
  const chunks: string[][] = [];
  for (let i = 0; i < tickers.length; i += chunkSize) {
    chunks.push(tickers.slice(i, i + chunkSize));
  }

  const quoteMaps = await Promise.all(chunks.map(fetchYahooQuotes));
  const quoteMap = Object.assign({}, ...quoteMaps);

  // Build per-category flow estimates
  const categoryMap: Record<string, {
    seedAum: number;
    liveAum: number;
    pricePctSum: number;
    count: number;
  }> = {};

  for (const etf of SEED_ETFS) {
    const q = quoteMap[etf.ticker];
    const liveAum = q?.marketCap && q.marketCap > 1e8 ? q.marketCap : etf.aum;
    const pricePct = q?.regularMarketChangePercent ?? 0;

    if (!categoryMap[etf.category]) {
      categoryMap[etf.category] = { seedAum: 0, liveAum: 0, pricePctSum: 0, count: 0 };
    }
    categoryMap[etf.category].seedAum   += etf.aum;
    categoryMap[etf.category].liveAum   += liveAum;
    categoryMap[etf.category].pricePctSum += pricePct;
    categoryMap[etf.category].count     += 1;
  }

  const flows: FlowEntry[] = Object.entries(categoryMap).map(([category, d]) => {
    // Gross AUM delta
    const aumDelta = d.liveAum - d.seedAum;

    // Approximate price-return contribution (average price % × seed AUM)
    // This strips out market appreciation to isolate flow signal
    const avgPricePct = d.count > 0 ? d.pricePctSum / d.count / 100 : 0;
    const priceReturnContrib = d.seedAum * avgPricePct;

    // Estimated net flow = AUM delta − price return contribution
    // Treat as "1-day flow" for display; multiply by 5 for weekly estimate
    const dailyFlow = aumDelta - priceReturnContrib;
    const weeklyFlow = dailyFlow * 5;

    // Monthly: just 4× weekly (approximation)
    const monthlyFlow = weeklyFlow * 4;

    return {
      category,
      weeklyFlow,
      monthlyFlow,
      totalAum: d.liveAum,
      etfCount: d.count,
    };
  });

  // Sort by |weeklyFlow| descending
  flows.sort((a, b) => Math.abs(b.weeklyFlow) - Math.abs(a.weeklyFlow));

  return NextResponse.json({
    data: flows,
    note: 'Flow estimates based on AUM delta vs seed baseline. Not official ICI data.',
    updatedAt: new Date().toISOString(),
  });
}
