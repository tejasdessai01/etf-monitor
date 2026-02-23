-- ETF Monitor — Supabase schema
-- Run this in the Supabase SQL editor (Dashboard → SQL Editor → New Query)

-- ── ETF master table ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS etfs (
  ticker          TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  issuer          TEXT,
  category        TEXT,
  sub_category    TEXT,
  aum             BIGINT,          -- USD
  expense_ratio   NUMERIC(8, 4),   -- e.g. 0.0300 = 3bps
  inception_date  DATE,
  exchange        TEXT,
  cik             TEXT,            -- SEC EDGAR CIK (10-digit padded)
  price           NUMERIC(12, 4),
  change_pct      NUMERIC(8, 4),
  description     TEXT,
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── Daily AUM snapshots ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS aum_history (
  ticker   TEXT REFERENCES etfs(ticker) ON DELETE CASCADE,
  date     DATE NOT NULL,
  aum      BIGINT,
  price    NUMERIC(12, 4),
  PRIMARY KEY (ticker, date)
);

-- ── Weekly fund flow estimates ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fund_flows (
  category        TEXT NOT NULL,
  week_ending     DATE NOT NULL,
  weekly_flow     BIGINT,          -- net USD
  monthly_flow    BIGINT,
  total_aum       BIGINT,
  etf_count       INT,
  PRIMARY KEY (category, week_ending)
);

-- ── Top holdings from EDGAR NPORT-P ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS holdings (
  etf_ticker      TEXT REFERENCES etfs(ticker) ON DELETE CASCADE,
  as_of_date      DATE NOT NULL,
  holding_name    TEXT NOT NULL,
  holding_ticker  TEXT,
  weight          NUMERIC(8, 4),   -- % of portfolio
  value_usd       BIGINT,
  PRIMARY KEY (etf_ticker, as_of_date, holding_name)
);

-- ── Indexes ─────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_etfs_category    ON etfs(category);
CREATE INDEX IF NOT EXISTS idx_etfs_issuer      ON etfs(issuer);
CREATE INDEX IF NOT EXISTS idx_aum_history_date ON aum_history(date);
CREATE INDEX IF NOT EXISTS idx_holdings_etf     ON holdings(etf_ticker, as_of_date);

-- ── Row-level security (enable if exposing anon key publicly) ───────────────
-- All tables are read-only from the anon key:
ALTER TABLE etfs         ENABLE ROW LEVEL SECURITY;
ALTER TABLE aum_history  ENABLE ROW LEVEL SECURITY;
ALTER TABLE fund_flows   ENABLE ROW LEVEL SECURITY;
ALTER TABLE holdings     ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public read" ON etfs        FOR SELECT USING (true);
CREATE POLICY "public read" ON aum_history FOR SELECT USING (true);
CREATE POLICY "public read" ON fund_flows  FOR SELECT USING (true);
CREATE POLICY "public read" ON holdings    FOR SELECT USING (true);
