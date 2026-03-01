import type { Metadata } from 'next';

interface Props {
  params: Promise<{ ticker: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { ticker } = await params;
  const t = ticker.toUpperCase();

  // Try to get fund name from API for richer metadata
  try {
    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'http://localhost:3000';
    const res = await fetch(`${baseUrl}/api/etf/${t}`, { next: { revalidate: 3600 } });
    if (res.ok) {
      const data = await res.json();
      const name = data.name ?? t;
      const price = data.price ? `$${data.price.toFixed(2)}` : '';
      const ytd = data.performance?.ytd != null ? ` · YTD ${data.performance.ytd >= 0 ? '+' : ''}${(data.performance.ytd * 100).toFixed(1)}%` : '';
      return {
        title: `${t} — ${name} | ETF Monitor`,
        description: `${name} (${t})${price ? ` — ${price}` : ''}${ytd}. Live price, holdings, expense ratio, performance, and SEC filings.`,
        openGraph: {
          title: `${t}: ${name}`,
          description: `Live data for ${name} ETF. Price${price ? ` ${price}` : ''}, AUM, holdings, performance${ytd}.`,
          type: 'website',
        },
        twitter: {
          card: 'summary',
          title: `${t}: ${name} | ETF Monitor`,
          description: `Live ETF data for ${name}${price ? ` — ${price}` : ''}${ytd}`,
        },
      };
    }
  } catch {
    // fall through to default
  }

  return {
    title: `${t} ETF — Live Data, Holdings & Performance | ETF Monitor`,
    description: `Live price, AUM, holdings, performance, and SEC filings for ${t} ETF.`,
  };
}

export default function ETFDetailLayout({ children }: { children: React.ReactNode }) {
  return children;
}
