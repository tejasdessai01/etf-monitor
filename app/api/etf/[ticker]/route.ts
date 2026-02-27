import { NextResponse } from 'next/server';
import { fetchHoldings } from '@/lib/edgar-holdings';

export const revalidate = 900; // 15 min

// ── Sector label mapping ──────────────────────────────────────────────────────
const SECTOR_LABELS: Record<string, string> = {
  realestate:             'Real Estate',
  consumer_cyclical:      'Consumer Cyclical',
  basic_materials:        'Basic Materials',
  technology:             'Technology',
  communication_services: 'Communication Services',
  financial_services:     'Financial Services',
  consumer_defensive:     'Consumer Defensive',
  healthcare:             'Healthcare',
  industrials:            'Industrials',
  energy:                 'Energy',
  utilities:              'Utilities',
};

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

// Simple fetch — no crumb required. Used for v7/quote and v8/chart.
async function yfOpen(url: string) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': UA,
      'Accept': '*/*',
      'Accept-Language': 'en-US,en;q=0.9',
      'Referer': 'https://finance.yahoo.com/',
    },
    next: { revalidate: 900 },
  });
  if (!res.ok) throw new Error(`YF ${res.status} — ${url}`);
  return res.json();
}

// ── Performance computation from chart data ───────────────────────────────────
function computePerformance(history: { date: number; price: number }[]) {
  if (history.length < 2) return {};

  const latest = history[history.length - 1].price;

  function priceAt(daysAgo: number): number | null {
    const target = Date.now() - daysAgo * 86_400_000;
    let best: { date: number; price: number } | null = null;
    let bestDiff = Infinity;
    for (const p of history) {
      const d = Math.abs(p.date - target);
      if (d < bestDiff) { bestDiff = d; best = p; }
    }
    // Don't use a price more than 14 days off from the target
    return best && bestDiff < 14 * 86_400_000 ? best.price : null;
  }

  function ret(daysAgo: number, annualizeYears?: number): number | null {
    const past = priceAt(daysAgo);
    if (!past || past === 0) return null;
    const r = (latest - past) / past;
    return annualizeYears ? Math.pow(1 + r, 1 / annualizeYears) - 1 : r;
  }

  // YTD: Jan 1 of current year
  const jan1 = new Date(new Date().getFullYear(), 0, 1).getTime();
  const ytdStartPrice = (() => {
    let best: { date: number; price: number } | null = null;
    let bestDiff = Infinity;
    for (const p of history) {
      const d = Math.abs(p.date - jan1);
      if (d < bestDiff) { bestDiff = d; best = p; }
    }
    return best?.price ?? null;
  })();

  return {
    '1M':  ret(30),
    '3M':  ret(91),
    '6M':  ret(182),
    '1Y':  ret(365),
    '3Y':  ret(1095, 3),
    '5Y':  ret(1825, 5),
    'YTD': ytdStartPrice ? (latest - ytdStartPrice) / ytdStartPrice : null,
  };
}

