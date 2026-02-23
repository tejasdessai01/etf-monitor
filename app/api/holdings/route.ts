import { NextResponse } from 'next/server';
import { fetchHoldings } from '@/lib/edgar-holdings';

// Cache 24 hours — NPORT-P filings are monthly, so daily is fine
export const revalidate = 86400;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const ticker = (searchParams.get('ticker') ?? '').toUpperCase().trim();

  if (!ticker) {
    return NextResponse.json({ error: 'ticker required' }, { status: 400 });
  }

  const result = await fetchHoldings(ticker);

  return NextResponse.json({
    data: result,
    updatedAt: new Date().toISOString(),
  });
}
