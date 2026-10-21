import type { NextRequest } from 'next/server';
import { requireCtx } from '@/lib/server/auth';
import { completeSession, logQuestion, markAttendance, report, saveResult, saveSnapshot } from '@/lib/server/classroom';
import { fail } from '@/lib/server/errors';
import { body, handler } from '@/lib/server/http';

type C = { params: Promise<{ id: string; action: string }> };

export const GET = handler(async (_req: NextRequest, { params }: C) => {
  const { id, action } = await params;
  if (action !== 'report') fail(404, 'Not found');
  return report(await requireCtx(), id);
});

const ACTIONS = { state: saveSnapshot, attendance: markAttendance, questions: logQuestion, results: saveResult, complete: completeSession } as const;

export const POST = handler(async (req: NextRequest, { params }: C) => {
  const { id, action } = await params;
  const fn = ACTIONS[action as keyof typeof ACTIONS] ?? fail(404, 'Not found');
  return fn(await requireCtx(), id, await body(req));
});
