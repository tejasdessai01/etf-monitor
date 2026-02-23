/**
 * Supabase client — gracefully no-ops when env vars are not set.
 *
 * To enable:
 *   1. Create a free Supabase project at https://supabase.com
 *   2. Copy the project URL and anon key from Settings → API
 *   3. Add to .env.local:
 *        NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
 *        NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
 *   4. For server-side mutations (scripts/seed-db.ts), also add:
 *        SUPABASE_SERVICE_KEY=eyJ...  (Settings → API → service_role key)
 */

const supabaseUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL  ?? '';
const supabaseKey  = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

export const SUPABASE_ENABLED = Boolean(supabaseUrl && supabaseKey);

// Lazy-import to avoid crashing when the package isn't installed yet
// or env vars aren't set.
let _client: import('@supabase/supabase-js').SupabaseClient | null = null;

export async function getSupabaseClient() {
  if (!SUPABASE_ENABLED) return null;
  if (_client) return _client;

  try {
    const { createClient } = await import('@supabase/supabase-js');
    _client = createClient(supabaseUrl, supabaseKey);
    return _client;
  } catch {
    // Package not installed — that's fine, we fall back to seed data
    return null;
  }
}

// ── Typed DB helpers ────────────────────────────────────────────────────────

import type { ETF, FlowEntry } from '@/types';

/**
 * Fetch all ETFs from Supabase. Returns null if Supabase is not configured.
 */
export async function dbGetEtfs(): Promise<ETF[] | null> {
  const sb = await getSupabaseClient();
  if (!sb) return null;

  const { data, error } = await sb
    .from('etfs')
    .select('*')
    .order('aum', { ascending: false });

  if (error || !data) return null;
  return data as ETF[];
}

/**
 * Upsert a list of ETFs into Supabase.
 */
export async function dbUpsertEtfs(etfs: ETF[]): Promise<void> {
  const sb = await getSupabaseClient();
  if (!sb) return;

  const rows = etfs.map((e) => ({
    ticker:         e.ticker,
    name:           e.name,
    issuer:         e.issuer,
    category:       e.category,
    sub_category:   e.subCategory,
    aum:            e.aum,
    expense_ratio:  e.expenseRatio,
    inception_date: e.inceptionDate,
    exchange:       e.exchange,
    price:          e.price,
    change_pct:     e.changePct,
    updated_at:     new Date().toISOString(),
  }));

  await sb.from('etfs').upsert(rows, { onConflict: 'ticker' });
}

/**
 * Write a daily AUM snapshot for each ETF.
 */
export async function dbSnapshotAum(etfs: ETF[]): Promise<void> {
  const sb = await getSupabaseClient();
  if (!sb) return;

  const today = new Date().toISOString().split('T')[0];
  const rows = etfs
    .filter((e) => e.aum > 0)
    .map((e) => ({
      ticker: e.ticker,
      date:   today,
      aum:    e.aum,
      price:  e.price ?? null,
    }));

  await sb.from('aum_history').upsert(rows, { onConflict: 'ticker,date' });
}
