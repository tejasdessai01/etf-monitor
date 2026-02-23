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

const CHUNK = 20;
const DELAY = 300; // ms between Yahoo Finance requests

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function fetchYahooChunk(tickers) {
  const symbols = tickers.join(',');
  const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${symbols}` +
    `&fields=regularMarketPrice,regularMarketChangePercent,marketCap,shortName`;
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ETFMonitor/1.0)' },
    });
    if (!res.ok) return {};
    const json = await res.json();
    const quotes = json?.quoteResponse?.result ?? [];
    return Object.fromEntries(quotes.map(q => [q.symbol, q]));
  } catch (e) {
    console.warn(`Yahoo Finance fetch failed for ${tickers.join(',')}: ${e.message}`);
    return {};
  }
}

async function main() {
  console.log(`[update-aum] Starting — ${new Date().toISOString()}`);
  const today = new Date().toISOString().split('T')[0];

  // Fetch all quotes in chunks
  const quoteMap = {};
  for (let i = 0; i < TICKERS.length; i += CHUNK) {
    const chunk = TICKERS.slice(i, i + CHUNK);
    const quotes = await fetchYahooChunk(chunk);
    Object.assign(quoteMap, quotes);
    if (i + CHUNK < TICKERS.length) await sleep(DELAY);
  }

  console.log(`[update-aum] Got ${Object.keys(quoteMap).length} quotes from Yahoo Finance`);

  // Build upsert rows
  const etfRows = [];
  const historyRows = [];

  for (const ticker of TICKERS) {
    const q = quoteMap[ticker];
    if (!q) continue;

    const aum   = q.marketCap && q.marketCap > 1e8 ? q.marketCap : null;
    const price = q.regularMarketPrice ?? null;

    if (aum) {
      etfRows.push({ ticker, aum, price, change_pct: q.regularMarketChangePercent ?? null, updated_at: new Date().toISOString() });
      historyRows.push({ ticker, date: today, aum, price });
    }
  }

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
