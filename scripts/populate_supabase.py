#!/usr/bin/env python3
"""
populate_supabase.py
====================
Fetches every US-listed ETF from SEC EDGAR and upserts them into Supabase.
Also writes estimated fund_flow rows so that panel isn't empty.

Run from the repo root:
    python3 scripts/populate_supabase.py

Credentials are read from .env.local automatically, or from env vars:
    NEXT_PUBLIC_SUPABASE_URL=...
    SUPABASE_SERVICE_KEY=...
"""

import json
import os
import re
import sys
import time
import urllib.request
import urllib.parse
import urllib.error
from datetime import date, timedelta
from pathlib import Path

# ── Load credentials ──────────────────────────────────────────────────────────

def load_env():
    env = {}
    env_file = Path(__file__).parent.parent / ".env.local"
    if env_file.exists():
        for line in env_file.read_text().splitlines():
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            if "=" in line:
                k, v = line.split("=", 1)
                env[k.strip()] = v.strip()
    env.update(os.environ)
    return env

ENV = load_env()
SUPABASE_URL = ENV.get("NEXT_PUBLIC_SUPABASE_URL", "").rstrip("/")
SUPABASE_KEY = ENV.get("SUPABASE_SERVICE_KEY") or ENV.get("NEXT_PUBLIC_SUPABASE_ANON_KEY", "")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("ERROR: Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_KEY")
    print("       These should be in .env.local or set as environment variables.")
    sys.exit(1)

print(f"Using Supabase: {SUPABASE_URL}")
print(f"Key prefix:     {SUPABASE_KEY[:20]}...")

# ── HTTP helpers ──────────────────────────────────────────────────────────────

EDGAR_UA = "ETFMonitor contact@etf-monitor.app"

def get_json(url, headers=None, retries=3):
    """Fetch a JSON URL with retries."""
    hdrs = {"User-Agent": EDGAR_UA, "Accept": "application/json"}
    if headers:
        hdrs.update(headers)
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers=hdrs)
            with urllib.request.urlopen(req, timeout=30) as r:
                return json.loads(r.read().decode())
        except Exception as e:
            if attempt < retries - 1:
                time.sleep(2 ** attempt)
            else:
                raise
    return None

def supabase_upsert(table, rows, on_conflict="ticker", batch_size=500):
    """Upsert rows into a Supabase table via the PostgREST REST API."""
    url = f"{SUPABASE_URL}/rest/v1/{table}"
    headers = {
        "apikey":        SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type":  "application/json",
        "Prefer":        f"resolution=merge-duplicates,return=minimal",
    }
    total, errors = 0, 0
    for i in range(0, len(rows), batch_size):
        batch = rows[i : i + batch_size]
        body = json.dumps(batch).encode()
        req = urllib.request.Request(
            url,
            data=body,
            headers=headers,
            method="POST",
        )
        # Add upsert param
        req.full_url = url + f"?on_conflict={on_conflict}"
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                total += len(batch)
                print(f"  batch {i//batch_size + 1}: upserted {len(batch)} rows (status {r.status})", flush=True)
        except urllib.error.HTTPError as e:
            body_err = e.read().decode()[:500]
            print(f"  ERROR batch {i//batch_size + 1}: HTTP {e.code} — {body_err}")
            errors += 1
        except Exception as e:
            print(f"  ERROR batch {i//batch_size + 1}: {e}")
            errors += 1
    return total, errors

def supabase_count(table):
    """Return row count for a table."""
    url = f"{SUPABASE_URL}/rest/v1/{table}?select=ticker"
    headers = {
        "apikey":        SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Prefer":        "count=exact",
        "Range":         "0-0",
    }
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            cr = r.headers.get("Content-Range", "")
            # Content-Range: 0-0/3421
            m = re.search(r"/(\d+)$", cr)
            return int(m.group(1)) if m else "?"
    except Exception as e:
        return f"error: {e}"

# ── Category mapping from name ────────────────────────────────────────────────

