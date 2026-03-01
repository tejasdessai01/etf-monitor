import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'ETF Screener — Filter 4,700+ ETFs by AUM, Expense Ratio & Performance | ETF Monitor',
  description: 'Screen and filter all US ETFs by category, issuer, AUM, expense ratio, YTD return, 1-year and 3-year performance. Free ETF screener with live data.',
  openGraph: {
    title: 'ETF Screener | ETF Monitor',
    description: 'Filter 4,700+ US ETFs by AUM, expense ratio, category, and performance. Free real-time ETF screener.',
    type: 'website',
  },
};

export default function ScreenerLayout({ children }: { children: React.ReactNode }) {
  return children;
}
