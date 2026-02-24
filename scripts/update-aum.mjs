/**
 * update-aum.mjs
 *
 * Standalone script (no Next.js runtime needed) that:
 *  1. Fetches live AUM (marketCap) for all seeded ETF tickers from Yahoo Finance
 *  2. Upserts updated AUM + price into Supabase etfs table
 *  3. Writes a daily row into aum_history for trend tracking
 *
 * Run via:  node scripts/update-aum.mjs
 * Or from GitHub Actions — see .github/workflows/update-data.yml
 *
 * Requires env vars:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_KEY   (service_role key — allows bypassing RLS for writes)
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY env vars. Exiting.');
  process.exit(0); // soft exit — don't fail CI
}

const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── Seed list (duplicated here to avoid TypeScript compilation in scripts) ──
const TICKERS = [
  'SPY','IVV','VOO','VTI','QQQ','QQQM','IWM','VUG','VTV','ITOT','SCHB','SCHX','RSP','MGK',
  'XLK','XLF','XLE','XLV','XLI','XLC','VGT','SOXX','SMH','IBB',
  'BND','AGG','VCIT','LQD','TLT','SHY','SGOV','GOVT','MUB','HYG','JNK',
  'GLD','IAU','SLV','GDX','USO','PDBC',
  'IEFA','VEA','VWO','EEM','EFA','FXI',
  'VNQ','SCHH','IYR',
  'ARKK','ARKW','IBIT','FBTC','GBTC','BITO','ETHA',
  'VYM','DVY','SCHD','DGRO',
  'TQQQ','SQQQ','SPXU','UPRO',
  'AOA','AOR',
  'ESGU','ESGV',
];

const DELAY = 600; // ms between per-ticker requests

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

const YAHOO_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// Yahoo Finance requires a crumb + session cookie since ~2023.
// Without it the API returns HTTP 200 with an empty quoteResponse.result.
let _session = null; // { crumb, cookies }

async function getYahooSession() {
  if (_session) return _session;
  try {
    // Step 1: load the homepage to collect session cookies
    const r1 = await fetch('https://finance.yahoo.com/', {
      headers: { 'User-Agent': YAHOO_UA, 'Accept': 'text/html,application/xhtml+xml' },
    });
    const setCookies = typeof r1.headers.getSetCookie === 'function'
      ? r1.headers.getSetCookie()
      : [r1.headers.get('set-cookie') ?? ''];
    const cookies = setCookies.map(c => c.split(';')[0]).filter(Boolean).join('; ');

    // Step 2: exchange cookies for a crumb
    const r2 = await fetch('https://query1.finance.yahoo.com/v1/test/getcrumb', {
      headers: { 'User-Agent': YAHOO_UA, 'Cookie': cookies },
    });
    if (r2.ok) {
      const crumb = (await r2.text()).trim();
      _session = { crumb, cookies };
      console.log(`[update-aum] Yahoo session ready (crumb=${crumb.slice(0, 6)}…)`);
    } else {
      console.warn(`[update-aum] getcrumb returned ${r2.status}`);
    }
  } catch (e) {
    console.warn('[update-aum] Failed to fetch Yahoo crumb:', e.message);
  }
  return _session;
}

// Fetch a single ticker — individual requests are far less likely to be
// rate-limited than batch requests from shared cloud IPs.
async function fetchYahooTicker(ticker) {
  let session = await getYahooSession();
  const fields = 'regularMarketPrice,regularMarketChangePercent,marketCap,shortName';

  for (const host of ['query2', 'query1']) {
    let url = `https://${host}.finance.yahoo.com/v7/finance/quote?symbols=${ticker}&fields=${fields}`;
    if (session?.crumb) url += `&crumb=${encodeURIComponent(session.crumb)}`;

    const headers = {
      'User-Agent': YAHOO_UA,
      'Accept': 'application/json, */*',
      'Accept-Language': 'en-US,en;q=0.9',
      'Origin': 'https://finance.yahoo.com',
      'Referer': 'https://finance.yahoo.com/',
    };
    if (session?.cookies) headers['Cookie'] = session.cookies;

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await fetch(url, { headers });
        if (res.status === 429) {
          const wait = (attempt + 1) * 20000;
          console.warn(`[update-aum] Rate limited (${host}/${ticker}), waiting ${wait / 1000}s…`);
          await sleep(wait);
          continue;
        }
        if (!res.ok) break;
        const json  = await res.json();
        const quote = json?.quoteResponse?.result?.[0];
        if (quote) return quote;
        // 200 but empty → stale crumb; refresh once and retry
        if (attempt === 0) { _session = null; session = await getYahooSession(); }
      } catch (e) {
        console.warn(`[update-aum] ${host}/${ticker} attempt ${attempt + 1}: ${e.message}`);
        if (attempt < 2) await sleep(3000);
      }
    }
  }
  return null;
}

async function main() {
  console.log(`[update-aum] Starting — ${new Date().toISOString()}`);
  const today = new Date().toISOString().split('T')[0];

  // Fetch one ticker at a time — single-ticker requests are far less
  // rate-limited than batch requests from shared GitHub Actions IPs.
  const etfRows    = [];
  const historyRows = [];

  for (let i = 0; i < TICKERS.length; i++) {
    const ticker = TICKERS[i];
    const q = await fetchYahooTicker(ticker);
    if (i % 10 === 0) console.log(`[update-aum] ${i}/${TICKERS.length} tickers processed`);
    if (!q) { await sleep(DELAY); continue; }

    const aum   = q.marketCap && q.marketCap > 1e8 ? q.marketCap : null;
    const price = q.regularMarketPrice ?? null;

    if (price) {
      // Include name so the upsert can INSERT new rows (name is NOT NULL in etfs table).
      // onConflict:'ticker' means existing rows get their name preserved on conflict.
      etfRows.push({ ticker, name: q.shortName || ticker, aum, price, change_pct: q.regularMarketChangePercent ?? null, updated_at: new Date().toISOString() });
      if (aum) historyRows.push({ ticker, date: today, aum, price });
    }
    await sleep(DELAY);
  }

  console.log(`[update-aum] Got ${etfRows.length} quotes from Yahoo Finance`);

  // Upsert into etfs (only AUM/price columns — don't overwrite metadata)
  if (etfRows.length > 0) {
    const { error } = await sb.from('etfs').upsert(etfRows, { onConflict: 'ticker' });
    if (error) console.error('[update-aum] etfs upsert error:', error.message);
    else console.log(`[update-aum] Upserted ${etfRows.length} ETF AUM records`);
  }

  // Insert daily snapshot (ignore duplicates via ON CONFLICT DO NOTHING)
  if (historyRows.length > 0) {
    const { error } = await sb.from('aum_history').upsert(historyRows, { onConflict: 'ticker,date', ignoreDuplicates: true });
    if (error) console.error('[update-aum] aum_history upsert error:', error.message);
    else console.log(`[update-aum] Wrote ${historyRows.length} history snapshots for ${today}`);
  }

  console.log(`[update-aum] Done — ${new Date().toISOString()}`);
}

main().catch(e => { console.error(e); process.exit(1); });
