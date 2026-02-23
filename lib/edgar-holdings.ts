/**
 * SEC EDGAR Holdings Fetcher
 *
 * Uses two free, no-auth EDGAR APIs:
 *  1. company_tickers.json  — maps ticker → CIK
 *  2. data.sec.gov/submissions/{CIK}.json — filing history per company
 *  3. EDGAR Archives — parses NPORT-P XML for actual holdings
 *
 * Rate-limit guidance: EDGAR asks for ≤10 req/s. We add a User-Agent header.
 */

import type { Holding } from '@/types';

const EDGAR_UA = 'ETFMonitor contact@etf-monitor.app';

// ── 1. Ticker → CIK lookup ─────────────────────────────────────────────────

let _tickerMap: Record<string, string> | null = null;

async function getTickerMap(): Promise<Record<string, string>> {
  if (_tickerMap) return _tickerMap;
  try {
    const res = await fetch('https://www.sec.gov/files/company_tickers.json', {
      headers: { 'User-Agent': EDGAR_UA },
      next: { revalidate: 86400 }, // cache 24h
    });
    if (!res.ok) return {};
    const json = await res.json();
    // Shape: { "0": { cik_str: "320193", ticker: "AAPL", title: "..." }, ... }
    const map: Record<string, string> = {};
    for (const entry of Object.values(json) as { cik_str: string; ticker: string }[]) {
      map[entry.ticker.toUpperCase()] = entry.cik_str.padStart(10, '0');
    }
    _tickerMap = map;
    return map;
  } catch {
    return {};
  }
}

export async function getCik(ticker: string): Promise<string | null> {
  const map = await getTickerMap();
  return map[ticker.toUpperCase()] ?? null;
}

// ── 2. Get latest NPORT-P accession number for a CIK ─────────────────────

