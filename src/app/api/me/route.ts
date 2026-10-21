import { requireCtx } from '@/lib/server/auth';
import { handler } from '@/lib/server/http';

export const GET = handler(async () => ({ user: (await requireCtx()).user }));
