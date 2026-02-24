import { NextResponse } from 'next/server';
import type { NewsItem } from '@/types';

export const revalidate = 900; // cache 15 minutes

// RSS feeds for ETF / financial news — proxied to avoid client-side CORS.
// Google News RSS is frequently blocked from cloud IP ranges, so we prefer
// Yahoo Finance and Reuters which are reliably accessible server-side.
const FEEDS = [
  // Yahoo Finance – top financial stories (most reliable, no auth)
  'https://finance.yahoo.com/rss/topstories',
  // Reuters – business & markets news
  'https://feeds.reuters.com/reuters/businessNews',
  // Google News – ETF-specific search (may work when not rate-limited)
  'https://news.google.com/rss/search?q=ETF+exchange+traded+fund&hl=en-US&gl=US&ceid=US:en',
];

function parseRssItems(xml: string, source: string): NewsItem[] {
  const items: NewsItem[] = [];
  // Simple regex-based RSS parser — no DOM needed in edge/node
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;
  let idx = 0;

  while ((match = itemRegex.exec(xml)) !== null && items.length < 20) {
    const block = match[1];
    const title   = (/<title><!\[CDATA\[(.*?)\]\]><\/title>/.exec(block) ?? /<title>(.*?)<\/title>/.exec(block))?.[1]?.trim() ?? '';
    // <link> is sometimes empty/self-closing in Atom-flavoured RSS; fall back to <guid>
    const rawLink = (/<link>([\s\S]*?)<\/link>/.exec(block))?.[1]?.trim() ?? '';
    const guid    = (/<guid[^>]*>(.*?)<\/guid>/.exec(block))?.[1]?.trim() ?? '';
    const link    = rawLink || guid;
    const pubDate = (/<pubDate>(.*?)<\/pubDate>/.exec(block))?.[1]?.trim() ?? '';
    const desc    = (/<description><!\[CDATA\[(.*?)\]\]><\/description>/.exec(block) ?? /<description>(.*?)<\/description>/.exec(block))?.[1]?.trim() ?? '';

    if (!title || !link) continue;

    // Extract source from Google News link description
    const srcMatch = /<source[^>]*>(.*?)<\/source>/.exec(block);
    const srcName  = srcMatch?.[1]?.trim() ?? source;

    // Clean up HTML tags from snippet
    const snippet = desc.replace(/<[^>]+>/g, '').substring(0, 160);

    items.push({
      id: `news-${idx++}-${Date.now()}`,
      title: title.replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"'),
      source: srcName,
      url: link,
      publishedAt: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
      snippet,
    });
  }

  return items;
}

export async function GET() {
  const results = await Promise.allSettled(
    FEEDS.map(async (feed) => {
      const res = await fetch(feed, {
        headers: { 'User-Agent': 'ETFMonitor/1.0 tejasusd@gmail.com' },
        next: { revalidate: 900 },
      });
      if (!res.ok) return [];
      const xml = await res.text();
      return parseRssItems(xml, 'Google News');
    })
  );

  const all: NewsItem[] = results
    .flatMap((r) => (r.status === 'fulfilled' ? r.value : []))
    // Deduplicate by title
    .filter((item, idx, arr) => arr.findIndex((x) => x.title === item.title) === idx)
    .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
    .slice(0, 25);

  return NextResponse.json({
    data: all,
    updatedAt: new Date().toISOString(),
  });
}
