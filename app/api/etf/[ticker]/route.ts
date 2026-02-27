import { NextResponse } from 'next/server';

export const revalidate = 900; // 15 min

// ── Yahoo Finance session (crumb + cookie) ────────────────────────────────────
// Cached at module level — persists for the lifetime of the server instance.
let yfSession: { crumb: string; cookie: string; expiry: number } | null = null;

const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': '*/*',
  'Accept-Language': 'en-US,en;q=0.9',
  'Referer': 'https://finance.yahoo.com/',
  'Origin':  'https://finance.yahoo.com',
};

async function refreshSession(): Promise<{ crumb: string; cookie: string }> {
  // Step 1 – hit fc.yahoo.com to get a B= session cookie
  const fcRes = await fetch('https://fc.yahoo.com/', {
    headers: { ...BROWSER_HEADERS, Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8' },
    redirect: 'follow',
    cache: 'no-store',
  });

  // Parse the B= cookie from set-cookie header(s)
  const rawCookies: string[] =
    typeof fcRes.headers.getSetCookie === 'function'
      ? fcRes.headers.getSetCookie()
      : (fcRes.headers.get('set-cookie') ?? '').split(/,(?=\s*\w+=)/);

  let bCookie = '';
  for (const c of rawCookies) {
    const m = c.match(/^\s*B=([^;]+)/);
    if (m) { bCookie = `B=${m[1]}`; break; }
  }

  // Step 2 – exchange the cookie for a crumb
  const crumbRes = await fetch('https://query2.finance.yahoo.com/v1/test/getcrumb', {
    headers: { ...BROWSER_HEADERS, Cookie: bCookie },
    cache: 'no-store',
  });

  const crumb = crumbRes.ok ? (await crumbRes.text()).trim() : '';

  const session = { crumb, cookie: bCookie, expiry: Date.now() + 25 * 60_000 };
  yfSession = session;
  return session;
}

async function getSession(): Promise<{ crumb: string; cookie: string }> {
  if (yfSession && Date.now() < yfSession.expiry) return yfSession;
  return refreshSession();
}

/** Fetch a Yahoo Finance URL with crumb auth; retries once on 429. */
async function yfFetch(baseUrl: string, noCache = false): Promise<unknown> {
  const { crumb, cookie } = await getSession();
  const sep = baseUrl.includes('?') ? '&' : '?';
  const url = crumb ? `${baseUrl}${sep}crumb=${encodeURIComponent(crumb)}` : baseUrl;

  const fetchOpts: RequestInit = {
    headers: { ...BROWSER_HEADERS, Cookie: cookie },
    ...(noCache ? { cache: 'no-store' } : { next: { revalidate: 900 } }),
  };

  let res = await fetch(url, fetchOpts);

  // On 429 or 401: refresh session and retry once
  if (res.status === 429 || res.status === 401) {
    yfSession = null;
    const fresh = await refreshSession();
    const retryUrl = fresh.crumb ? `${baseUrl}${sep}crumb=${encodeURIComponent(fresh.crumb)}` : baseUrl;
    res = await fetch(retryUrl, { ...fetchOpts, headers: { ...BROWSER_HEADERS, Cookie: fresh.cookie }, cache: 'no-store' });
  }

  if (!res.ok) throw new Error(`Yahoo Finance ${res.status} — ${baseUrl}`);
  return res.json();
}

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

