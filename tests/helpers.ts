import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { eq } from 'drizzle-orm';
import * as schema from '@/db/schema';
import type { Db } from '@/db';
import { seedDemoData } from '@/db/seed';
import { login } from '@/lib/server/auth';
import type { Ctx } from '@/lib/server/auth';

/** Fresh in-memory PostgreSQL with migrations and demo data. */
export async function testDb(): Promise<Db> {
  const db = drizzle({ client: new PGlite(), schema });
  await migrate(db, { migrationsFolder: path.resolve('drizzle') });
  await seedDemoData(db as unknown as Db);
  return db as unknown as Db;
}

export async function ctxFor(db: Db, username: string, password: string, portal: 'admin' | 'classroom' = 'admin'): Promise<Ctx> {
  const r = await login(db, username, password, portal);
  if (r.mfa) throw new Error('MFA required for ' + username);
  return { db, user: r.user };
}

export async function userId(db: Db, username: string) {
  const [u] = await db.select().from(schema.users).where(eq(schema.users.username, username));
  return u.id;
}
