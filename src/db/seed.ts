import 'server-only';
import { sql } from 'drizzle-orm';
import type { Db } from './index';
import * as t from './schema';
import { buildSeed, DEMO_ACCOUNTS } from '@/lib/core/seed';
import { hashPassword, newId } from '@/lib/server/password';

/** Creates demo institutions and accounts on an empty database. Idempotent. */
export async function seedDemoData(db: Db) {
  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(t.institutions);
  if (count > 0) return;
  const s = buildSeed();
  await db.transaction(async (tx) => {
    await tx.insert(t.institutions).values(s.institutions as (typeof t.institutions.$inferInsert)[]);
    await tx.insert(t.departments).values(s.departments as (typeof t.departments.$inferInsert)[]);
    await tx.insert(t.groups).values(s.groups as (typeof t.groups.$inferInsert)[]);
    await tx.insert(t.students).values(s.students as (typeof t.students.$inferInsert)[]);
    await tx.insert(t.subjects).values(s.subjects as (typeof t.subjects.$inferInsert)[]);
    await tx.insert(t.materials).values(s.materials as (typeof t.materials.$inferInsert)[]);
    for (const { groupIds, ...lesson } of s.lessons) {
      await tx.insert(t.lessons).values(lesson as typeof t.lessons.$inferInsert);
      if (groupIds.length) await tx.insert(t.lessonGroups).values(groupIds.map((groupId) => ({ lessonId: lesson.id, groupId })));
    }
    await tx.insert(t.devices).values(s.devices as (typeof t.devices.$inferInsert)[]);
    await tx.insert(t.schedule).values(s.schedule as (typeof t.schedule.$inferInsert)[]);
    for (const a of DEMO_ACCOUNTS) {
      await tx.insert(t.users).values({
        id: newId('usr'), username: a.username, fullName: a.fullName, role: a.role, institutionId: a.institutionId,
        passwordHash: await hashPassword(a.password),
      });
    }
    await tx.insert(t.auditLogs).values({ id: newId('aud'), action: 'system.seed', entity: 'platform', details: 'Demo ma’lumotlari yaratildi' });
  });
}
