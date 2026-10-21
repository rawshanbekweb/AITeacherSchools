import { requireCtx } from '@/lib/server/auth';
import { listEntity } from '@/lib/server/crud';
import { handler, query } from '@/lib/server/http';

export const GET = handler(async (req) => listEntity(await requireCtx(), 'sessions', query(req)));
