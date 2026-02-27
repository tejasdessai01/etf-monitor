import { NextResponse } from 'next/server';

export const revalidate = 900; // 15 min

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

const YF_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
};

async function yfFetch(url: string) {
  const res = await fetch(url, { headers: YF_HEADERS, next: { revalidate: 900 } });
  if (!res.ok) throw new Error(`Yahoo Finance ${res.status} for ${url}`);
  return res.json();
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ ticker: string }> },
) {
  const { ticker } = await params;
  const sym = ticker.toUpperCase();

  try {
    const modules = encodeURIComponent(
      'topHoldings,summaryDetail,defaultKeyStatistics,fundProfile,price,fundPerformance',
    );

    const [summaryJson, chartJson] = await Promise.all([
      yfFetch(
        `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${sym}?modules=${modules}`,
      ),
      yfFetch(
        `https://query1.finance.yahoo.com/v8/finance/chart/${sym}?range=5y&interval=1wk&includePrePost=false`,
      ),
    ]);

    const r = summaryJson?.quoteSummary?.result?.[0] ?? {};
    const { topHoldings, summaryDetail, defaultKeyStatistics, fundProfile, price, fundPerformance } = r;

    // Price history
    const cr = chartJson?.chart?.result?.[0];
    const ts: number[] = cr?.timestamp ?? [];
    const closes: (number | null)[] = cr?.indicators?.quote?.[0]?.close ?? [];
    const priceHistory = ts
      .map((t, i) => ({ date: t * 1000, price: closes[i] as number }))
      .filter(p => p.price != null && !isNaN(p.price));

    // Sectors — YF returns [{realestate: {raw: 0.023}}, ...]
    type SectorEntry = Record<string, { raw: number }>;
    const sectors = (topHoldings?.sectorWeightings as SectorEntry[] ?? [])
      .flatMap(obj =>
        Object.entries(obj).map(([key, val]) => ({
          sector: SECTOR_LABELS[key] ?? key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
          weight: (val?.raw ?? 0) * 100,
        })),
      )
      .filter(s => s.weight > 0)
      .sort((a, b) => b.weight - a.weight);

    // Holdings
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const holdings = (topHoldings?.holdings as any[] ?? []).map(h => ({
      ticker: (h.symbol as string) ?? '',
      name:   (h.holdingName as string) ?? '',
      weight: ((h.holdingPercent?.raw as number) ?? 0) * 100,
    }));

    // Performance — decimals, e.g. 0.15 = 15%
    const tr = fundPerformance?.trailingReturns ?? {};
    const performance: Record<string, number | null> = {
      '1M':  tr.oneMonth?.raw    ?? null,
      '3M':  tr.threeMonth?.raw  ?? null,
      '6M':  tr.sixMonth?.raw    ?? null,
      'YTD': tr.ytd?.raw         ?? null,
      '1Y':  tr.oneYear?.raw     ?? null,
      '3Y':  tr.threeYear?.raw   ?? null,
      '5Y':  tr.fiveYear?.raw    ?? null,
      '10Y': tr.tenYear?.raw     ?? null,
    };

    const inceptionRaw: number | undefined = defaultKeyStatistics?.fundInceptionDate?.raw;

    return NextResponse.json({
      ticker: sym,
      name:         price?.longName ?? price?.shortName ?? sym,
      price:        price?.regularMarketPrice?.raw            ?? null,
      change:       price?.regularMarketChange?.raw           ?? null,
      changePct:    price?.regularMarketChangePercent?.raw    ?? null,
      aum:          summaryDetail?.totalAssets?.raw           ?? null,
      nav:          summaryDetail?.navPrice?.raw ?? price?.regularMarketPrice?.raw ?? null,
      expenseRatio: defaultKeyStatistics?.annualReportExpenseRatio?.raw ?? null,
      dividendYield: summaryDetail?.yield?.raw                ?? null,
      beta:         summaryDetail?.beta3Year?.raw             ?? null,
      inceptionDate: inceptionRaw
        ? new Date(inceptionRaw * 1000).toISOString().split('T')[0]
        : null,
      description:  fundProfile?.longBusinessSummary          ?? null,
      category:     fundProfile?.categoryName                 ?? null,
      family:       fundProfile?.family                       ?? null,
      week52High:   summaryDetail?.fiftyTwoWeekHigh?.raw      ?? null,
      week52Low:    summaryDetail?.fiftyTwoWeekLow?.raw       ?? null,
      volume:       price?.regularMarketVolume?.raw           ?? null,
      avgVolume:    summaryDetail?.averageVolume?.raw         ?? null,
      holdings,
      sectors,
      performance,
      priceHistory,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
