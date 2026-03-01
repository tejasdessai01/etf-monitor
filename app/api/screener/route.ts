import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

const VALID_SORTS = ['aum', 'expense_ratio', 'ytd_return', 'one_year_return', 'three_year_return', 'ticker'] as const;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  const category    = searchParams.get('category') ?? '';
  const issuer      = searchParams.get('issuer') ?? '';
  const aumMin      = parseFloat(searchParams.get('aum_min') ?? '0') * 1_000_000; // input in $M
  const aumMax      = parseFloat(searchParams.get('aum_max') ?? '0') * 1_000_000;
  const expenseMax  = parseFloat(searchParams.get('expense_max') ?? '0') / 100;   // input in %
  const ytdMin      = parseFloat(searchParams.get('ytd_min') ?? 'NaN') / 100;
  const oneYearMin  = parseFloat(searchParams.get('one_year_min') ?? 'NaN') / 100;
  const sortBy      = (searchParams.get('sort') ?? 'aum') as string;
  const ascending   = searchParams.get('sort_dir') === 'asc';
  const page        = Math.max(0, parseInt(searchParams.get('page') ?? '0', 10));
  const limit       = Math.min(50, parseInt(searchParams.get('limit') ?? '25', 10));

  const sb = await getSupabaseClient();
  if (!sb) return NextResponse.json({ error: 'DB unavailable' }, { status: 500 });

  const col = VALID_SORTS.includes(sortBy as typeof VALID_SORTS[number]) ? sortBy : 'aum';

  let query = sb
    .from('etfs')
    .select('ticker, name, issuer, category, aum, expense_ratio, ytd_return, one_year_return, three_year_return', { count: 'exact' });

  if (category && category !== 'All') query = query.eq('category', category);
  if (issuer)    query = query.ilike('issuer', `%${issuer}%`);
  if (aumMin > 0) query = query.gte('aum', aumMin);
  if (aumMax > 0) query = query.lte('aum', aumMax);
  if (expenseMax > 0) query = query.lte('expense_ratio', expenseMax);
  if (!isNaN(ytdMin))     query = query.gte('ytd_return', ytdMin);
  if (!isNaN(oneYearMin)) query = query.gte('one_year_return', oneYearMin);

  query = query.order(col, { ascending, nullsFirst: false });

  const from = page * limit;
  const { data, error, count } = await query.range(from, from + limit - 1);

  if (error) {
    // Performance columns may not exist yet — retry without them
    if (error.message.includes('column') || error.message.includes('does not exist')) {
      const { data: basic, error: e2, count: c2 } = await sb
        .from('etfs')
        .select('ticker, name, issuer, category, aum, expense_ratio', { count: 'exact' })
        .order('aum', { ascending: false, nullsFirst: false })
        .range(from, from + limit - 1);
      if (e2) return NextResponse.json({ error: e2.message }, { status: 500 });
      return NextResponse.json({ data: basic ?? [], total: c2 ?? 0, page, limit, perfAvailable: false });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data: data ?? [], total: count ?? 0, page, limit, perfAvailable: true });
}
