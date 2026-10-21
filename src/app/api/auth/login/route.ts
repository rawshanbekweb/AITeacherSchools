import { z } from 'zod';
import { cookies } from 'next/headers';
import { getDb } from '@/db';
import { login, MFA_COOKIE, setSessionCookie } from '@/lib/server/auth';
import { body, handler } from '@/lib/server/http';

const schema = z.object({ username: z.string().min(1).max(100), password: z.string().min(1).max(200), portal: z.enum(['admin', 'classroom']) });

export const POST = handler(async (req) => {
  const { username, password, portal } = schema.parse(await body(req));
  const r = await login(await getDb(), username, password, portal);
  if (r.mfa) {
    // the pending ticket lives in its own HttpOnly cookie; it cannot authenticate anything
    await setSessionCookie(r.token, r.expiresAt, MFA_COOKIE);
    return { mfaRequired: true };
  }
  (await cookies()).delete(MFA_COOKIE);
  await setSessionCookie(r.token, r.expiresAt);
  return { user: r.user };
});
