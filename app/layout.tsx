import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'ETF Monitor — US ETF Dashboard',
  description: 'Free real-time dashboard for US ETFs. Track top funds by AUM, new launches, SEC filings, and ETF news — all in one place.',
  keywords: 'ETF, exchange traded fund, US ETF, AUM, SEC filings, ETF news, ETF dashboard',
  openGraph: {
    title: 'ETF Monitor — US ETF Dashboard',
    description: 'Free real-time dashboard for US ETFs. Top funds, new launches, SEC filings, news.',
    type: 'website',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>📈</text></svg>" />
      </head>
      <body style={{ margin: 0, minHeight: '100vh', background: 'var(--bg-primary)' }}>
        {children}
      </body>
    </html>
  );
}
