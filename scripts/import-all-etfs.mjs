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

const EDGAR_UA = 'ETFMonitor contact@etf-monitor.app';
const YAHOO_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const CHUNK    = 10;    // smaller batches → less likely to trigger rate limits
const DELAY_MS = 800;   // ms between Yahoo Finance chunks

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// Yahoo Finance requires crumb + session cookie since ~2023.
let _session = null;

async function getYahooSession() {
  if (_session) return _session;
  try {
    const r1 = await fetch('https://finance.yahoo.com/', {
      headers: { 'User-Agent': YAHOO_UA, 'Accept': 'text/html,application/xhtml+xml' },
    });
    const setCookies = typeof r1.headers.getSetCookie === 'function'
      ? r1.headers.getSetCookie()
      : [r1.headers.get('set-cookie') ?? ''];
    const cookies = setCookies.map(c => c.split(';')[0]).filter(Boolean).join('; ');

    const r2 = await fetch('https://query1.finance.yahoo.com/v1/test/getcrumb', {
      headers: { 'User-Agent': YAHOO_UA, 'Cookie': cookies },
    });
    if (r2.ok) {
      const crumb = (await r2.text()).trim();
      _session = { crumb, cookies };
      console.log(`[import] Yahoo session ready (crumb=${crumb.slice(0, 6)}…)`);
    } else {
      console.warn(`[import] getcrumb returned ${r2.status}`);
    }
  } catch (e) {
    console.warn('[import] Failed to get Yahoo crumb:', e.message);
  }
  return _session;
}

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
  console.log('[import] Fetching SEC EDGAR ticker lists…');

  // company_tickers_exchange.json  → ticker + exchange (columnar, no title)
  // company_tickers.json           → ticker + title (object-map, no exchange)
  // We fetch both and join by CIK to get ticker + exchange + title.

  const [resEx, resTitles] = await Promise.all([
    fetch('https://www.sec.gov/files/company_tickers_exchange.json', { headers: { 'User-Agent': EDGAR_UA } }),
    fetch('https://www.sec.gov/files/company_tickers.json',          { headers: { 'User-Agent': EDGAR_UA } }),
  ]);
  if (!resEx.ok)     throw new Error(`EDGAR exchange list HTTP ${resEx.status}`);
  if (!resTitles.ok) throw new Error(`EDGAR titles list HTTP ${resTitles.status}`);

  const [jsonEx, jsonTitles] = await Promise.all([resEx.json(), resTitles.json()]);

  // Build ticker → title map from company_tickers.json (join by ticker, not CIK,
  // to avoid CIK format mismatches between the two files).
  const titleByTicker = new Map();
  if (Array.isArray(jsonTitles.fields) && Array.isArray(jsonTitles.data)) {
    const fi = { ticker: jsonTitles.fields.indexOf('ticker'), title: jsonTitles.fields.indexOf('title') };
    console.log(`[import] company_tickers.json fields: ${JSON.stringify(jsonTitles.fields)}`);
    for (const row of jsonTitles.data) {
      const t = row[fi.ticker]; const ttl = row[fi.title];
      if (t) titleByTicker.set(String(t).toUpperCase(), ttl ?? '');
    }
  } else {
    for (const entry of Object.values(jsonTitles)) {
      if (entry.ticker) titleByTicker.set(String(entry.ticker).toUpperCase(), entry.title ?? '');
    }
  }
  console.log(`[import] Loaded ${titleByTicker.size} company titles`);
  // Debug: show a few entries
  const titleSample = [...titleByTicker.entries()].slice(0, 3).map(([k,v]) => `${k}:"${v}"`).join(' | ');
  console.log(`[import] Title map sample: ${titleSample}`);

  // Parse exchange list (columnar format)
  const VALID_EXCHANGES = new Set(['Nasdaq', 'NYSE', 'NYSE MKT', 'NYSE Arca', 'CBOE']);
  const tickers = [];

  if (Array.isArray(jsonEx.fields) && Array.isArray(jsonEx.data)) {
    const fi = { ticker: jsonEx.fields.indexOf('ticker'), cik: jsonEx.fields.indexOf('cik_str'), exchange: jsonEx.fields.indexOf('exchange') };
    for (const row of jsonEx.data) {
      const exchange = row[fi.exchange];
      const ticker   = String(row[fi.ticker] ?? '').toUpperCase();
      if (VALID_EXCHANGES.has(exchange) && ticker) {
        tickers.push({ ticker, cik: String(row[fi.cik]).padStart(10, '0'), exchange, title: titleByTicker.get(ticker) ?? '' });
      }
    }
  } else {
    for (const entry of Object.values(jsonEx)) {
      if (VALID_EXCHANGES.has(entry.exchange) && entry.ticker) {
        const ticker = entry.ticker.toUpperCase();
        tickers.push({ ticker, cik: String(entry.cik_str).padStart(10, '0'), exchange: entry.exchange, title: titleByTicker.get(ticker) ?? '' });
      }
    }
  }

  console.log(`[import] ${tickers.length} exchange-listed tickers found`);
  const sample = tickers.slice(0, 5).map(t => `${t.ticker}: "${t.title}"`).join(' | ');
  console.log(`[import] Title sample: ${sample}`);
  return tickers;
}

