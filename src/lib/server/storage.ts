import 'server-only';
import fs from 'node:fs/promises';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { fail } from './errors';

// Local-disk adapter for uploaded lesson files. Files are only served through an authorised
// route (/api/files/[id]); swap this module for S3/MinIO in production deployments.
const DIR = path.resolve(/* turbopackIgnore: true */ process.cwd(), process.env.UPLOAD_DIR || 'data/uploads');
const ALLOWED = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'application/pdf']);
const MAX_BYTES = 5 * 1024 * 1024;

export async function saveDataUrl(dataUrl: string, name: string) {
  const m = /^data:([\w/+.-]+);base64,(.+)$/s.exec(dataUrl);
  if (!m) fail(400, 'Fayl formati noto‘g‘ri');
  const mime = m![1];
  if (!ALLOWED.has(mime)) fail(400, 'Faqat rasm (PNG, JPG, WebP, GIF) yoki PDF yuklash mumkin');
  const buf = Buffer.from(m![2], 'base64');
  if (buf.length > MAX_BYTES) fail(413, 'Fayl 5 MB dan katta');
  const key = randomBytes(16).toString('hex');
  await fs.mkdir(DIR, { recursive: true });
  await fs.writeFile(path.join(/* turbopackIgnore: true */ DIR, key), buf);
  return { key, mime, name: path.basename(name).slice(0, 200) };
}

export async function readFile(key: string) {
  if (!/^[a-f0-9]{32}$/.test(key)) fail(404, 'Topilmadi');
  return fs.readFile(path.join(/* turbopackIgnore: true */ DIR, key));
}
