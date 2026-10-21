import type { NextRequest } from 'next/server';
import { requireCtx } from '@/lib/server/auth';
import { getScoped } from '@/lib/server/crud';
import { fail } from '@/lib/server/errors';
import { handler } from '@/lib/server/http';
import { readFile } from '@/lib/server/storage';

// Material files are served only to users of the owning institution.
export const GET = handler(async (_req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const ctx = await requireCtx(['super_admin', 'inst_admin', 'director', 'teacher']);
  const m = await getScoped(ctx, 'materials', (await params).id);
  if (!m.fileKey) fail(404, 'Fayl yo‘q');
  const buf = await readFile(String(m.fileKey));
  return new Response(new Uint8Array(buf), {
    headers: { 'Content-Type': String(m.fileMime), 'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(String(m.fileName))}`, 'Cache-Control': 'private, no-store' },
  });
});
