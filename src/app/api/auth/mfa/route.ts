import { z } from 'zod';
import { cookies } from 'next/headers';
import { getDb } from '@/db';
import { completeMfa, MFA_COOKIE, setSessionCookie } from '@/lib/server/auth';
import { fail } from '@/lib/server/errors';
import { body, handler } from '@/lib/server/http';

export const POST = handler(async (req) => {
  const { code } = z.object({ code: z.string().min(6).max(10) }).parse(await body(req));
  const jar = await cookies();
  const ticket = jar.get(MFA_COOKIE)?.value ?? fail(401, 'Qaytadan kiring');
  const r = await completeMfa(await getDb(), ticket, code);
  jar.delete(MFA_COOKIE);
  await setSessionCookie(r.token, r.expiresAt);
  return { user: r.user };
});
