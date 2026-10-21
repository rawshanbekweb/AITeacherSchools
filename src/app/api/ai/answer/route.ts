import { requireCtx } from '@/lib/server/auth';
import { answerQuestion } from '@/lib/server/classroom';
import { body, handler } from '@/lib/server/http';

export const POST = handler(async (req) => answerQuestion(await requireCtx(), await body(req)));
