import type { NextRequest } from 'next/server';
import { requireCtx } from '@/lib/server/auth';
import { deleteEntity, getEntity, updateEntity } from '@/lib/server/crud';
import { body, handler } from '@/lib/server/http';

type C = { params: Promise<{ entity: string; id: string }> };

export const GET = handler(async (_req: NextRequest, { params }: C) => {
  const { entity, id } = await params;
  return { item: await getEntity(await requireCtx(), entity, id) };
});
export const PUT = handler(async (req: NextRequest, { params }: C) => {
  const { entity, id } = await params;
  return { item: await updateEntity(await requireCtx(), entity, id, await body(req)) };
});
export const DELETE = handler(async (_req: NextRequest, { params }: C) => {
  const { entity, id } = await params;
  return deleteEntity(await requireCtx(), entity, id);
});
