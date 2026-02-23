// ─── Core ETF types ───────────────────────────────────────────────────────────

export interface ETF {
  ticker: string;
  name: string;
  issuer: string;
  category: string;         // e.g. "US Equity", "Fixed Income", "Commodities"
  subCategory?: string;     // e.g. "Large Cap Blend", "Short-Term Bond"
  aum: number;              // in USD
  expenseRatio: number;     // e.g. 0.03 = 3bps
  inceptionDate: string;    // ISO date
  exchange: string;         // NYSE Arca, NASDAQ, CBOE
  description?: string;
  // Live-enriched from Yahoo Finance
  price?: number;
  change?: number;
  changePct?: number;
  volume?: number;
  nav?: number;
}

// ─── SEC EDGAR filing ─────────────────────────────────────────────────────────

export interface Filing {
  id: string;
  formType: string;         // N-1A, 485BPOS, S-1, etc.
  entityName: string;
  filedAt: string;          // ISO date
  accessionNo: string;
  url: string;
  description?: string;
  isNew?: boolean;          // true if this is a brand-new fund registration
}

// ─── News item ────────────────────────────────────────────────────────────────

export interface NewsItem {
  id: string;
  title: string;
  source: string;
  url: string;
  publishedAt: string;      // ISO date
  snippet?: string;
  tags?: string[];
}

// ─── ETF category summary ─────────────────────────────────────────────────────

export interface CategoryStats {
  category: string;
  totalAum: number;
  etfCount: number;
  avgExpenseRatio: number;
}

// ─── Issuer summary ───────────────────────────────────────────────────────────

export interface IssuerStats {
  issuer: string;
  totalAum: number;
  etfCount: number;
  marketShare: number;      // 0-1
}

// ─── Dashboard stats ──────────────────────────────────────────────────────────

export interface DashboardStats {
  totalETFs: number;
  totalAUM: number;
  newLaunches30d: number;
  newFilings7d: number;
}

// ─── API response wrappers ────────────────────────────────────────────────────

export interface ApiResponse<T> {
  data: T;
  cached?: boolean;
  updatedAt: string;
}
