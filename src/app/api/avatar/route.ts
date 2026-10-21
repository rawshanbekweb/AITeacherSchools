import { requireCtx } from '@/lib/server/auth';
import { getAvatar, saveAvatar } from '@/lib/server/classroom';
import { body, handler, query } from '@/lib/server/http';

export const GET = handler(async (req) => ({ avatar: await getAvatar(await requireCtx(), query(req).institutionId) }));
export const PUT = handler(async (req) => {
  const b = await body(req);
  return { avatar: await saveAvatar(await requireCtx(), b.institutionId as string | undefined, b.avatar) };
});
