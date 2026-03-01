import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q')?.trim() ?? '';
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '8', 10), 20);

  if (q.length < 1) return NextResponse.json({ data: [] });

  const sb = await getSupabaseClient();
  if (!sb) return NextResponse.json({ data: [] });

  // Exact ticker-prefix match (highest priority)
  const { data: tickerRows } = await sb
    .from('etfs')
    .select('ticker, name, issuer, category, aum')
    .ilike('ticker', `${q}%`)
    .order('aum', { ascending: false })
    .limit(4);

  // Name substring match
  const { data: nameRows } = await sb
    .from('etfs')
    .select('ticker, name, issuer, category, aum')
    .ilike('name', `%${q}%`)
    .order('aum', { ascending: false })
    .limit(limit);

  const seen = new Set((tickerRows ?? []).map((e) => e.ticker));
  const combined = [
    ...(tickerRows ?? []),
    ...(nameRows ?? []).filter((e) => !seen.has(e.ticker)),
  ].slice(0, limit);

  return NextResponse.json({ data: combined });
}
