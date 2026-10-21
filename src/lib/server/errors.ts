import 'server-only';
import { NextResponse } from 'next/server';
import { ZodError } from 'zod';

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}
export const fail = (status: number, message: string): never => {
  throw new HttpError(status, message);
};

export function errorResponse(e: unknown) {
  if (e instanceof HttpError) return NextResponse.json({ error: e.message }, { status: e.status });
  if (e instanceof ZodError) {
    const first = e.issues[0];
    return NextResponse.json({ error: `«${first?.path.join('.') || 'maydon'}»: ${first?.message ?? 'noto‘g‘ri qiymat'}` }, { status: 400 });
  }
  console.error(e);
  return NextResponse.json({ error: 'Ichki xatolik' }, { status: 500 });
}