def map_category(name):
    n = name.lower()
    if re.search(r"bitcoin|ethereum|crypto|blockchain|digital asset", n):
        return "Digital Assets", "Digital Assets"
    if re.search(r"ultra pro|ultrashort|ultra short|leveraged|2x |3x |bull 3x|bear 3x", n):
        return "Leveraged", "Leveraged"
    if re.search(r"inverse|short s&p|short nasdaq|bear 1x|bear 2x", n):
        return "Leveraged", "Inverse"
    if re.search(r"\bgold\b|\bsilver\b|precious metal", n):
        return "Commodities", "Precious Metals"
    if re.search(r"\boil\b|natural gas|commodit|energy trust", n):
        return "Commodities", "Broad"
    if re.search(r"real estate|\breit\b", n):
        return "Real Estate", "Diversified REIT"
    if re.search(r"treasury|government bond|govt bond|t-bill|t-bond", n):
        return "Fixed Income", "Treasury"
    if re.search(r"high yield|junk bond", n):
        return "Fixed Income", "High Yield"
    if re.search(r"muni|municipal", n):
        return "Fixed Income", "Municipal"
    if re.search(r"corporate bond|corp bond|investment grade", n):
        return "Fixed Income", "Corp Bond"
    if re.search(r"inflation|\btips\b", n):
        return "Fixed Income", "Inflation-Protected"
    if re.search(r"aggregate bond|total bond|bond market|bond fund|\bbond\b|fixed income", n):
        return "Fixed Income", "Broad Bond"
    if re.search(r"emerging market|developing market", n):
        return "International", "Emerging Markets"
    if re.search(r"\bchina\b|\bchinese\b", n):
        return "International", "China"
    if re.search(r"\bjapan\b|\bjapanese\b", n):
        return "International", "Japan"
    if re.search(r"\beurope\b|\beuropean\b", n):
        return "International", "Europe"
    if re.search(r"\bindia\b|\bindian\b", n):
        return "International", "India"
    if re.search(r"international|foreign|global|world|\beafe\b|ex-us", n):
        return "International", "Developed Markets"
    if re.search(r"semiconductor", n):
        return "Sector", "Semiconductors"
    if re.search(r"technology|tech etf|tech fund", n):
        return "Sector", "Technology"
    if re.search(r"biotech|health care|healthcare|pharmaceutical|medical", n):
        return "Sector", "Health Care"
    if re.search(r"financial|banking sector", n):
        return "Sector", "Financials"
    if re.search(r"\bconsumer\b", n):
        return "Sector", "Consumer"
    if re.search(r"industrial", n):
        return "Sector", "Industrials"
    if re.search(r"material|metals.mining", n):
        return "Sector", "Materials"
    if re.search(r"utilit", n):
        return "Sector", "Utilities"
    if re.search(r"communication|telecom", n):
        return "Sector", "Comm. Services"
    if re.search(r"\besg\b|sustainable|socially responsible|environmental", n):
        return "ESG", "ESG"
    if re.search(r"dividend", n):
        return "US Equity", "Dividend"
    if re.search(r"small.cap|russell 2000|s&p smallcap|small cap", n):
        return "US Equity", "Small Cap Blend"
    if re.search(r"mid.cap|russell midcap|s&p midcap|mid cap", n):
        return "US Equity", "Mid Cap Blend"
    if re.search(r"large.cap|s&p 500|total market|total stock|total us", n):
        return "US Equity", "Large Cap Blend"
    if re.search(r"\bgrowth\b", n):
        return "US Equity", "Large Cap Growth"
    if re.search(r"\bvalue\b", n):
        return "US Equity", "Large Cap Value"
    if re.search(r"allocation|balanced|target.?date|retirement", n):
        return "Multi-Asset", "Allocation"
    return "US Equity", "US Equity"

def map_exchange(code, full=""):
    n = (full or code).lower()
    if "nyse arca" in n or code == "PCX":
        return "NYSE Arca"
    if "nasdaq" in n or code in ("NMS", "NGM"):
        return "NASDAQ"
    if "cboe" in n or code == "BZX":
        return "CBOE"
    if "nyse" in n or code == "NYQ":
        return "NYSE"
    return full or code or "Unknown"

# ── ETF keyword filter ────────────────────────────────────────────────────────

ETF_KEYWORDS = [
    "etf", "exchange-traded", "exchange traded", "etp",
    "ishares", "spdr", "proshares", "wisdomtree", "direxion",
    "invesco", "powershares", "graniteshares", "vaneck", "ark invest", "global x",
    "vanguard", "first trust", "flexshares", "xtrackers", "pacer",
    "amplify", "defiance", "simplify", "dimensional",
    "goldman sachs etf", "jpmorgan etf", "harbor etf", "pimco etf",
    "nuveen etf", "blackrock etf", "fidelity etf", "schwab etf",
]

def is_etf(title):
    t = title.lower()
    return any(kw in t for kw in ETF_KEYWORDS)

# ── Issuer extraction ─────────────────────────────────────────────────────────

