import { requireCtx } from '@/lib/server/auth';
import { disableMfa, enableMfa, startMfaSetup } from '@/lib/server/account';
import { fail } from '@/lib/server/errors';
import { body, handler } from '@/lib/server/http';

// POST { action: 'setup' } → QR code; { action: 'enable', code }; { action: 'disable', password }
export const POST = handler(async (req) => {
  const ctx = await requireCtx(undefined, { allowMfaSetup: true });
  const b = await body(req);
  if (b.action === 'setup') return startMfaSetup(ctx);
  if (b.action === 'enable') return enableMfa(ctx, b);
  if (b.action === 'disable') return disableMfa(ctx, b);
  return fail(400, 'Noma’lum amal');
});
