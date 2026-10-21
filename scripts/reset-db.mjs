// Deletes the embedded PGlite database and uploads so the next start re-seeds demo data.
// (For PostgreSQL, drop/recreate the database instead.)
import fs from 'node:fs';
for (const dir of [process.env.PGLITE_DIR || 'data/pglite', process.env.UPLOAD_DIR || 'data/uploads']) {
  fs.rmSync(dir, { recursive: true, force: true });
  console.log('removed', dir);
}
