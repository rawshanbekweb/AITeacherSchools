import 'server-only';
import path from 'node:path';
import fs from 'node:fs';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import * as schema from './schema';
import { seedDemoData } from './seed';

export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

const MIGRATIONS = path.join(/* turbopackIgnore: true */ process.cwd(), 'drizzle');

async function connect(): Promise<Db> {
  const url = process.env.DATABASE_URL;
  if (url) {
    const { Pool } = await import('pg');
    const { drizzle } = await import('drizzle-orm/node-postgres');
    const { migrate } = await import('drizzle-orm/node-postgres/migrator');
    const db = drizzle({ client: new Pool({ connectionString: url, max: 10 }), schema });
    await migrate(db, { migrationsFolder: MIGRATIONS });
    return db as unknown as Db;
  }
  // Embedded PostgreSQL (WASM) for local development and demos: same SQL, zero setup.
  const { PGlite } = await import('@electric-sql/pglite');
  const { drizzle } = await import('drizzle-orm/pglite');
  const { migrate } = await import('drizzle-orm/pglite/migrator');
  const dir = path.resolve(/* turbopackIgnore: true */ process.cwd(), process.env.PGLITE_DIR || 'data/pglite');
  fs.mkdirSync(dir, { recursive: true });
  const db = drizzle({ client: new PGlite(dir), schema });
  await migrate(db, { migrationsFolder: MIGRATIONS });
  return db as unknown as Db;
}

// One connection per server process (survives dev hot reloads).
const g = globalThis as unknown as { __aiTeacherDb?: Promise<Db> };

export function getDb(): Promise<Db> {
  if (!g.__aiTeacherDb) {
    g.__aiTeacherDb = (async () => {
      const db = await connect();
      if (process.env.SEED_DEMO_DATA !== 'false') await seedDemoData(db);
      return db;
    })().catch((e) => {
      g.__aiTeacherDb = undefined;
      throw e;
    });
  }
  return g.__aiTeacherDb;
}

export { schema };
