/**
 * import-all-etfs.mjs
 *
 * One-time (or periodic) script that pulls ALL US-listed ETFs and loads them
 * into Supabase. No paid API keys required.
 *
 * Data pipeline:
 *  1. SEC EDGAR company_tickers_exchange.json → every exchange-listed ticker + CIK
 *  2. Yahoo Finance batch quote API          → validate ETF status, get AUM/price/category
 *  3. Supabase upsert                        → persist full universe
 *
 * Runtime: ~3-5 minutes (rate-limited to respect Yahoo Finance)
 *
 * Usage:
 *   NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_KEY=... node scripts/import-all-etfs.mjs
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_KEY');
  process.exit(0);
}

const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

const EDGAR_UA  = 'ETFMonitor contact@etf-monitor.app';
const YAHOO_UA  = 'Mozilla/5.0 (compatible; ETFMonitor/1.0)';
const CHUNK     = 20;   // Yahoo Finance max symbols per request
const DELAY_MS  = 350;  // polite rate limit

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── 1. Yahoo Finance category → our taxonomy ────────────────────────────────

function mapCategory(ycat = '') {
  const c = ycat.toLowerCase();

  if (c.includes('large') && c.includes('blend'))   return { category: 'US Equity', subCategory: 'Large Cap Blend' };
  if (c.includes('large') && c.includes('growth'))  return { category: 'US Equity', subCategory: 'Large Cap Growth' };
  if (c.includes('large') && c.includes('value'))   return { category: 'US Equity', subCategory: 'Large Cap Value' };
  if (c.includes('mid')   && c.includes('blend'))   return { category: 'US Equity', subCategory: 'Mid Cap Blend' };
  if (c.includes('mid')   && c.includes('growth'))  return { category: 'US Equity', subCategory: 'Mid Cap Growth' };
  if (c.includes('mid')   && c.includes('value'))   return { category: 'US Equity', subCategory: 'Mid Cap Value' };
  if (c.includes('small') && c.includes('blend'))   return { category: 'US Equity', subCategory: 'Small Cap Blend' };
  if (c.includes('small') && c.includes('growth'))  return { category: 'US Equity', subCategory: 'Small Cap Growth' };
  if (c.includes('small') && c.includes('value'))   return { category: 'US Equity', subCategory: 'Small Cap Value' };
  if (c.includes('dividend') || c.includes('income')) return { category: 'US Equity', subCategory: 'Dividend' };
  if (c.includes('equity') || c.includes('stock'))  return { category: 'US Equity', subCategory: 'US Equity' };

  if (c.includes('emerging'))                        return { category: 'International', subCategory: 'Emerging Markets' };
  if (c.includes('foreign') || c.includes('world') || c.includes('eafe') || c.includes('international')) return { category: 'International', subCategory: 'Developed Markets' };
  if (c.includes('china'))                           return { category: 'International', subCategory: 'China' };
  if (c.includes('japan'))                           return { category: 'International', subCategory: 'Japan' };
  if (c.includes('europe'))                          return { category: 'International', subCategory: 'Europe' };
  if (c.includes('india'))                           return { category: 'International', subCategory: 'India' };

  if (c.includes('ultrashort') || c.includes('ultra short') || c.includes('money market')) return { category: 'Fixed Income', subCategory: 'Ultra Short' };
  if (c.includes('short-term bond') || c.includes('short term bond')) return { category: 'Fixed Income', subCategory: 'Short-Term Bond' };
  if (c.includes('long-term bond')  || c.includes('long term bond'))  return { category: 'Fixed Income', subCategory: 'Long-Term Bond' };
  if (c.includes('high yield') || c.includes('junk'))                 return { category: 'Fixed Income', subCategory: 'High Yield' };
  if (c.includes('muni') || c.includes('municipal'))                  return { category: 'Fixed Income', subCategory: 'Municipal' };
  if (c.includes('treasury') || c.includes('government'))             return { category: 'Fixed Income', subCategory: 'Treasury' };
  if (c.includes('corporate') || c.includes('corp'))                  return { category: 'Fixed Income', subCategory: 'Corp Bond' };
  if (c.includes('inflation') || c.includes('tips'))                  return { category: 'Fixed Income', subCategory: 'Inflation-Protected' };
  if (c.includes('bond') || c.includes('fixed'))                      return { category: 'Fixed Income', subCategory: 'Broad Bond' };

  if (c.includes('real estate') || c.includes('reit'))                return { category: 'Real Estate', subCategory: 'Diversified REIT' };

  if (c.includes('technology') || c.includes('tech'))                 return { category: 'Sector', subCategory: 'Technology' };
  if (c.includes('financial') || c.includes('bank'))                  return { category: 'Sector', subCategory: 'Financials' };
  if (c.includes('health') || c.includes('biotech') || c.includes('pharma')) return { category: 'Sector', subCategory: 'Health Care' };
  if (c.includes('energy'))                                            return { category: 'Sector', subCategory: 'Energy' };
  if (c.includes('utilities'))                                         return { category: 'Sector', subCategory: 'Utilities' };
  if (c.includes('consumer'))                                          return { category: 'Sector', subCategory: 'Consumer' };
  if (c.includes('industrial'))                                        return { category: 'Sector', subCategory: 'Industrials' };
  if (c.includes('material'))                                          return { category: 'Sector', subCategory: 'Materials' };
  if (c.includes('semiconductor'))                                     return { category: 'Sector', subCategory: 'Semiconductors' };
  if (c.includes('communication'))                                     return { category: 'Sector', subCategory: 'Comm. Services' };

  if (c.includes('precious metal') || c.includes('gold') || c.includes('silver')) return { category: 'Commodities', subCategory: 'Precious Metals' };
  if (c.includes('commodit') || c.includes('natural resource') || c.includes('oil') || c.includes('energy limited')) return { category: 'Commodities', subCategory: 'Broad' };

  if (c.includes('digital') || c.includes('crypto') || c.includes('bitcoin') || c.includes('blockchain')) return { category: 'Digital Assets', subCategory: 'Digital Assets' };

  if (c.includes('leveraged') || c.includes('2x') || c.includes('3x') || c.includes('ultra pro')) return { category: 'Leveraged', subCategory: 'Leveraged' };
  if (c.includes('inverse') || c.includes('short '))                  return { category: 'Leveraged', subCategory: 'Inverse' };

  if (c.includes('allocation') || c.includes('target') || c.includes('retirement') || c.includes('multi')) return { category: 'Multi-Asset', subCategory: 'Allocation' };

  if (c.includes('esg') || c.includes('socially') || c.includes('sustainable')) return { category: 'ESG', subCategory: 'ESG' };

  return { category: 'Thematic', subCategory: ycat || 'Other' };
}

function mapExchange(code = '', fullName = '') {
  const n = (fullName || code).toLowerCase();
  if (n.includes('nyse arca') || code === 'PCX') return 'NYSE Arca';
  if (n.includes('nasdaq') || code === 'NMS' || code === 'NGM') return 'NASDAQ';
  if (n.includes('cboe') || code === 'BZX') return 'CBOE';
  if (n.includes('nyse') || code === 'NYQ') return 'NYSE';
  return fullName || code || 'Unknown';
}

// ── 2. Fetch all exchange-listed tickers from SEC EDGAR ──────────────────────

async function fetchEdgarTickers() {
  console.log('[import] Fetching SEC EDGAR company ticker list...');
  const res = await fetch('https://www.sec.gov/files/company_tickers_exchange.json', {
    headers: { 'User-Agent': EDGAR_UA },
  });
  if (!res.ok) throw new Error(`EDGAR HTTP ${res.status}`);
  const json = await res.json();

  // Filter to major US exchanges only (skip OTC)
  const VALID_EXCHANGES = new Set(['Nasdaq', 'NYSE', 'NYSE MKT', 'NYSE Arca', 'CBOE']);
  const tickers = [];
  for (const entry of Object.values(json)) {
    if (VALID_EXCHANGES.has(entry.exchange) && entry.ticker) {
      tickers.push({ ticker: entry.ticker.toUpperCase(), cik: String(entry.cik_str).padStart(10, '0'), exchange: entry.exchange });
    }
  }
  console.log(`[import] ${tickers.length} exchange-listed tickers found`);
  return tickers;
}

// ── 3. Validate ETF status via Yahoo Finance ─────────────────────────────────

async function fetchYahooChunk(tickers) {
  const symbols = tickers.map(t => t.ticker).join(',');
  const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${symbols}` +
    `&fields=quoteType,shortName,longName,marketCap,regularMarketPrice,regularMarketChangePercent,netExpenseRatio,category,fullExchangeName,exchange`;
  try {
    const res = await fetch(url, { headers: { 'User-Agent': YAHOO_UA } });
    if (!res.ok) return [];
    const json = await res.json();
    return json?.quoteResponse?.result ?? [];
  } catch (e) {
    console.warn(`[import] Yahoo chunk failed: ${e.message}`);
    return [];
  }
}

// ── 4. Main ──────────────────────────────────────────────────────────────────

async function main() {
  console.log(`[import] Starting full ETF universe import — ${new Date().toISOString()}`);

  // Step 1: get all exchange-listed tickers
  const allTickers = await fetchEdgarTickers();

  // Step 2: batch through Yahoo Finance to find ETFs
  const chunks = [];
  for (let i = 0; i < allTickers.length; i += CHUNK) {
    chunks.push(allTickers.slice(i, i + CHUNK));
  }

  console.log(`[import] Validating ${chunks.length} chunks via Yahoo Finance...`);

  const etfRows = [];
  let chunkIdx = 0;

  for (const chunk of chunks) {
    chunkIdx++;
    if (chunkIdx % 50 === 0) {
      console.log(`[import] Progress: ${chunkIdx}/${chunks.length} chunks, ${etfRows.length} ETFs found so far`);
    }

    const quotes = await fetchYahooChunk(chunk);
    for (const q of quotes) {
      if (q.quoteType !== 'ETF') continue;

      const tickerEntry = chunk.find(t => t.ticker === q.symbol);
      const { category, subCategory } = mapCategory(q.category);
      const exchange = mapExchange(q.exchange, q.fullExchangeName);

      etfRows.push({
        ticker:         q.symbol,
        name:           q.longName || q.shortName || q.symbol,
        issuer:         '', // not available from Yahoo; will be blank for now
        category,
        sub_category:   subCategory,
        aum:            q.marketCap && q.marketCap > 100000 ? Math.round(q.marketCap) : null,
        expense_ratio:  q.netExpenseRatio ?? null,
        exchange,
        cik:            tickerEntry?.cik ?? null,
        price:          q.regularMarketPrice ?? null,
        change_pct:     q.regularMarketChangePercent ?? null,
        updated_at:     new Date().toISOString(),
      });
    }

    await sleep(DELAY_MS);
  }

  console.log(`[import] Found ${etfRows.length} ETFs. Upserting to Supabase...`);

  // Step 3: upsert in batches of 200 (Supabase row limit per upsert)
  const BATCH = 200;
  let upserted = 0;

  for (let i = 0; i < etfRows.length; i += BATCH) {
    const batch = etfRows.slice(i, i + BATCH);
    const { error } = await sb
      .from('etfs')
      .upsert(batch, { onConflict: 'ticker' });

    if (error) {
      console.error(`[import] Upsert error (batch ${i / BATCH + 1}):`, error.message);
    } else {
      upserted += batch.length;
    }
  }

  // Step 4: write a daily AUM snapshot for this run
  const today = new Date().toISOString().split('T')[0];
  const historyRows = etfRows
    .filter(e => e.aum)
    .map(e => ({ ticker: e.ticker, date: today, aum: e.aum, price: e.price }));

  for (let i = 0; i < historyRows.length; i += BATCH) {
    await sb.from('aum_history').upsert(historyRows.slice(i, i + BATCH), {
      onConflict: 'ticker,date',
      ignoreDuplicates: true,
    });
  }

  console.log(`[import] Done — ${upserted} ETFs upserted, ${historyRows.length} AUM snapshots written`);
  console.log(`[import] Finished — ${new Date().toISOString()}`);
}

main().catch(e => { console.error('[import] Fatal:', e); process.exit(1); });
