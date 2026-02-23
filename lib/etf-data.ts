import type { ETF } from '@/types';

/**
 * Curated seed list of top US ETFs.
 * AUM figures are approximate (early 2025). These are enriched with live
 * Yahoo Finance data at runtime via /api/etfs.
 *
 * Schema is designed to be extended — future background jobs will pull AUM,
 * expense ratios, and new launches from SEC EDGAR / issuer websites and
 * upsert into a Supabase DB. This static list is the authoritative fallback.
 */
export const SEED_ETFS: ETF[] = [
  // ── US Broad Equity ──────────────────────────────────────────────────────
  { ticker: 'SPY',  name: 'SPDR S&P 500 ETF Trust',              issuer: 'State Street', category: 'US Equity',      subCategory: 'Large Cap Blend',  aum: 537e9,  expenseRatio: 0.0945, inceptionDate: '1993-01-22', exchange: 'NYSE Arca' },
  { ticker: 'IVV',  name: 'iShares Core S&P 500 ETF',            issuer: 'BlackRock',    category: 'US Equity',      subCategory: 'Large Cap Blend',  aum: 507e9,  expenseRatio: 0.03,   inceptionDate: '2000-05-15', exchange: 'NYSE Arca' },
  { ticker: 'VOO',  name: 'Vanguard S&P 500 ETF',                issuer: 'Vanguard',     category: 'US Equity',      subCategory: 'Large Cap Blend',  aum: 572e9,  expenseRatio: 0.03,   inceptionDate: '2010-09-07', exchange: 'NYSE Arca' },
  { ticker: 'VTI',  name: 'Vanguard Total Stock Market ETF',     issuer: 'Vanguard',     category: 'US Equity',      subCategory: 'Total Market',     aum: 432e9,  expenseRatio: 0.03,   inceptionDate: '2001-05-24', exchange: 'NYSE Arca' },
  { ticker: 'QQQ',  name: 'Invesco QQQ Trust',                   issuer: 'Invesco',      category: 'US Equity',      subCategory: 'Large Cap Growth', aum: 286e9,  expenseRatio: 0.20,   inceptionDate: '1999-03-10', exchange: 'NASDAQ' },
  { ticker: 'QQQM', name: 'Invesco NASDAQ 100 ETF',              issuer: 'Invesco',      category: 'US Equity',      subCategory: 'Large Cap Growth', aum: 32e9,   expenseRatio: 0.15,   inceptionDate: '2020-10-13', exchange: 'NASDAQ' },
  { ticker: 'IWM',  name: 'iShares Russell 2000 ETF',            issuer: 'BlackRock',    category: 'US Equity',      subCategory: 'Small Cap Blend',  aum: 65e9,   expenseRatio: 0.19,   inceptionDate: '2000-05-22', exchange: 'NYSE Arca' },
  { ticker: 'VUG',  name: 'Vanguard Growth ETF',                 issuer: 'Vanguard',     category: 'US Equity',      subCategory: 'Large Cap Growth', aum: 130e9,  expenseRatio: 0.04,   inceptionDate: '2004-01-26', exchange: 'NYSE Arca' },
  { ticker: 'VTV',  name: 'Vanguard Value ETF',                  issuer: 'Vanguard',     category: 'US Equity',      subCategory: 'Large Cap Value',  aum: 110e9,  expenseRatio: 0.04,   inceptionDate: '2004-01-26', exchange: 'NYSE Arca' },
  { ticker: 'ITOT', name: 'iShares Core S&P Total US Stock ETF', issuer: 'BlackRock',    category: 'US Equity',      subCategory: 'Total Market',     aum: 60e9,   expenseRatio: 0.03,   inceptionDate: '2004-01-20', exchange: 'NYSE Arca' },
  { ticker: 'SCHB', name: 'Schwab US Broad Market ETF',          issuer: 'Schwab',       category: 'US Equity',      subCategory: 'Total Market',     aum: 31e9,   expenseRatio: 0.03,   inceptionDate: '2009-11-03', exchange: 'NYSE Arca' },
  { ticker: 'SCHX', name: 'Schwab US Large-Cap ETF',             issuer: 'Schwab',       category: 'US Equity',      subCategory: 'Large Cap Blend',  aum: 44e9,   expenseRatio: 0.03,   inceptionDate: '2009-11-03', exchange: 'NYSE Arca' },
  { ticker: 'RSP',  name: 'Invesco S&P 500 Equal Weight ETF',    issuer: 'Invesco',      category: 'US Equity',      subCategory: 'Large Cap Blend',  aum: 60e9,   expenseRatio: 0.20,   inceptionDate: '2003-04-24', exchange: 'NYSE Arca' },
  { ticker: 'MGK',  name: 'Vanguard Mega Cap Growth ETF',        issuer: 'Vanguard',     category: 'US Equity',      subCategory: 'Mega Cap Growth',  aum: 20e9,   expenseRatio: 0.07,   inceptionDate: '2007-12-17', exchange: 'NYSE Arca' },

  // ── Sector ───────────────────────────────────────────────────────────────
  { ticker: 'XLK',  name: 'Technology Select Sector SPDR Fund',  issuer: 'State Street', category: 'Sector',         subCategory: 'Technology',       aum: 72e9,   expenseRatio: 0.09,   inceptionDate: '1998-12-16', exchange: 'NYSE Arca' },
  { ticker: 'XLF',  name: 'Financial Select Sector SPDR Fund',   issuer: 'State Street', category: 'Sector',         subCategory: 'Financials',       aum: 45e9,   expenseRatio: 0.09,   inceptionDate: '1998-12-16', exchange: 'NYSE Arca' },
  { ticker: 'XLE',  name: 'Energy Select Sector SPDR Fund',      issuer: 'State Street', category: 'Sector',         subCategory: 'Energy',           aum: 35e9,   expenseRatio: 0.09,   inceptionDate: '1998-12-16', exchange: 'NYSE Arca' },
  { ticker: 'XLV',  name: 'Health Care Select Sector SPDR Fund', issuer: 'State Street', category: 'Sector',         subCategory: 'Health Care',      aum: 38e9,   expenseRatio: 0.09,   inceptionDate: '1998-12-16', exchange: 'NYSE Arca' },
  { ticker: 'XLI',  name: 'Industrial Select Sector SPDR Fund',  issuer: 'State Street', category: 'Sector',         subCategory: 'Industrials',      aum: 24e9,   expenseRatio: 0.09,   inceptionDate: '1998-12-16', exchange: 'NYSE Arca' },
  { ticker: 'XLC',  name: 'Communication Services Select Sector',issuer: 'State Street', category: 'Sector',         subCategory: 'Comm. Services',   aum: 20e9,   expenseRatio: 0.09,   inceptionDate: '2018-06-18', exchange: 'NYSE Arca' },
  { ticker: 'VGT',  name: 'Vanguard Information Technology ETF', issuer: 'Vanguard',     category: 'Sector',         subCategory: 'Technology',       aum: 72e9,   expenseRatio: 0.10,   inceptionDate: '2004-01-26', exchange: 'NYSE Arca' },
  { ticker: 'SOXX', name: 'iShares Semiconductor ETF',           issuer: 'BlackRock',    category: 'Sector',         subCategory: 'Semiconductors',   aum: 14e9,   expenseRatio: 0.35,   inceptionDate: '2001-07-10', exchange: 'NASDAQ' },
  { ticker: 'SMH',  name: 'VanEck Semiconductor ETF',            issuer: 'VanEck',       category: 'Sector',         subCategory: 'Semiconductors',   aum: 21e9,   expenseRatio: 0.35,   inceptionDate: '2000-05-05', exchange: 'NASDAQ' },
  { ticker: 'IBB',  name: 'iShares Biotechnology ETF',           issuer: 'BlackRock',    category: 'Sector',         subCategory: 'Biotechnology',    aum: 8e9,    expenseRatio: 0.44,   inceptionDate: '2001-02-05', exchange: 'NASDAQ' },

  // ── Fixed Income ─────────────────────────────────────────────────────────
  { ticker: 'BND',  name: 'Vanguard Total Bond Market ETF',      issuer: 'Vanguard',     category: 'Fixed Income',   subCategory: 'Broad Bond',       aum: 116e9,  expenseRatio: 0.03,   inceptionDate: '2007-04-03', exchange: 'NYSE Arca' },
  { ticker: 'AGG',  name: 'iShares Core U.S. Aggregate Bond ETF',issuer: 'BlackRock',    category: 'Fixed Income',   subCategory: 'Broad Bond',       aum: 107e9,  expenseRatio: 0.03,   inceptionDate: '2003-09-22', exchange: 'NYSE Arca' },
  { ticker: 'VCIT', name: 'Vanguard Intermediate-Term Corp ETF', issuer: 'Vanguard',     category: 'Fixed Income',   subCategory: 'Corp Bond',        aum: 45e9,   expenseRatio: 0.04,   inceptionDate: '2009-11-19', exchange: 'NYSE Arca' },
  { ticker: 'LQD',  name: 'iShares iBoxx $ Investment Grade Corp',issuer: 'BlackRock',   category: 'Fixed Income',   subCategory: 'Corp Bond',        aum: 33e9,   expenseRatio: 0.14,   inceptionDate: '2002-07-22', exchange: 'NYSE Arca' },
  { ticker: 'TLT',  name: 'iShares 20+ Year Treasury Bond ETF',  issuer: 'BlackRock',    category: 'Fixed Income',   subCategory: 'Long-Term Treasury',aum: 53e9,  expenseRatio: 0.15,   inceptionDate: '2002-07-22', exchange: 'NASDAQ' },
  { ticker: 'SHY',  name: 'iShares 1-3 Year Treasury Bond ETF',  issuer: 'BlackRock',    category: 'Fixed Income',   subCategory: 'Short-Term Treasury',aum: 25e9,  expenseRatio: 0.15,   inceptionDate: '2002-07-22', exchange: 'NASDAQ' },
  { ticker: 'SGOV', name: 'iShares 0-3 Month Treasury Bond ETF', issuer: 'BlackRock',    category: 'Fixed Income',   subCategory: 'Ultra Short',      aum: 35e9,   expenseRatio: 0.09,   inceptionDate: '2020-05-26', exchange: 'CBOE' },
  { ticker: 'GOVT', name: 'iShares U.S. Treasury Bond ETF',      issuer: 'BlackRock',    category: 'Fixed Income',   subCategory: 'Treasury',         aum: 26e9,   expenseRatio: 0.05,   inceptionDate: '2012-02-14', exchange: 'NYSE Arca' },
  { ticker: 'MUB',  name: 'iShares National Muni Bond ETF',      issuer: 'BlackRock',    category: 'Fixed Income',   subCategory: 'Municipal',        aum: 37e9,   expenseRatio: 0.05,   inceptionDate: '2007-09-07', exchange: 'NYSE Arca' },
  { ticker: 'HYG',  name: 'iShares iBoxx $ High Yield Corp ETF', issuer: 'BlackRock',    category: 'Fixed Income',   subCategory: 'High Yield',       aum: 14e9,   expenseRatio: 0.48,   inceptionDate: '2007-04-04', exchange: 'NYSE Arca' },
  { ticker: 'JNK',  name: 'SPDR Bloomberg High Yield Bond ETF',  issuer: 'State Street', category: 'Fixed Income',   subCategory: 'High Yield',       aum: 9e9,    expenseRatio: 0.40,   inceptionDate: '2007-11-28', exchange: 'NYSE Arca' },

  // ── Commodities ──────────────────────────────────────────────────────────
  { ticker: 'GLD',  name: 'SPDR Gold Shares',                    issuer: 'State Street', category: 'Commodities',    subCategory: 'Gold',             aum: 78e9,   expenseRatio: 0.40,   inceptionDate: '2004-11-18', exchange: 'NYSE Arca' },
  { ticker: 'IAU',  name: 'iShares Gold Trust',                  issuer: 'BlackRock',    category: 'Commodities',    subCategory: 'Gold',             aum: 33e9,   expenseRatio: 0.25,   inceptionDate: '2005-01-21', exchange: 'NYSE Arca' },
  { ticker: 'SLV',  name: 'iShares Silver Trust',                issuer: 'BlackRock',    category: 'Commodities',    subCategory: 'Silver',           aum: 12e9,   expenseRatio: 0.50,   inceptionDate: '2006-04-21', exchange: 'NYSE Arca' },
  { ticker: 'GDX',  name: 'VanEck Gold Miners ETF',              issuer: 'VanEck',       category: 'Commodities',    subCategory: 'Gold Miners',      aum: 14e9,   expenseRatio: 0.51,   inceptionDate: '2006-05-16', exchange: 'NYSE Arca' },
  { ticker: 'USO',  name: 'United States Oil Fund',              issuer: 'USCF',         category: 'Commodities',    subCategory: 'Oil',              aum: 1.5e9,  expenseRatio: 0.72,   inceptionDate: '2006-04-10', exchange: 'NYSE Arca' },
  { ticker: 'PDBC', name: 'Invesco Optimum Yield Diversified Commodity', issuer: 'Invesco', category: 'Commodities', subCategory: 'Broad',            aum: 4e9,    expenseRatio: 0.59,   inceptionDate: '2014-11-07', exchange: 'NASDAQ' },

  // ── International ─────────────────────────────────────────────────────────
  { ticker: 'IEFA', name: 'iShares Core MSCI EAFE ETF',          issuer: 'BlackRock',    category: 'International',  subCategory: 'Developed Markets',aum: 113e9,  expenseRatio: 0.07,   inceptionDate: '2012-10-18', exchange: 'CBOE' },
  { ticker: 'VEA',  name: 'Vanguard FTSE Developed Markets ETF', issuer: 'Vanguard',     category: 'International',  subCategory: 'Developed Markets',aum: 107e9,  expenseRatio: 0.06,   inceptionDate: '2007-07-20', exchange: 'NYSE Arca' },
  { ticker: 'VWO',  name: 'Vanguard FTSE Emerging Markets ETF',  issuer: 'Vanguard',     category: 'International',  subCategory: 'Emerging Markets', aum: 70e9,   expenseRatio: 0.08,   inceptionDate: '2005-03-04', exchange: 'NYSE Arca' },
  { ticker: 'EEM',  name: 'iShares MSCI Emerging Markets ETF',   issuer: 'BlackRock',    category: 'International',  subCategory: 'Emerging Markets', aum: 17e9,   expenseRatio: 0.70,   inceptionDate: '2003-04-07', exchange: 'NYSE Arca' },
  { ticker: 'EFA',  name: 'iShares MSCI EAFE ETF',               issuer: 'BlackRock',    category: 'International',  subCategory: 'Developed Markets',aum: 51e9,   expenseRatio: 0.32,   inceptionDate: '2001-08-14', exchange: 'NASDAQ' },
  { ticker: 'FXI',  name: 'iShares China Large-Cap ETF',         issuer: 'BlackRock',    category: 'International',  subCategory: 'China',            aum: 5e9,    expenseRatio: 0.74,   inceptionDate: '2004-10-05', exchange: 'NYSE Arca' },

  // ── Real Estate ──────────────────────────────────────────────────────────
  { ticker: 'VNQ',  name: 'Vanguard Real Estate ETF',            issuer: 'Vanguard',     category: 'Real Estate',    subCategory: 'Diversified REIT', aum: 33e9,   expenseRatio: 0.13,   inceptionDate: '2004-09-23', exchange: 'NYSE Arca' },
  { ticker: 'SCHH', name: 'Schwab US REIT ETF',                  issuer: 'Schwab',       category: 'Real Estate',    subCategory: 'Diversified REIT', aum: 7e9,    expenseRatio: 0.07,   inceptionDate: '2011-01-13', exchange: 'NYSE Arca' },
  { ticker: 'IYR',  name: 'iShares US Real Estate ETF',          issuer: 'BlackRock',    category: 'Real Estate',    subCategory: 'Diversified REIT', aum: 3e9,    expenseRatio: 0.39,   inceptionDate: '2000-06-12', exchange: 'NYSE Arca' },

  // ── Thematic / Active / Crypto ───────────────────────────────────────────
  { ticker: 'ARKK', name: 'ARK Innovation ETF',                  issuer: 'ARK Invest',   category: 'Thematic',       subCategory: 'Disruptive Innovation', aum: 7e9, expenseRatio: 0.75, inceptionDate: '2014-10-31', exchange: 'NYSE Arca' },
  { ticker: 'ARKW', name: 'ARK Next Generation Internet ETF',    issuer: 'ARK Invest',   category: 'Thematic',       subCategory: 'Next Gen Internet', aum: 1.5e9,  expenseRatio: 0.88,   inceptionDate: '2014-09-29', exchange: 'NYSE Arca' },
  { ticker: 'IBIT', name: 'iShares Bitcoin Trust ETF',           issuer: 'BlackRock',    category: 'Digital Assets', subCategory: 'Bitcoin',          aum: 50e9,   expenseRatio: 0.25,   inceptionDate: '2024-01-11', exchange: 'NASDAQ' },
  { ticker: 'FBTC', name: 'Fidelity Wise Origin Bitcoin Fund',   issuer: 'Fidelity',     category: 'Digital Assets', subCategory: 'Bitcoin',          aum: 20e9,   expenseRatio: 0.25,   inceptionDate: '2024-01-11', exchange: 'CBOE' },
  { ticker: 'GBTC', name: 'Grayscale Bitcoin Trust ETF',         issuer: 'Grayscale',    category: 'Digital Assets', subCategory: 'Bitcoin',          aum: 18e9,   expenseRatio: 1.50,   inceptionDate: '2013-09-25', exchange: 'NYSE Arca' },
  { ticker: 'BITO', name: 'ProShares Bitcoin Strategy ETF',      issuer: 'ProShares',    category: 'Digital Assets', subCategory: 'Bitcoin Futures',  aum: 2e9,    expenseRatio: 0.95,   inceptionDate: '2021-10-19', exchange: 'NYSE Arca' },
  { ticker: 'ETHA', name: 'iShares Ethereum Trust ETF',          issuer: 'BlackRock',    category: 'Digital Assets', subCategory: 'Ethereum',         aum: 3e9,    expenseRatio: 0.25,   inceptionDate: '2024-07-23', exchange: 'NASDAQ' },

  // ── Dividend / Income ────────────────────────────────────────────────────
  { ticker: 'VYM',  name: 'Vanguard High Dividend Yield ETF',    issuer: 'Vanguard',     category: 'US Equity',      subCategory: 'High Dividend',    aum: 55e9,   expenseRatio: 0.06,   inceptionDate: '2006-11-10', exchange: 'NYSE Arca' },
  { ticker: 'DVY',  name: 'iShares Select Dividend ETF',         issuer: 'BlackRock',    category: 'US Equity',      subCategory: 'High Dividend',    aum: 14e9,   expenseRatio: 0.38,   inceptionDate: '2003-11-03', exchange: 'NASDAQ' },
  { ticker: 'SCHD', name: 'Schwab US Dividend Equity ETF',       issuer: 'Schwab',       category: 'US Equity',      subCategory: 'Dividend Growth',  aum: 66e9,   expenseRatio: 0.06,   inceptionDate: '2011-10-20', exchange: 'NYSE Arca' },
  { ticker: 'DGRO', name: 'iShares Core Dividend Growth ETF',    issuer: 'BlackRock',    category: 'US Equity',      subCategory: 'Dividend Growth',  aum: 27e9,   expenseRatio: 0.08,   inceptionDate: '2014-06-10', exchange: 'NYSE Arca' },

  // ── Leveraged / Inverse ──────────────────────────────────────────────────
  { ticker: 'TQQQ', name: 'ProShares UltraPro QQQ',              issuer: 'ProShares',    category: 'Leveraged',      subCategory: '3x Nasdaq-100',    aum: 22e9,   expenseRatio: 0.88,   inceptionDate: '2010-02-09', exchange: 'NASDAQ' },
  { ticker: 'SQQQ', name: 'ProShares UltraPro Short QQQ',        issuer: 'ProShares',    category: 'Leveraged',      subCategory: '-3x Nasdaq-100',   aum: 4e9,    expenseRatio: 0.95,   inceptionDate: '2010-02-09', exchange: 'NASDAQ' },
  { ticker: 'SPXU', name: 'ProShares UltraPro Short S&P500',     issuer: 'ProShares',    category: 'Leveraged',      subCategory: '-3x S&P 500',      aum: 0.7e9,  expenseRatio: 0.91,   inceptionDate: '2009-06-23', exchange: 'NYSE Arca' },
  { ticker: 'UPRO', name: 'ProShares UltraPro S&P500',           issuer: 'ProShares',    category: 'Leveraged',      subCategory: '3x S&P 500',       aum: 3.5e9,  expenseRatio: 0.92,   inceptionDate: '2009-06-23', exchange: 'NYSE Arca' },

  // ── Multi-Asset / Allocation ─────────────────────────────────────────────
  { ticker: 'AOA',  name: 'iShares Core Aggressive Alloc ETF',   issuer: 'BlackRock',    category: 'Multi-Asset',    subCategory: 'Aggressive Alloc', aum: 1.8e9,  expenseRatio: 0.15,   inceptionDate: '2008-11-04', exchange: 'NYSE Arca' },
  { ticker: 'AOR',  name: 'iShares Core Growth Allocation ETF',  issuer: 'BlackRock',    category: 'Multi-Asset',    subCategory: 'Growth Alloc',     aum: 1.8e9,  expenseRatio: 0.15,   inceptionDate: '2008-11-04', exchange: 'NYSE Arca' },

  // ── ESG ──────────────────────────────────────────────────────────────────
  { ticker: 'ESGU', name: 'iShares MSCI USA ESG Optimized ETF',  issuer: 'BlackRock',    category: 'ESG',            subCategory: 'US ESG',           aum: 15e9,   expenseRatio: 0.15,   inceptionDate: '2016-12-01', exchange: 'NASDAQ' },
  { ticker: 'ESGV', name: 'Vanguard ESG US Stock ETF',           issuer: 'Vanguard',     category: 'ESG',            subCategory: 'US ESG',           aum: 8e9,    expenseRatio: 0.09,   inceptionDate: '2018-09-18', exchange: 'CBOE' },
];

