import type { NextRequest } from 'next/server';
import { requireCtx } from '@/lib/server/auth';
import { errorResponse, fail } from '@/lib/server/errors';
import { saveMedia } from '@/lib/server/storage';
import { audit } from '@/lib/server/audit';

// Binary upload (not JSON) so video clips do not have to be base64-encoded.
export async function POST(req: NextRequest) {
  try {
    const origin = req.headers.get('origin');
    const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host');
    if (origin && host && new URL(origin).host !== host) fail(403, 'Cross-origin so‘rov rad etildi');
    const ctx = await requireCtx(['super_admin', 'inst_admin']);
    if (!req.body) fail(400, 'Fayl yo‘q');
    const mime = (req.headers.get('content-type') ?? '').split(';')[0].trim();
    const { key, size } = await saveMedia(req.body!, mime);
    await audit(ctx.db, ctx.user, 'avatar.media_upload', 'institutions', ctx.user.institutionId, `${mime} ${Math.round(size / 1024)} KB`);
    return Response.json({ url: `/api/avatar/media/${key}` });
  } catch (e) {
    return errorResponse(e);
  }
}
