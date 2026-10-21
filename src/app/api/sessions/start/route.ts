import { requireCtx } from '@/lib/server/auth';
import { startSession } from '@/lib/server/classroom';
import { body, handler } from '@/lib/server/http';

export const POST = handler(async (req) => startSession(await requireCtx(), await body(req)));
