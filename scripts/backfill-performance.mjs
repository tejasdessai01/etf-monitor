/**
 * backfill-performance.mjs
 *
 * One-time (or periodic) script that populates ytd_return, one_year_return,
 * two_year_return, three_year_return for every ETF in the Supabase DB by
 * fetching monthly price history from Stooq.
 *
 * Run AFTER applying the schema migration in supabase/schema.sql.
 *
 * Usage:
 *   NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_KEY=... node scripts/backfill-performance.mjs
 *
 * Or via GitHub Actions (see .github/workflows/update-data.yml).
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_KEY');
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

const BATCH  = 4;    // concurrent Stooq requests per batch
const DELAY  = 300;  // ms between batches
const CHUNK  = 200;  // ETFs per DB page

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function fetchStooq(ticker) {
  const url = `https://stooq.com/q/d/l/?s=${ticker.toLowerCase()}.us&i=m`;
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!res.ok) return null;
    const text = await res.text();
    const lines = text.trim().split('\n');
    if (lines.length < 3) return null;
    return lines.slice(1).map(line => {
      const cols = line.split(',');
      return { date: new Date(cols[0]).getTime(), price: parseFloat(cols[4]) };
    }).filter(p => !isNaN(p.price) && !isNaN(p.date));
  } catch {
    return null;
  }
}

function computePerf(history) {
  if (history.length < 3) return null;
  const latest   = history[history.length - 1].price;
  const thisYear = new Date().getFullYear();
  const decPrev  = history.filter(p => new Date(p.date).getFullYear() === thisYear - 1).at(-1)?.price ?? null;

  function priceAt(daysAgo) {
    const target = Date.now() - daysAgo * 86_400_000;
    let best = null, bestDiff = Infinity;
    for (const p of history) {
      const d = Math.abs(p.date - target);
      if (d < bestDiff) { bestDiff = d; best = p; }
    }
    return best && bestDiff < 46 * 86_400_000 ? best.price : null;
  }

  const ret = (daysAgo, years) => {
    const past = priceAt(daysAgo);
    if (!past || past === 0) return null;
    const r = (latest - past) / past;
    return years ? Math.pow(1 + r, 1 / years) - 1 : r;
  };

  return {
    ytd_return:        decPrev ? (latest - decPrev) / decPrev : null,
    one_year_return:   ret(365),
    two_year_return:   ret(730, 2),
    three_year_return: ret(1095, 3),
    perf_updated_at:   new Date().toISOString(),
  };
}

async function processChunk(tickers) {
  const histories = [];
  for (let i = 0; i < tickers.length; i += BATCH) {
    const batch = tickers.slice(i, i + BATCH);
    const results = await Promise.allSettled(batch.map(fetchStooq));
    for (const r of results) histories.push(r.status === 'fulfilled' ? r.value : null);
    if (i + BATCH < tickers.length) await sleep(DELAY);
  }

  const rows = [];
  for (let i = 0; i < tickers.length; i++) {
    const perf = histories[i] ? computePerf(histories[i]) : null;
    if (!perf) continue;
    rows.push({ ticker: tickers[i], ...perf });
  }

  if (rows.length > 0) {
    const { error } = await sb.from('etfs').upsert(rows, { onConflict: 'ticker' });
    if (error) console.error('  Upsert error:', error.message);
  }

  return rows.length;
}

async function main() {
  console.log('Fetching ETF tickers from Supabase...');
  const { data: allRows, error } = await sb.from('etfs').select('ticker').order('ticker');
  if (error || !allRows) { console.error('DB error:', error?.message); process.exit(1); }

  const tickers = allRows.map(r => r.ticker);
  console.log(`Processing ${tickers.length} ETFs in chunks of ${CHUNK}...`);

  let totalUpdated = 0;
  for (let offset = 0; offset < tickers.length; offset += CHUNK) {
    const chunk = tickers.slice(offset, offset + CHUNK);
    process.stdout.write(`  offset=${offset} (${chunk.length} tickers)... `);
    const updated = await processChunk(chunk);
    totalUpdated += updated;
    console.log(`${updated} updated`);
  }

  console.log(`\nDone. Total updated: ${totalUpdated} / ${tickers.length}`);
}

main();
