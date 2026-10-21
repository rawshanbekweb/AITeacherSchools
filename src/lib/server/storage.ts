import 'server-only';
import fs from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { Readable } from 'node:stream';
import { fail } from './errors';

// Local-disk adapter for uploaded files. Files are only served through authorised routes;
// swap this module for S3/MinIO in production deployments.
const DIR = path.resolve(/* turbopackIgnore: true */ process.cwd(), process.env.UPLOAD_DIR || 'data/uploads');
const DOCS = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'application/pdf']);
const MEDIA: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'video/mp4': 'mp4', 'video/webm': 'webm', 'video/quicktime': 'mov' };
const EXT_MIME = Object.fromEntries(Object.entries(MEDIA).map(([m, e]) => [e, m]));
const KEY = /^[a-f0-9]{32}(\.(png|jpg|webp|mp4|webm|mov))?$/;
export const MAX_DOC = 5 * 1024 * 1024;
export const MAX_MEDIA = 60 * 1024 * 1024;

const file = (key: string) => path.join(/* turbopackIgnore: true */ DIR, key);

export async function saveDataUrl(dataUrl: string, name: string) {
  const m = /^data:([\w/+.-]+);base64,(.+)$/s.exec(dataUrl);
  if (!m) fail(400, 'Fayl formati noto‘g‘ri');
  const mime = m![1];
  if (!DOCS.has(mime)) fail(400, 'Faqat rasm (PNG, JPG, WebP, GIF) yoki PDF yuklash mumkin');
  const buf = Buffer.from(m![2], 'base64');
  if (buf.length > MAX_DOC) fail(413, 'Fayl 5 MB dan katta');
  const key = randomBytes(16).toString('hex');
  await fs.mkdir(DIR, { recursive: true });
  await fs.writeFile(file(key), buf);
  return { key, mime, name: path.basename(name).slice(0, 200) };
}

/** Avatar photos and video clips; the key carries the extension so the type is known when serving. */
export async function saveMedia(body: ReadableStream<Uint8Array>, mime: string) {
  const ext = MEDIA[mime] ?? fail(415, 'Faqat PNG/JPG/WebP rasm yoki MP4/WebM/MOV video');
  const key = `${randomBytes(16).toString('hex')}.${ext}`;
  await fs.mkdir(DIR, { recursive: true });
  const fh = await fs.open(file(key), 'w');
  let size = 0;
  try {
    const reader = body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > MAX_MEDIA) fail(413, 'Fayl 60 MB dan katta');
      await fh.write(value);
    }
  } catch (e) {
    await fh.close();
    await fs.rm(file(key), { force: true });
    throw e;
  }
  await fh.close();
  return { key, mime, size };
}

export async function readFile(key: string) {
  if (!KEY.test(key)) fail(404, 'Topilmadi');
  return fs.readFile(file(key));
}

/** Stream a media file with HTTP Range support (needed for video seeking). */
export async function mediaResponse(key: string, range: string | null) {
  if (!KEY.test(key) || !key.includes('.')) fail(404, 'Topilmadi');
  const stat = await fs.stat(file(key)).catch(() => fail(404, 'Topilmadi'));
  const size = stat!.size;
  const type = EXT_MIME[key.split('.').pop()!];
  const headers: Record<string, string> = { 'Content-Type': type, 'Accept-Ranges': 'bytes', 'Cache-Control': 'private, max-age=86400, immutable' };
  const m = range && /^bytes=(\d*)-(\d*)$/.exec(range);
  if (m && (m[1] || m[2])) {
    let start = m[1] ? Number(m[1]) : size - Number(m[2]);
    let end = m[1] && m[2] ? Number(m[2]) : size - 1;
    start = Math.max(0, start);
    end = Math.min(size - 1, end);
    if (start > end) return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } });
    const stream = Readable.toWeb(createReadStream(file(key), { start, end })) as ReadableStream;
    return new Response(stream, { status: 206, headers: { ...headers, 'Content-Range': `bytes ${start}-${end}/${size}`, 'Content-Length': String(end - start + 1) } });
  }
  const stream = Readable.toWeb(createReadStream(file(key))) as ReadableStream;
  return new Response(stream, { headers: { ...headers, 'Content-Length': String(size) } });
}