// ── 3. Category inference from ETF name (no Yahoo Finance needed) ────────────

function mapCategoryFromName(name = '') {
  const n = name.toLowerCase();
  // Digital assets (check first — most specific)
  if (/bitcoin|ethereum|crypto|blockchain|digital asset/.test(n)) return { category: 'Digital Assets', subCategory: 'Digital Assets' };
  // Leveraged / inverse
  if (/ultra pro|ultrashort|ultra short|leveraged|2x |3x /.test(n)) return { category: 'Leveraged', subCategory: 'Leveraged' };
  if (/inverse|short s&p|short nasdaq/.test(n))                      return { category: 'Leveraged', subCategory: 'Inverse' };
  // Commodities
  if (/gold|silver|precious metal/.test(n))                           return { category: 'Commodities', subCategory: 'Precious Metals' };
  if (/oil|natural gas|commodit|energy trust/.test(n))               return { category: 'Commodities', subCategory: 'Broad' };
  // Real estate
  if (/real estate|reit/.test(n))                                     return { category: 'Real Estate', subCategory: 'Diversified REIT' };
  // Fixed income
  if (/treasury|government bond|govt bond|t-bill|t-bond/.test(n))    return { category: 'Fixed Income', subCategory: 'Treasury' };
  if (/high yield|junk bond/.test(n))                                 return { category: 'Fixed Income', subCategory: 'High Yield' };
  if (/muni|municipal/.test(n))                                       return { category: 'Fixed Income', subCategory: 'Municipal' };
  if (/corporate bond|corp bond|investment grade/.test(n))            return { category: 'Fixed Income', subCategory: 'Corp Bond' };
  if (/inflation|tips/.test(n))                                       return { category: 'Fixed Income', subCategory: 'Inflation-Protected' };
  if (/aggregate bond|total bond|bond market|bond fund/.test(n))      return { category: 'Fixed Income', subCategory: 'Broad Bond' };
  if (/\bbond\b|fixed income/.test(n))                                return { category: 'Fixed Income', subCategory: 'Broad Bond' };
  // International
  if (/emerging market|developing market/.test(n))                    return { category: 'International', subCategory: 'Emerging Markets' };
  if (/\bchina\b|\bchinese\b/.test(n))                                return { category: 'International', subCategory: 'China' };
  if (/\bjapan\b|\bjapanese\b/.test(n))                               return { category: 'International', subCategory: 'Japan' };
  if (/\beurope\b|\beuropean\b/.test(n))                              return { category: 'International', subCategory: 'Europe' };
  if (/\bindia\b|\bindian\b/.test(n))                                 return { category: 'International', subCategory: 'India' };
  if (/international|foreign|global|world|eafe|ex-us/.test(n))       return { category: 'International', subCategory: 'Developed Markets' };
  // Sector
  if (/semiconductor/.test(n))                                        return { category: 'Sector', subCategory: 'Semiconductors' };
  if (/technology|tech fund|tech etf/.test(n))                       return { category: 'Sector', subCategory: 'Technology' };
  if (/biotech|health care|healthcare|pharmaceutical|medical/.test(n)) return { category: 'Sector', subCategory: 'Health Care' };
  if (/financial|banking sector/.test(n))                             return { category: 'Sector', subCategory: 'Financials' };
  if (/consumer/.test(n))                                             return { category: 'Sector', subCategory: 'Consumer' };
  if (/industrial/.test(n))                                           return { category: 'Sector', subCategory: 'Industrials' };
  if (/material|metals & mining/.test(n))                             return { category: 'Sector', subCategory: 'Materials' };
  if (/utilit/.test(n))                                               return { category: 'Sector', subCategory: 'Utilities' };
  if (/communication|telecom/.test(n))                                return { category: 'Sector', subCategory: 'Comm. Services' };
  // ESG
  if (/esg|sustainable|socially responsible|environmental/.test(n))  return { category: 'ESG', subCategory: 'ESG' };
  // Dividend
  if (/dividend/.test(n))                                             return { category: 'US Equity', subCategory: 'Dividend' };
  // Cap size
  if (/small.cap|russell 2000|s&p smallcap/.test(n))                  return { category: 'US Equity', subCategory: 'Small Cap Blend' };
  if (/mid.cap|russell midcap|s&p midcap/.test(n))                    return { category: 'US Equity', subCategory: 'Mid Cap Blend' };
  if (/large.cap|s&p 500|total market|total stock/.test(n))           return { category: 'US Equity', subCategory: 'Large Cap Blend' };
  if (/\bgrowth\b/.test(n))                                           return { category: 'US Equity', subCategory: 'Large Cap Growth' };
  if (/\bvalue\b/.test(n))                                            return { category: 'US Equity', subCategory: 'Large Cap Value' };
  // Multi-asset
  if (/allocation|balanced|target.?date|retirement/.test(n))          return { category: 'Multi-Asset', subCategory: 'Allocation' };
  // Default
  return { category: 'US Equity', subCategory: 'US Equity' };
}

