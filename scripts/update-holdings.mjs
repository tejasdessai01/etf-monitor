/**
 * update-holdings.mjs
 *
 * Fetches top holdings from SEC EDGAR NPORT-P filings for the top 30 ETFs
 * and upserts them into Supabase.
 *
 * Run via:  node scripts/update-holdings.mjs
 *
 * Requires:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_KEY
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing Supabase env vars. Exiting.');
  process.exit(0);
}

const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

const EDGAR_UA = 'ETFMonitor contact@etf-monitor.app';

// Top ETFs to pull holdings for (prioritise by AUM)
const TARGET_TICKERS = [
  'SPY','IVV','VOO','VTI','QQQ','BND','AGG','VEA','IEFA','VWO',
  'GLD','TLT','VUG','VTV','SCHD','VYM','XLK','XLF','XLE','QQQ',
  'IWM','VCIT','LQD','VNQ','SOXX','SMH','VGT','RSP','TQQQ','SCHB',
];

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function getTickerMap() {
  const res = await fetch('https://www.sec.gov/files/company_tickers.json', {
    headers: { 'User-Agent': EDGAR_UA },
  });
  if (!res.ok) throw new Error('Failed to fetch company_tickers.json');
  const json = await res.json();
  const map = {};
  for (const entry of Object.values(json)) {
    map[entry.ticker.toUpperCase()] = entry.cik_str.padStart(10, '0');
  }
  return map;
}

async function getLatestNportInfo(cik) {
  const res = await fetch(`https://data.sec.gov/submissions/CIK${cik}.json`, {
    headers: { 'User-Agent': EDGAR_UA },
  });
  if (!res.ok) return null;
  const json = await res.json();
  const recent = json?.filings?.recent;
  if (!recent) return null;

  const forms = recent.form ?? [];
  const accessions = recent.accessionNumber ?? [];
  const dates = recent.filingDate ?? [];

  for (let i = 0; i < forms.length; i++) {
    if (forms[i] === 'NPORT-P') {
      return { accession: accessions[i], date: dates[i] };
    }
  }
  return null;
}

function parseNportHoldings(xml, limit = 15) {
  const holdings = [];
  const blockRe = /<invstOrSec>([\s\S]*?)<\/invstOrSec>/g;
  let match;

  while ((match = blockRe.exec(xml)) !== null && holdings.length < limit * 3) {
    const block = match[1];
    const name   = /<name>(.*?)<\/name>/i.exec(block)?.[1]?.trim() ?? '';
    const pctStr = /<pctVal>(.*?)<\/pctVal>/i.exec(block)?.[1]?.trim() ?? '';
    const valStr = /<valUSD>(.*?)<\/valUSD>/i.exec(block)?.[1]?.trim() ?? '';
    const ticker = /<ticker>(.*?)<\/ticker>/i.exec(block)?.[1]?.trim() ?? '';

    if (!name || !pctStr) continue;
    const weight = parseFloat(pctStr);
    const value  = parseFloat(valStr) || 0;
    if (isNaN(weight) || weight <= 0) continue;
    holdings.push({ name, ticker: ticker || null, weight, value });
  }

  holdings.sort((a, b) => b.weight - a.weight);
  return holdings.slice(0, limit);
}

async function fetchHoldingsForTicker(ticker, cik) {
  const info = await getLatestNportInfo(cik);
  if (!info) return null;

  const accPath = info.accession.replace(/-/g, '');
  const cikNum  = cik.replace(/^0+/, '');
  const dirUrl  = `https://www.sec.gov/Archives/edgar/data/${cikNum}/${accPath}`;

  // Try index first
  let xmlUrl = '';
  try {
    const indexRes = await fetch(`${dirUrl}/${info.accession}-index.htm`, {
      headers: { 'User-Agent': EDGAR_UA },
    });
    if (indexRes.ok) {
      const html = await indexRes.text();
      const xmlMatch = /href="([^"]+\.xml)"/i.exec(html);
      if (xmlMatch) {
        xmlUrl = xmlMatch[1].startsWith('http')
          ? xmlMatch[1]
          : `https://www.sec.gov${xmlMatch[1]}`;
      }
    }
  } catch {}

  if (!xmlUrl) xmlUrl = `${dirUrl}/primary_doc.xml`;

  const xmlRes = await fetch(xmlUrl, { headers: { 'User-Agent': EDGAR_UA } });
  if (!xmlRes.ok) return null;

  const xml = await xmlRes.text();
  const holdings = parseNportHoldings(xml);
  if (holdings.length === 0) return null;

  return { holdings, asOfDate: info.date };
}

async function main() {
  console.log(`[update-holdings] Starting — ${new Date().toISOString()}`);

  const tickerMap = await getTickerMap();
  console.log(`[update-holdings] Loaded ${Object.keys(tickerMap).length} ticker→CIK mappings`);

  let processed = 0;
  let skipped = 0;

  for (const ticker of TARGET_TICKERS) {
    const cik = tickerMap[ticker];
    if (!cik) { console.warn(`[update-holdings] No CIK for ${ticker}`); skipped++; continue; }

    try {
      await sleep(500); // EDGAR rate limit: ≤10 req/s
      const result = await fetchHoldingsForTicker(ticker, cik);

      if (!result || result.holdings.length === 0) {
        console.log(`[update-holdings] ${ticker}: no NPORT-P data`);
        skipped++;
        continue;
      }

      const rows = result.holdings.map(h => ({
        etf_ticker:     ticker,
        as_of_date:     result.asOfDate,
        holding_name:   h.name,
        holding_ticker: h.ticker,
        weight:         h.weight,
        value_usd:      Math.round(h.value),
      }));

      const { error } = await sb.from('holdings').upsert(rows, {
        onConflict: 'etf_ticker,as_of_date,holding_name',
        ignoreDuplicates: true,
      });

      if (error) {
        console.error(`[update-holdings] ${ticker} upsert error:`, error.message);
      } else {
        console.log(`[update-holdings] ${ticker}: saved ${rows.length} holdings (as of ${result.asOfDate})`);
        processed++;
      }
    } catch (e) {
      console.error(`[update-holdings] ${ticker} failed:`, e.message);
      skipped++;
    }
  }

  console.log(`[update-holdings] Done — processed: ${processed}, skipped: ${skipped} — ${new Date().toISOString()}`);
}

main().catch(e => { console.error(e); process.exit(1); });