async function getLatestNportAccession(cik: string): Promise<string | null> {
  try {
    const res = await fetch(`https://data.sec.gov/submissions/CIK${cik}.json`, {
      headers: { 'User-Agent': EDGAR_UA },
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    const json = await res.json();

    // Recent filings are in json.filings.recent
    const recent = json?.filings?.recent;
    if (!recent) return null;

    const forms: string[]       = recent.form         ?? [];
    const accessions: string[]  = recent.accessionNumber ?? [];
    const dates: string[]       = recent.filingDate   ?? [];

    // Find most recent NPORT-P
    for (let i = 0; i < forms.length; i++) {
      if (forms[i] === 'NPORT-P') {
        return { accession: accessions[i], date: dates[i] } as unknown as string;
      }
    }

    // Check older filings if not in recent
    const older = json?.filings?.files ?? [];
    for (const file of older) {
      if (file.name?.includes('NPORT-P')) {
        // Would need another fetch; skip for now
      }
    }
    return null;
  } catch {
    return null;
  }
}

interface AccessionResult {
  accession: string;
  date: string;
}

async function getLatestNportInfo(cik: string): Promise<AccessionResult | null> {
  try {
    const res = await fetch(`https://data.sec.gov/submissions/CIK${cik}.json`, {
      headers: { 'User-Agent': EDGAR_UA },
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    const json = await res.json();

    const recent = json?.filings?.recent;
    if (!recent) return null;

    const forms: string[]      = recent.form            ?? [];
    const accessions: string[] = recent.accessionNumber  ?? [];
    const dates: string[]      = recent.filingDate       ?? [];

    for (let i = 0; i < forms.length; i++) {
      if (forms[i] === 'NPORT-P') {
        return { accession: accessions[i], date: dates[i] };
      }
    }
    return null;
  } catch {
    return null;
  }
}

// ── 3. Fetch + parse NPORT-P XML ──────────────────────────────────────────

/**
 * Parses a subset of the NPORT-P schema to extract top holdings.
 * NPORT-P uses namespace invstOrSec elements with:
 *   <name>Apple Inc</name>
 *   <pctVal>7.23</pctVal>   ← % of portfolio
 *   <valUSD>52345678</valUSD>
 *   <ticker>AAPL</ticker>   ← sometimes present
 */
function parseNportHoldings(xml: string, limit = 15): Holding[] {
  const holdings: Holding[] = [];

  // Match each <invstOrSec> block
  const blockRe = /<invstOrSec>([\s\S]*?)<\/invstOrSec>/g;
  let match: RegExpExecArray | null;

  while ((match = blockRe.exec(xml)) !== null && holdings.length < limit * 3) {
    const block = match[1];

    const name    = /<name>(.*?)<\/name>/i.exec(block)?.[1]?.trim() ?? '';
    const pctStr  = /<pctVal>(.*?)<\/pctVal>/i.exec(block)?.[1]?.trim() ?? '';
    const valStr  = /<valUSD>(.*?)<\/valUSD>/i.exec(block)?.[1]?.trim() ?? '';
    const ticker  = /<ticker>(.*?)<\/ticker>/i.exec(block)?.[1]?.trim() ?? '';

    if (!name || !pctStr) continue;

    const weight = parseFloat(pctStr);
    const value  = parseFloat(valStr) || 0;
    if (isNaN(weight) || weight <= 0) continue;

    holdings.push({ name, ticker: ticker || undefined, weight, value });
  }

  // Sort by weight desc, return top N
  holdings.sort((a, b) => b.weight - a.weight);
  return holdings.slice(0, limit);
}

// ── 4. Public function ─────────────────────────────────────────────────────

export interface HoldingsResult {
  holdings: Holding[];
  asOfDate: string;
  source: 'nport' | 'unavailable';
}

export async function fetchHoldings(ticker: string): Promise<HoldingsResult> {
  const empty: HoldingsResult = { holdings: [], asOfDate: '', source: 'unavailable' };

  // Step 1: ticker → CIK
  const cik = await getCik(ticker);
  if (!cik) return empty;

  // Step 2: CIK → latest NPORT-P accession
  const info = await getLatestNportInfo(cik);
  if (!info) return empty;

  // Step 3: fetch the actual filing document
  // Accession format: 0001234567-23-012345 → directory: 0001234567-23-012345 (dashes removed for path)
  const accPath = info.accession.replace(/-/g, '');
  const cikNum  = cik.replace(/^0+/, ''); // strip leading zeros for path
  const dirUrl  = `https://www.sec.gov/Archives/edgar/data/${cikNum}/${accPath}`;

  try {
    // NPORT-P primary document is usually named like "primary_doc.xml" or similar
    // First fetch the filing index to find the primary XML
    const indexRes = await fetch(`${dirUrl}/${info.accession}-index.htm`, {
      headers: { 'User-Agent': EDGAR_UA },
    });

    let xmlUrl = '';

    if (indexRes.ok) {
      const html = await indexRes.text();
      // Look for the primary NPORT XML document link
      const xmlMatch = /href="([^"]+\.xml)"/i.exec(html);
      if (xmlMatch) {
        xmlUrl = xmlMatch[1].startsWith('http')
          ? xmlMatch[1]
          : `https://www.sec.gov${xmlMatch[1]}`;
      }
    }

    // Fallback: try common NPORT-P file naming conventions
    if (!xmlUrl) {
      xmlUrl = `${dirUrl}/primary_doc.xml`;
    }

    const xmlRes = await fetch(xmlUrl, {
      headers: { 'User-Agent': EDGAR_UA },
      next: { revalidate: 86400 }, // holdings change monthly
    });

    if (!xmlRes.ok) return empty;

    const xml = await xmlRes.text();
    const holdings = parseNportHoldings(xml);

    if (holdings.length === 0) return empty;

    return {
      holdings,
      asOfDate: info.date,
      source: 'nport',
    };
  } catch {
    return empty;
  }
}
