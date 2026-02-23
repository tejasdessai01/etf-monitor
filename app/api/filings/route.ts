import { NextResponse } from 'next/server';
import type { Filing } from '@/types';

export const revalidate = 3600; // cache 1 hour

// SEC EDGAR full-text search API — completely free, no auth required.
// N-1A = ETF/Mutual fund registration statement (new funds)
// 485BPOS = Annual update to registration (effective)
// 497 = Prospectus supplement
const SEC_FORMS = ['N-1A', '485BPOS', 'N-14'];

function buildEdgarUrl(form: string, days: number): string {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - days);
  const fmt = (d: Date) => d.toISOString().split('T')[0];
  return (
    `https://efts.sec.gov/LATEST/search-index?forms=${form}` +
    `&dateRange=custom&startdt=${fmt(start)}&enddt=${fmt(end)}&hits.hits._source=true`
  );
}

interface EdgarHit {
  _source: {
    file_date: string;
    entity_name: string;
    file_num: string;
    accession_no: string;
    form_type: string;
    period_of_report?: string;
  };
  _id: string;
}

async function fetchFilings(form: string, days: number): Promise<Filing[]> {
  try {
    const res = await fetch(buildEdgarUrl(form, days), {
      headers: { 'User-Agent': 'ETFMonitor tejasusd@gmail.com' },
      next: { revalidate: 3600 },
    });
    if (!res.ok) return [];
    const json = await res.json();
    const hits: EdgarHit[] = json?.hits?.hits ?? [];

    return hits.slice(0, 30).map((h): Filing => {
      const s = h._source;
      const accNo = s.accession_no?.replace(/-/g, '') ?? '';
      return {
        id: h._id,
        formType: s.form_type ?? form,
        entityName: s.entity_name ?? 'Unknown Entity',
        filedAt: s.file_date ?? new Date().toISOString(),
        accessionNo: s.accession_no ?? '',
        url: `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&filenum=${s.file_num}&type=${form}&dateb=&owner=include&count=10`,
        isNew: form === 'N-1A',
      };
    });
  } catch {
    return [];
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const days = parseInt(searchParams.get('days') ?? '30', 10);
  const formFilter = searchParams.get('form'); // optional: ?form=N-1A

  const formsToFetch = formFilter ? [formFilter] : SEC_FORMS;

  const results = await Promise.all(
    formsToFetch.map((f) => fetchFilings(f, days))
  );

  const all: Filing[] = results
    .flat()
    .sort((a, b) => new Date(b.filedAt).getTime() - new Date(a.filedAt).getTime())
    .slice(0, 50);

  return NextResponse.json({
    data: all,
    updatedAt: new Date().toISOString(),
  });
}
