import { NextResponse } from 'next/server';

export const revalidate = 3600; // 1 hour — performance data changes slowly

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

// Curated ETFs per category — enough to show meaningful rankings
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

async function fetchChart(ticker: string) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?range=5y&interval=1mo&includePrePost=false`;
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': UA,
        'Accept': '*/*',
        'Referer': 'https://finance.yahoo.com/',
      },
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

function computePerf(history: { date: number; price: number }[]) {
  if (history.length < 3) return { ytd: null, oneYear: null, twoYear: null, threeYear: null };

  const latest = history[history.length - 1].price;

  // For monthly data, allow up to 46 days of tolerance
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

  // YTD: Jan 1 of current year
  const jan1 = new Date(new Date().getFullYear(), 0, 1).getTime();
  let ytdStart: number | null = null;
  let bestDiff = Infinity;
  for (const p of history) {
    const d = Math.abs(p.date - jan1);
    if (d < bestDiff) { bestDiff = d; ytdStart = p.price; }
  }

  const ret = (daysAgo: number, years?: number) => {
    const past = priceAt(daysAgo);
    if (!past || past === 0) return null;
    const r = (latest - past) / past;
    return years ? Math.pow(1 + r, 1 / years) - 1 : r;
  };

  return {
    ytd:       ytdStart ? (latest - ytdStart) / ytdStart : null,
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
    UNIVERSE.map(({ ticker }) => fetchChart(ticker))
  );

  const data: PerformerEntry[] = [];

  for (let i = 0; i < UNIVERSE.length; i++) {
    const { ticker, category } = UNIVERSE[i];
    const result = results[i];
    if (result.status !== 'fulfilled' || !result.value) continue;

    const cr = result.value?.chart?.result?.[0];
    if (!cr) continue;

    const ts: number[]               = cr.timestamp ?? [];
    const closes: (number | null)[]  = cr.indicators?.quote?.[0]?.close ?? [];
    const meta                       = cr.meta ?? {};

    const history = ts
      .map((t: number, idx: number) => ({ date: t * 1000, price: closes[idx] as number }))
      .filter((p: { date: number; price: number }) => p.price != null && !isNaN(p.price));

    data.push({
      ticker,
      name:     meta.shortName ?? meta.longName ?? ticker,
      category,
      ...computePerf(history),
    });
  }

  return NextResponse.json({ data, updatedAt: new Date().toISOString() });
}