ISSUER_PATTERNS = [
    (r"ishares",            "BlackRock iShares"),
    (r"vanguard",           "Vanguard"),
    (r"spdr|state street",  "State Street SPDR"),
    (r"invesco|powershares","Invesco"),
    (r"proshares",          "ProShares"),
    (r"wisdomtree",         "WisdomTree"),
    (r"direxion",           "Direxion"),
    (r"vaneck",             "VanEck"),
    (r"ark invest|ark etf", "ARK Invest"),
    (r"global x",           "Global X"),
    (r"first trust",        "First Trust"),
    (r"dimensional",        "Dimensional"),
    (r"flexshares",         "FlexShares"),
    (r"xtrackers|dws",      "Xtrackers"),
    (r"graniteshares",      "GraniteShares"),
    (r"amplify",            "Amplify"),
    (r"defiance",           "Defiance"),
    (r"simplify",           "Simplify"),
    (r"pacer",              "Pacer"),
    (r"goldman sachs",      "Goldman Sachs"),
    (r"jpmorgan|j\.p\.",    "JPMorgan"),
    (r"pimco",              "PIMCO"),
    (r"fidelity",           "Fidelity"),
    (r"schwab",             "Schwab"),
    (r"blackrock",          "BlackRock"),
    (r"nuveen",             "Nuveen"),
    (r"columbia",           "Columbia"),
    (r"harbor",             "Harbor"),
]

def extract_issuer(title):
    t = title.lower()
    for pattern, brand in ISSUER_PATTERNS:
        if re.search(pattern, t):
            return brand
    return ""

# ── Step 1: Fetch all EDGAR tickers ──────────────────────────────────────────

def fetch_edgar_tickers():
    print("\n[1/4] Fetching SEC EDGAR exchange ticker list...")
    data_ex = get_json("https://www.sec.gov/files/company_tickers_exchange.json")
    print("[1/4] Fetching SEC EDGAR company titles...")
    data_titles = get_json("https://www.sec.gov/files/company_tickers.json")

    # Build ticker → title map
    title_map = {}
    if isinstance(data_titles, dict):
        fields = data_titles.get("fields")
        rows   = data_titles.get("data")
        if fields and rows:
            ti = fields.index("ticker")
            tt = fields.index("title")
            for row in rows:
                ticker = str(row[ti]).upper()
                title_map[ticker] = row[tt] or ""
        else:
            # object-map format
            for entry in data_titles.values():
                if isinstance(entry, dict) and entry.get("ticker"):
                    title_map[entry["ticker"].upper()] = entry.get("title", "")

    print(f"       Loaded {len(title_map):,} company titles")

    # Parse exchange list
    VALID_EXCHANGES = {"Nasdaq", "NYSE", "NYSE MKT", "NYSE Arca", "CBOE"}
    tickers = []
    fields = data_ex.get("fields", [])
    rows   = data_ex.get("data", [])
    if fields and rows:
        fi_ticker   = fields.index("ticker")
        fi_cik      = fields.index("cik_str")
        fi_exchange = fields.index("exchange")
        for row in rows:
            exchange = row[fi_exchange]
            ticker   = str(row[fi_ticker]).upper()
            if exchange in VALID_EXCHANGES and ticker:
                cik = str(row[fi_cik]).zfill(10)
                title = title_map.get(ticker, "")
                tickers.append({"ticker": ticker, "cik": cik,
                                 "exchange": exchange, "title": title})
    else:
        for entry in data_ex.values():
            if isinstance(entry, dict):
                exchange = entry.get("exchange", "")
                ticker   = entry.get("ticker", "").upper()
                if exchange in VALID_EXCHANGES and ticker:
                    cik = str(entry.get("cik_str", "")).zfill(10)
                    title = title_map.get(ticker, "")
                    tickers.append({"ticker": ticker, "cik": cik,
                                     "exchange": exchange, "title": title})

    print(f"       {len(tickers):,} exchange-listed tickers found")
    return tickers

# ── Step 2: Filter to ETF candidates ─────────────────────────────────────────

def filter_etfs(tickers):
    print("\n[2/4] Filtering to ETF candidates...")
    candidates = [t for t in tickers if t["title"] and is_etf(t["title"])]
    print(f"       {len(candidates):,} ETF candidates identified")
    return candidates

# ── Step 3: Build Supabase rows ───────────────────────────────────────────────

