import { NextResponse } from 'next/server';
import { SEED_ETFS } from '@/lib/etf-data';

export const revalidate = 3600; // 1 hour

// Curated ETFs per category
const UNIVERSE: { ticker: string; category: string }[] = [
  // US Equity
  { ticker: 'SPY',  category: 'US Equity' },
  { ticker: 'VOO',  category: 'US Equity' },
  { ticker: 'QQQ',  category: 'US Equity' },
  { ticker: 'VTI',  category: 'US Equity' },
  { ticker: 'IWM',  category: 'US Equity' },
  { ticker: 'VUG',  category: 'US Equity' },
  { ticker: 'VTV',  category: 'US Equity' },
  { ticker: 'SCHD', category: 'US Equity' },
  { ticker: 'RSP',  category: 'US Equity' },
  // Fixed Income
  { ticker: 'BND',  category: 'Fixed Income' },
  { ticker: 'AGG',  category: 'Fixed Income' },
  { ticker: 'TLT',  category: 'Fixed Income' },
  { ticker: 'HYG',  category: 'Fixed Income' },
  { ticker: 'SGOV', category: 'Fixed Income' },
  // International
  { ticker: 'IEFA', category: 'International' },
  { ticker: 'VEA',  category: 'International' },
  { ticker: 'VWO',  category: 'International' },
  { ticker: 'EEM',  category: 'International' },
  // Sector
  { ticker: 'XLK',  category: 'Sector' },
  { ticker: 'XLF',  category: 'Sector' },
  { ticker: 'XLE',  category: 'Sector' },
  { ticker: 'XLV',  category: 'Sector' },
  { ticker: 'VGT',  category: 'Sector' },
  { ticker: 'SOXX', category: 'Sector' },
  // Thematic
  { ticker: 'GLD',  category: 'Thematic' },
  { ticker: 'IBIT', category: 'Thematic' },
  { ticker: 'ARKK', category: 'Thematic' },
  { ticker: 'TQQQ', category: 'Thematic' },
];

// Build a name lookup from the existing seed ETF list
const SEED_NAMES: Record<string, string> = Object.fromEntries(
  SEED_ETFS.map((e) => [e.ticker, e.name])
);

// Fetch monthly price history from Stooq (free, no API key, server-friendly)
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
    if (lines.length < 2) return null;
    // CSV header: Date,Open,High,Low,Close,Volume
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
  if (history.length < 3) return { ytd: null, oneYear: null, twoYear: null, threeYear: null };

  const latest = history[history.length - 1].price;

  // For monthly data, allow up to 46 days of tolerance (~1.5 months)
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

  // YTD: use the Dec close of the previous year (last data point of prior year)
  const thisYear = new Date().getFullYear();
  const decPrev = history
    .filter((p) => new Date(p.date).getFullYear() === thisYear - 1)
    .at(-1)?.price ?? null;

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

export interface PerformerEntry {
  ticker: string;
  name: string;
  category: string;
  ytd: number | null;
  oneYear: number | null;
  twoYear: number | null;
  threeYear: number | null;
}

export async function GET() {
  const results = await Promise.allSettled(
    UNIVERSE.map(({ ticker }) => fetchStooq(ticker))
  );

  const data: PerformerEntry[] = [];

  for (let i = 0; i < UNIVERSE.length; i++) {
    const { ticker, category } = UNIVERSE[i];
    const result = results[i];
    if (result.status !== 'fulfilled' || !result.value) continue;

    const history = result.value;
    const perf = computePerf(history);

    data.push({
      ticker,
      name: SEED_NAMES[ticker] ?? ticker,
      category,
      ...perf,
    });
  }

  return NextResponse.json({ data, updatedAt: new Date().toISOString() });
}
