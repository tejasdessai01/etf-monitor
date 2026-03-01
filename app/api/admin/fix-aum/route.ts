/**
 * POST /api/admin/fix-aum
 *
 * One-time endpoint to backfill correct AUM values into Supabase from the
 * SEED_ETFS curated data. Fixes data corruption from the old refresh-prices
 * cron that was writing Yahoo Finance marketCap (issuer market cap for ETNs)
 * as AUM.
 *
 * Auth: Authorization: Bearer <CRON_SECRET>
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { SEED_ETFS } from '@/lib/etf-data';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  // This endpoint is intentionally open — it only writes public SEED_ETFS
  // data (AUM, expense ratios for ~28 well-known ETFs) to Supabase.
  // It is idempotent and safe to call multiple times.

  const sbUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  const sbKey = process.env.SUPABASE_SERVICE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
  if (!sbUrl || !sbKey) return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 });
  const sb = createClient(sbUrl, sbKey);

  // Build upsert rows from SEED_ETFS — only update aum and expense_ratio
  const rows = SEED_ETFS
    .filter(e => e.aum > 0)
    .map(e => ({
      ticker:        e.ticker,
      aum:           e.aum,
      expense_ratio: e.expenseRatio,
      name:          e.name,
      issuer:        e.issuer,
      category:      e.category,
    }));

  const { error, count } = await sb
    .from('etfs')
    .upsert(rows, { onConflict: 'ticker', count: 'exact' });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    message: 'AUM backfill complete',
    seeded: rows.length,
    upserted: count,
    tickers: rows.map(r => r.ticker),
  });
}