// ── Route handler ─────────────────────────────────────────────────────────────
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ ticker: string }> },
) {
  const { ticker } = await params;
  const sym = ticker.toUpperCase();

  // Fire all requests concurrently; each fails independently
  const [quoteResult, chartResult, holdingsResult, sectorsResult] = await Promise.allSettled([
    // v7/quote — no crumb needed, gives price + basic stats + AUM + expense ratio
    yfOpen(`https://query1.finance.yahoo.com/v7/finance/quote?symbols=${sym}`),

    // v8/chart — no crumb needed, 5Y weekly price history
    yfOpen(`https://query1.finance.yahoo.com/v8/finance/chart/${sym}?range=5y&interval=1wk&includePrePost=false`),

    // SEC EDGAR NPORT-P — holdings, no rate limits
    fetchHoldings(sym),

    // quoteSummary topHoldings — sector weights only; best-effort, may 429
    yfOpen(`https://query2.finance.yahoo.com/v10/finance/quoteSummary/${sym}?modules=topHoldings`),
  ]);

  // Require at least one of quote or chart to succeed
  if (quoteResult.status === 'rejected' && chartResult.status === 'rejected') {
    return NextResponse.json(
      { error: `Could not load data for ${sym} — ${quoteResult.reason?.message}` },
      { status: 502 },
    );
  }

  // ── Quote data ────────────────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const q: any =
    quoteResult.status === 'fulfilled'
      ? (quoteResult.value as { quoteResponse: { result: unknown[] } })?.quoteResponse?.result?.[0] ?? {}
      : {};

  // ── Chart data ────────────────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chartJson: any = chartResult.status === 'fulfilled' ? chartResult.value : null;
  const cr = chartJson?.chart?.result?.[0];
  const ts: number[]            = cr?.timestamp ?? [];
  const closes: (number | null)[] = cr?.indicators?.quote?.[0]?.close ?? [];
  const priceHistory = ts
    .map((t, i) => ({ date: t * 1000, price: closes[i] as number }))
    .filter(p => p.price != null && !isNaN(p.price));

  // ── Performance (computed from chart data) ────────────────────────────────
  const performance = computePerformance(priceHistory);

  // ── Holdings (SEC EDGAR) ──────────────────────────────────────────────────
  const edgarResult = holdingsResult.status === 'fulfilled' ? holdingsResult.value : null;
  const holdings = (edgarResult?.holdings ?? []).map(h => ({
    ticker: h.ticker ?? '',
    name:   h.name,
    weight: h.weight,
  }));

  // ── Sectors (quoteSummary topHoldings — best-effort) ──────────────────────
  type SectorEntry = Record<string, { raw: number }>;
  const sectorsJson =
    sectorsResult.status === 'fulfilled'
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ? (sectorsResult.value as any)?.quoteSummary?.result?.[0]?.topHoldings
      : null;

  const sectors = ((sectorsJson?.sectorWeightings as SectorEntry[]) ?? [])
    .flatMap(obj =>
      Object.entries(obj).map(([key, val]) => ({
        sector: SECTOR_LABELS[key] ?? key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
        weight: (val?.raw ?? 0) * 100,
      })),
    )
    .filter(s => s.weight > 0)
    .sort((a, b) => b.weight - a.weight);

  // Use chart meta as fallback for price when v7 quote failed
  const chartMeta = cr?.meta ?? {};

  // v7/quote regularMarketChangePercent is a plain % value (e.g. 0.83 for 0.83%)
  // Normalise to decimal fraction to match the page's (v * 100) formatting
  const rawChangePct: number | undefined = q.regularMarketChangePercent;
  const changePct =
    rawChangePct != null
      ? rawChangePct / 100
      : null;

  return NextResponse.json({
    ticker: sym,
    name:          q.longName ?? q.shortName ?? chartMeta.shortName ?? sym,
    price:         q.regularMarketPrice        ?? chartMeta.regularMarketPrice  ?? null,
    change:        q.regularMarketChange       ?? null,
    changePct,
    aum:           q.totalAssets              ?? null,
    nav:           q.navPrice ?? q.regularMarketPrice ?? chartMeta.regularMarketPrice ?? null,
    expenseRatio:  q.expenseRatio             ?? null,
    dividendYield: q.trailingAnnualDividendYield ?? null,
    beta:          q.beta3Year               ?? null,
    inceptionDate: q.fundInceptionDate != null
      ? new Date(q.fundInceptionDate * 1000).toISOString().split('T')[0]
      : null,
    description:   null,          // not available from v7 quote
    category:      q.category    ?? null,
    family:        q.fundFamily  ?? null,
    week52High:    q.fiftyTwoWeekHigh  ?? null,
    week52Low:     q.fiftyTwoWeekLow   ?? null,
    volume:        q.regularMarketVolume ?? null,
    avgVolume:     q.averageVolume       ?? null,
    holdings,
    holdingsDate:  edgarResult?.asOfDate ?? null,
    holdingsSource: edgarResult?.source ?? 'unavailable',
    sectors,
    performance,
    priceHistory,
  });
}
