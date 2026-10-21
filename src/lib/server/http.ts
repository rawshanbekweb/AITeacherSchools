import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { errorResponse, fail } from './errors';

/**
 * Wraps a route handler: same-origin + JSON checks for state-changing requests (CSRF defence in
 * depth on top of SameSite cookies) and uniform JSON error responses.
 */
export function handler<C>(fn: (req: NextRequest, ctx: C) => Promise<unknown>) {
  return async (req: NextRequest, ctx: C) => {
    try {
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        const origin = req.headers.get('origin');
        const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host');
        if (origin && host && new URL(origin).host !== host) fail(403, 'Cross-origin so‘rov rad etildi');
        if (!(req.headers.get('content-type') ?? '').includes('application/json')) fail(415, 'JSON kutilmoqda');
      }
      const out = await fn(req, ctx);
      if (out instanceof Response) return out;
      return NextResponse.json(out, { headers: { 'Cache-Control': 'no-store' } });
    } catch (e) {
      return errorResponse(e);
    }
  };
}

export async function body(req: NextRequest): Promise<Record<string, unknown>> {
  const text = await req.text();
  if (text.length > 9_000_000) fail(413, 'So‘rov juda katta');
  if (!text) return {};
  try {
    const v = JSON.parse(text);
    return v && typeof v === 'object' ? v : {};
  } catch {
    return fail(400, 'JSON noto‘g‘ri');
  }
}

export const query = (req: NextRequest) => Object.fromEntries(req.nextUrl.searchParams);
