/**
 * POST /api/ai-summary
 *
 * Generate a 2–3 sentence plain-English summary of an SEC filing using Claude.
 * Requires ANTHROPIC_API_KEY to be set in environment variables.
 *
 * Body: { formType, entityName, description, accessionNo? }
 * Returns: { summary: string }
 */

import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 503 });
  }

  let body: { formType?: string; entityName?: string; description?: string; accessionNo?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { formType = '', entityName = '', description = '' } = body;
  if (!entityName) return NextResponse.json({ error: 'entityName required' }, { status: 400 });

  const FORM_CONTEXT: Record<string, string> = {
    'N-1A':    'a new ETF registration statement (new fund being launched)',
    'N-1A/A':  'an amendment to an ETF registration statement (updating an existing fund)',
    '485BPOS': 'an effective post-effective amendment (annual update to an existing fund)',
    'N-14':    'a fund merger or reorganization notice',
  };
  const formContext = FORM_CONTEXT[formType] ?? `a ${formType} SEC filing`;

  const prompt = `You are a financial analyst summarizing SEC ETF filings for retail investors.

Summarize the following filing in 2-3 sentences. Be specific about who filed, what they filed, and why it matters. Focus on practical implications for investors. Do not use jargon. Do not say "the filing" — describe what actually happened.

Filer: ${entityName}
Form type: ${formType} — ${formContext}
Description: ${description || 'Not provided'}

Write only the summary, no preamble.`;

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 180,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      return NextResponse.json({ error: `Anthropic API error: ${res.status}`, detail: err }, { status: 502 });
    }

    const json = await res.json();
    const summary: string = json?.content?.[0]?.text ?? '';
    return NextResponse.json({ summary });
  } catch (e) {
    return NextResponse.json({ error: 'Failed to contact Anthropic API', detail: String(e) }, { status: 502 });
  }
}
