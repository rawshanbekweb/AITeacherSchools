import type { NextRequest } from 'next/server';
import { requireCtx } from '@/lib/server/auth';
import { errorResponse } from '@/lib/server/errors';
import { mediaResponse } from '@/lib/server/storage';

// Avatar media (a real person's likeness) is only served to signed-in users.
export async function GET(req: NextRequest, { params }: RouteContext<'/api/avatar/media/[key]'>) {
  try {
    await requireCtx();
    return await mediaResponse((await params).key, req.headers.get('range'));
  } catch (e) {
    return errorResponse(e);
  }
}
