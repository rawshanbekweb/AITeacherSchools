import { requireCtx } from '@/lib/server/auth';
import { dashboard } from '@/lib/server/classroom';
import { handler } from '@/lib/server/http';

export const GET = handler(async () => dashboard(await requireCtx()));