// ── Route handler ─────────────────────────────────────────────────────────────
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ ticker: string }> },
) {
  const { ticker } = await params;
  const sym = ticker.toUpperCase();

  // Fetch chart and summary independently so one failure doesn't block the other
  const modules = 'topHoldings,summaryDetail,defaultKeyStatistics,fundProfile,price,fundPerformance';

  const [summaryResult, chartResult] = await Promise.allSettled([
    yfFetch(`https://query2.finance.yahoo.com/v10/finance/quoteSummary/${sym}?modules=${encodeURIComponent(modules)}`),
    yfFetch(`https://query2.finance.yahoo.com/v8/finance/chart/${sym}?range=5y&interval=1wk&includePrePost=false`),
  ]);

  // If both failed, return an error
  if (summaryResult.status === 'rejected' && chartResult.status === 'rejected') {
    return NextResponse.json({ error: summaryResult.reason?.message ?? 'Failed to load fund data' }, { status: 502 });
  }

  // ── Parse summary ──────────────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const summaryJson: any = summaryResult.status === 'fulfilled' ? summaryResult.value : null;
  const r = summaryJson?.quoteSummary?.result?.[0] ?? {};
  const { topHoldings, summaryDetail, defaultKeyStatistics, fundProfile, price, fundPerformance } = r;

  // ── Parse chart ────────────────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chartJson: any = chartResult.status === 'fulfilled' ? chartResult.value : null;
  const cr = chartJson?.chart?.result?.[0];
  const ts: number[]           = cr?.timestamp ?? [];
  const closes: (number|null)[] = cr?.indicators?.quote?.[0]?.close ?? [];
  const priceHistory = ts
    .map((t, i) => ({ date: t * 1000, price: closes[i] as number }))
    .filter(p => p.price != null && !isNaN(p.price));

  // ── Sectors ────────────────────────────────────────────────────────────────
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

  // ── Holdings ───────────────────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const holdings = (topHoldings?.holdings as any[] ?? []).map(h => ({
    ticker: (h.symbol     as string) ?? '',
    name:   (h.holdingName as string) ?? '',
    weight: ((h.holdingPercent?.raw as number) ?? 0) * 100,
  }));

  // ── Performance ────────────────────────────────────────────────────────────
  const tr = fundPerformance?.trailingReturns ?? {};
  const performance: Record<string, number | null> = {
    '1M':  tr.oneMonth?.raw   ?? null,
    '3M':  tr.threeMonth?.raw ?? null,
    '6M':  tr.sixMonth?.raw   ?? null,
    'YTD': tr.ytd?.raw        ?? null,
    '1Y':  tr.oneYear?.raw    ?? null,
    '3Y':  tr.threeYear?.raw  ?? null,
    '5Y':  tr.fiveYear?.raw   ?? null,
    '10Y': tr.tenYear?.raw    ?? null,
  };

  const inceptionRaw: number | undefined = defaultKeyStatistics?.fundInceptionDate?.raw;

  // Fall back to chart meta for price if quoteSummary failed
  const chartMeta = cr?.meta ?? {};

  return NextResponse.json({
    ticker: sym,
    name:          price?.longName ?? price?.shortName ?? chartMeta.shortName ?? sym,
    price:         price?.regularMarketPrice?.raw    ?? chartMeta.regularMarketPrice ?? null,
    change:        price?.regularMarketChange?.raw   ?? null,
    changePct:     price?.regularMarketChangePercent?.raw ?? null,
    aum:           summaryDetail?.totalAssets?.raw   ?? null,
    nav:           summaryDetail?.navPrice?.raw ?? price?.regularMarketPrice?.raw ?? chartMeta.regularMarketPrice ?? null,
    expenseRatio:  defaultKeyStatistics?.annualReportExpenseRatio?.raw ?? null,
    dividendYield: summaryDetail?.yield?.raw         ?? null,
    beta:          summaryDetail?.beta3Year?.raw     ?? null,
    inceptionDate: inceptionRaw
      ? new Date(inceptionRaw * 1000).toISOString().split('T')[0]
      : null,
    description:   fundProfile?.longBusinessSummary  ?? null,
    category:      fundProfile?.categoryName         ?? null,
    family:        fundProfile?.family               ?? null,
    week52High:    summaryDetail?.fiftyTwoWeekHigh?.raw ?? null,
    week52Low:     summaryDetail?.fiftyTwoWeekLow?.raw  ?? null,
    volume:        price?.regularMarketVolume?.raw   ?? null,
    avgVolume:     summaryDetail?.averageVolume?.raw  ?? null,
    holdings,
    sectors,
    performance,
    priceHistory,
  });
}