def build_rows(candidates):
    print("\n[3/4] Building Supabase rows...")
    now = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    rows = []
    for t in candidates:
        cat, sub = map_category(t["title"])
        rows.append({
            "ticker":       t["ticker"],
            "name":         t["title"] or t["ticker"],
            "issuer":       extract_issuer(t["title"]),
            "category":     cat,
            "sub_category": sub,
            "exchange":     map_exchange("", t["exchange"]),
            "cik":          t["cik"],
            "updated_at":   now,
        })
    print(f"       {len(rows):,} rows ready")
    return rows

# ── Step 4: Upsert to Supabase ────────────────────────────────────────────────

def upsert_etfs(rows):
    print(f"\n[4/4] Upserting {len(rows):,} ETFs to Supabase (batches of 500)...")
    total, errors = supabase_upsert("etfs", rows, on_conflict="ticker", batch_size=500)
    print(f"       Done: {total:,} upserted, {errors} errors")
    return errors == 0

# ── Bonus: seed fund_flows with estimated weekly data ─────────────────────────

CATEGORIES = [
    ("US Equity",      6_200_000_000_000, 1_200),
    ("Fixed Income",   1_400_000_000_000,   650),
    ("Sector",           680_000_000_000,   680),
    ("International",    700_000_000_000,   310),
    ("Commodities",      140_000_000_000,   120),
    ("Real Estate",       70_000_000_000,    60),
    ("Leveraged",        110_000_000_000,   280),
    ("Thematic",          90_000_000_000,   320),
    ("ESG",               55_000_000_000,   110),
    ("Digital Assets",    65_000_000_000,    30),
    ("Multi-Asset",       25_000_000_000,    40),
]

WEEKLY_FLOWS = {
    "US Equity":      3_500_000_000,
    "Fixed Income":   1_800_000_000,
    "Sector":           200_000_000,
    "International":    400_000_000,
    "Commodities":     -100_000_000,
    "Real Estate":     -150_000_000,
    "Leveraged":       -250_000_000,
    "Thematic":        -100_000_000,
    "ESG":               50_000_000,
    "Digital Assets": 1_200_000_000,
    "Multi-Asset":       80_000_000,
}

def seed_fund_flows():
    print("\n[bonus] Seeding fund_flows table with 8 weeks of estimated data...")
    today = date.today()
    # Align to last Friday
    days_since_fri = (today.weekday() - 4) % 7
    last_friday = today - timedelta(days=days_since_fri)

    rows = []
    for week_offset in range(8):
        week_ending = (last_friday - timedelta(weeks=week_offset)).isoformat()
        # Add some randomness via a simple hash so each week varies slightly
        seed = week_offset * 7
        for cat, total_aum, count in CATEGORIES:
            base_weekly = WEEKLY_FLOWS.get(cat, 0)
            # vary ±20% per week
            factor = 1.0 + (((seed + hash(cat)) % 41 - 20) / 100.0)
            weekly  = int(base_weekly * factor)
            monthly = int(weekly * 4.3)
            rows.append({
                "category":     cat,
                "week_ending":  week_ending,
                "weekly_flow":  weekly,
                "monthly_flow": monthly,
                "total_aum":    total_aum,
                "etf_count":    count,
            })

    total, errors = supabase_upsert(
        "fund_flows", rows,
        on_conflict="category,week_ending",
        batch_size=500,
    )
    print(f"       Done: {total} rows upserted, {errors} errors")

# ── Verify ────────────────────────────────────────────────────────────────────

def verify():
    print("\n── Verification ─────────────────────────────────────────────────────")
    etf_count  = supabase_count("etfs")
    print(f"  etfs table:       {etf_count} rows")

    # fund_flows count uses different column
    url = f"{SUPABASE_URL}/rest/v1/fund_flows?select=category"
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Prefer": "count=exact",
        "Range": "0-0",
    }
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            cr = r.headers.get("Content-Range", "")
            m = re.search(r"/(\d+)$", cr)
            ff_count = int(m.group(1)) if m else "?"
    except Exception as e:
        ff_count = f"error: {e}"
    print(f"  fund_flows table: {ff_count} rows")
    print("─────────────────────────────────────────────────────────────────────")

# ── Main ──────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    print("=" * 65)
    print("  ETF Universe → Supabase population script")
    print("=" * 65)
    t0 = time.time()

    tickers    = fetch_edgar_tickers()
    candidates = filter_etfs(tickers)
    rows       = build_rows(candidates)
    ok         = upsert_etfs(rows)
    seed_fund_flows()
    verify()

    elapsed = time.time() - t0
    print(f"\nCompleted in {elapsed:.1f}s")
    if not ok:
        print("WARNING: Some batches had errors — check output above")
        sys.exit(1)
