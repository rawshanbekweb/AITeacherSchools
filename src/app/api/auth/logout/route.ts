import { logout } from '@/lib/server/auth';
import { handler } from '@/lib/server/http';

export const POST = handler(async () => {
  await logout();
  return { ok: true };
});
