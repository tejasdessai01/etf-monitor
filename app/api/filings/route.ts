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
    entity_name?: string;
    display_names?: Array<{ name: string; cik: string }>;
    file_num: string;
    accession_no: string;
    form_type: string;
    period_of_report?: string;
    description?: string;  // sometimes present in SGML header
    subject?: string;
  };
  _id: string;
}

// Map verbose EDGAR trust names to recognizable issuer brands
const ISSUER_MAP: Array<[RegExp, string]> = [
  [/ishares/i,                           'BlackRock iShares'],
  [/vanguard/i,                          'Vanguard'],
  [/spdr|state street/i,                 'State Street SPDR'],
  [/invesco|powershares/i,               'Invesco'],
  [/proshares/i,                         'ProShares'],
  [/wisdomtree/i,                        'WisdomTree'],
  [/direxion/i,                          'Direxion'],
  [/vaneck/i,                            'VanEck'],
  [/ark invest|ark etf/i,               'ARK Invest'],
  [/global x/i,                          'Global X'],
  [/first trust/i,                       'First Trust'],
  [/dimensional/i,                       'Dimensional'],
  [/flexshares|northern trust/i,         'FlexShares'],
  [/xtrackers|dws/i,                     'Xtrackers (DWS)'],
  [/graniteshares/i,                     'GraniteShares'],
  [/amplify/i,                           'Amplify'],
  [/defiance/i,                          'Defiance'],
  [/simplify/i,                          'Simplify'],
  [/pacer/i,                             'Pacer'],
  [/goldman sachs/i,                     'Goldman Sachs'],
  [/jpmorgan|j\.p\. morgan/i,            'JPMorgan'],
  [/pimco/i,                             'PIMCO'],
  [/fidelity/i,                          'Fidelity'],
  [/schwab/i,                            'Schwab'],
  [/blackrock/i,                         'BlackRock'],
];

function friendlyIssuer(entityName: string): string {
  for (const [pattern, brand] of ISSUER_MAP) {
    if (pattern.test(entityName)) return brand;
  }
  // Trim common boilerplate suffixes
  return entityName
    .replace(/\s+(ETF Trust|Index Fund|Mutual Fund|Series Trust|Fund Trust|Investment Trust|Trust)\b/gi, '')
    .trim();
}

const FORM_ACTION: Record<string, string> = {
  'N-1A':    'Filed to register a new ETF series',
  '485BPOS': 'Filed annual registration update (effective)',
  'N-14':    'Filed fund merger / reorganization notice',
};

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
      const cik = s.display_names?.[0]?.cik ?? '';
      const accNo = s.accession_no?.replace(/-/g, '') ?? '';
      // Build filing index URL: direct link to this specific filing on EDGAR
      const url = cik && accNo
        ? `https://www.sec.gov/Archives/edgar/data/${cik}/${accNo}/${s.accession_no}-index.htm`
        : `https://efts.sec.gov/LATEST/search-index?q=%22${s.accession_no ?? ''}%22&forms=${form}`;

      const rawEntity = s.entity_name || s.display_names?.[0]?.name || 'Unknown';
      const issuer = friendlyIssuer(rawEntity);
      // Use description from EDGAR if meaningful, otherwise build from form type
      const rawDesc = s.description ?? s.subject ?? '';
      const isBoilerplate = !rawDesc || /registration statement|annual report/i.test(rawDesc);
      const description = isBoilerplate
        ? FORM_ACTION[form] ?? form
        : rawDesc;

      return {
        id: h._id,
        formType: s.form_type ?? form,
        entityName: issuer,
        filedAt: s.file_date ?? new Date().toISOString(),
        accessionNo: s.accession_no ?? '',
        url,
        description,
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