// ── 4. Main ──────────────────────────────────────────────────────────────────

async function main() {
  console.log(`[import] Starting full ETF universe import — ${new Date().toISOString()}`);

  // Step 1: get all exchange-listed tickers + titles from EDGAR
  const allTickers = await fetchEdgarTickers();

  // Step 2: filter to ETF candidates by SEC-registered name.
  // We use Yahoo Finance only for price enrichment AFTER identifying candidates,
  // so the registry is always populated even if Yahoo is unavailable.
  const ETF_KEYWORDS = [
    'etf', 'exchange-traded', 'exchange traded', 'etp',
    // Major issuers (catches ETFs whose names don't contain "etf")
    'ishares', 'spdr', 'proshares', 'wisdomtree', 'direxion',
    'invesco', 'powershares', 'graniteshares', 'vaneck', 'ark invest', 'global x',
    'vanguard', 'first trust', 'flexshares', 'xtrackers', 'pacer',
    'amplify', 'defiance', 'simplify', 'dimensional', 'columbia',
    'goldman sachs etf', 'jpmorgan etf', 'harbor etf', 'pimco etf',
  ];
  const etfCandidates = allTickers.filter(t => {
    const title = (t.title || '').toLowerCase();
    if (!title) return false;
    return ETF_KEYWORDS.some(kw => title.includes(kw));
  });
  console.log(`[import] ${etfCandidates.length} ETF candidates identified from SEC titles`);

  // Step 3: build Supabase rows directly from EDGAR data.
  // No Yahoo Finance needed — prices/AUM will be filled by update-aum.mjs.
  const etfRows = etfCandidates.map(t => {
    const { category, subCategory } = mapCategoryFromName(t.title);
    return {
      ticker:       t.ticker,
      name:         t.title || t.ticker,
      issuer:       '',
      category,
      sub_category: subCategory,
      exchange:     mapExchange('', t.exchange),
      cik:          t.cik,
      updated_at:   new Date().toISOString(),
    };
  });

  console.log(`[import] Upserting ${etfRows.length} ETF records to Supabase…`);

  // Step 4: upsert in batches of 200
  const BATCH = 200;
  let upserted = 0;

  for (let i = 0; i < etfRows.length; i += BATCH) {
    const batch = etfRows.slice(i, i + BATCH);
    const { error } = await sb.from('etfs').upsert(batch, { onConflict: 'ticker' });
    if (error) console.error(`[import] Upsert error (batch ${Math.ceil(i / BATCH) + 1}):`, error.message);
    else upserted += batch.length;
  }

  console.log(`[import] Done — ${upserted} ETFs upserted`);
  console.log(`[import] Prices/AUM will be populated by the next update-aum run.`);
  console.log(`[import] Finished — ${new Date().toISOString()}`);
}

main().catch(e => { console.error('[import] Fatal:', e); process.exit(1); });
