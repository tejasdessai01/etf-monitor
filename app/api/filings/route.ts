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
    `&dateRange=custom&startdt=${fmt(start)}&enddt=${fmt(end)}`
  );
}

interface EdgarHit {
  _source: {
    file_date: string;
    display_names?: string[];        // e.g. ["Bridgeway ETF Trust  (CIK 0002097519)"]
    ciks?: string[];                 // e.g. ["0002097519"]
    adsh?: string;                   // accession number with dashes e.g. "0002071844-26-000130"
    form?: string;                   // e.g. "N-1A/A"
    file_type?: string;
    file_description?: string | null;
    file_num?: string[];
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

      // display_names is string[] like "Bridgeway ETF Trust  (CIK 0002097519)"
      const rawDisplayName = s.display_names?.[0] ?? '';
      const rawEntity = rawDisplayName.replace(/\s*\(CIK\s+\d+\)\s*$/i, '').trim() || 'Unknown';
      const issuer = friendlyIssuer(rawEntity);

      // CIK for building the EDGAR URL
      const cik = s.ciks?.[0]?.replace(/^0+/, '') ?? '';
      const adsh = s.adsh ?? '';
      const accNoNoDash = adsh.replace(/-/g, '');

      const url = cik && accNoNoDash
        ? `https://www.sec.gov/Archives/edgar/data/${cik}/${accNoNoDash}/${adsh}-index.htm`
        : `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&type=${encodeURIComponent(form)}&dateb=&owner=include&count=40`;

      const formType = s.form ?? s.file_type ?? form;
      const rawDesc = s.file_description ?? '';
      const isBoilerplate = !rawDesc || /registration statement|annual report/i.test(rawDesc);
      const description = isBoilerplate
        ? FORM_ACTION[form] ?? form
        : rawDesc;

      return {
        id: h._id,
        formType,
        entityName: issuer,
        filedAt: s.file_date ?? new Date().toISOString(),
        accessionNo: adsh,
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
