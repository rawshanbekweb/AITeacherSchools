import { currentTokenHash, requireCtx } from '@/lib/server/auth';
import { changePassword } from '@/lib/server/account';
import { body, handler } from '@/lib/server/http';

export const POST = handler(async (req) => changePassword(await requireCtx(undefined, { allowMfaSetup: true }), await body(req), await currentTokenHash()));