/**
 * Top ETF Twitter / X accounts for the Social panel.
 * No API needed — just links.
 */
export const ETF_SOCIAL_ACCOUNTS = [
  { handle: 'EricBalchunas',  name: 'Eric Balchunas',     role: 'Bloomberg ETF Analyst',      url: 'https://twitter.com/EricBalchunas' },
  { handle: 'nategaraci',     name: 'Nate Geraci',        role: 'ETF Store President',        url: 'https://twitter.com/nategaraci' },
  { handle: 'Dave_Nadig',     name: 'Dave Nadig',         role: 'Financial Futurist',         url: 'https://twitter.com/Dave_Nadig' },
  { handle: 'KatieStockton',  name: 'Katie Stockton',     role: 'Fairlead Strategies',        url: 'https://twitter.com/KatieStockton' },
  { handle: 'GeraldOLeary',   name: 'Gerald O\'Leary',    role: 'ETF Action CEO',             url: 'https://twitter.com/GeraldOLeary' },
  { handle: 'JPMorganAM',     name: 'J.P. Morgan AM',     role: 'Issuer',                     url: 'https://twitter.com/JPMorganAM' },
  { handle: 'BlackRock',      name: 'BlackRock',          role: 'Largest ETF Issuer',         url: 'https://twitter.com/BlackRock' },
  { handle: 'Vanguard_Group', name: 'Vanguard',           role: 'ETF Issuer',                 url: 'https://twitter.com/Vanguard_Group' },
];

/**
 * Category colour mapping for badges.
 */
export const CATEGORY_COLORS: Record<string, string> = {
  'US Equity':      '#3b82f6',
  'Fixed Income':   '#a855f7',
  'Commodities':    '#eab308',
  'International':  '#06b6d4',
  'Real Estate':    '#f97316',
  'Sector':         '#22c55e',
  'Thematic':       '#ec4899',
  'Digital Assets': '#f59e0b',
  'Leveraged':      '#ef4444',
  'Multi-Asset':    '#64748b',
  'ESG':            '#10b981',
};

export const ALL_TICKERS = SEED_ETFS.map(e => e.ticker);

export const TICKER_CHUNKS = (size: number) => {
  const chunks: string[][] = [];
  for (let i = 0; i < ALL_TICKERS.length; i += size) {
    chunks.push(ALL_TICKERS.slice(i, i + size));
  }
  return chunks;
};
