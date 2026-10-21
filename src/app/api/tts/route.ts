import { z } from 'zod';
import { requireCtx } from '@/lib/server/auth';
import { fail } from '@/lib/server/errors';
import { body, handler } from '@/lib/server/http';
import { synthesize, ttsEnabled } from '@/lib/server/tts';

const schema = z.object({ text: z.string().trim().min(1).max(1500), lang: z.enum(['uz', 'ru', 'en']), gender: z.enum(['male', 'female']).default('male'), rate: z.number().min(0.5).max(1.5).default(1) });

export const POST = handler(async (req) => {
  await requireCtx(['super_admin', 'inst_admin', 'director', 'teacher']);
  if (!ttsEnabled()) fail(404, 'Server TTS sozlanmagan');
  const { text, lang, gender, rate } = schema.parse(await body(req));
  const audio = await synthesize(text, lang, gender, rate);
  return new Response(audio, { headers: { 'Content-Type': 'audio/mpeg', 'Cache-Control': 'private, max-age=3600' } });
});
