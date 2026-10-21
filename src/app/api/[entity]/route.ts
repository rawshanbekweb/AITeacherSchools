import type { NextRequest } from 'next/server';
import { requireCtx } from '@/lib/server/auth';
import { createEntity, listEntity } from '@/lib/server/crud';
import { body, handler, query } from '@/lib/server/http';

type C = { params: Promise<{ entity: string }> };

export const GET = handler(async (req: NextRequest, { params }: C) => listEntity(await requireCtx(), (await params).entity, query(req)));
export const POST = handler(async (req: NextRequest, { params }: C) => ({ item: await createEntity(await requireCtx(), (await params).entity, await body(req)) }));
