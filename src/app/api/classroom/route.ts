import { requireCtx } from '@/lib/server/auth';
import { classroomOptions } from '@/lib/server/classroom';
import { handler } from '@/lib/server/http';

export const GET = handler(async () => classroomOptions(await requireCtx()));
