import { getDb } from '@/db';
import { getAnswerProvider } from '@/lib/server/ai';
import { ttsEnabled } from '@/lib/server/tts';
import { sql } from 'drizzle-orm';
import { handler } from '@/lib/server/http';

export const GET = handler(async () => {
  const db = await getDb();
  await db.execute(sql`select 1`);
  return { ok: true, ai: getAnswerProvider() ? 'llm' : 'offline', tts: ttsEnabled() ? 'neural' : 'browser', db: process.env.DATABASE_URL ? 'postgres' : 'pglite', time: new Date().toISOString() };
});
