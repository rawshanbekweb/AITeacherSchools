import { z } from 'zod';
import { getDb } from '@/db';
import { login, setSessionCookie } from '@/lib/server/auth';
import { body, handler } from '@/lib/server/http';

const schema = z.object({ username: z.string().min(1).max(100), password: z.string().min(1).max(200), portal: z.enum(['admin', 'classroom']) });

export const POST = handler(async (req) => {
  const { username, password, portal } = schema.parse(await body(req));
  const { token, expiresAt, user } = await login(await getDb(), username, password, portal);
  await setSessionCookie(token, expiresAt);
  return { user };
});
