import 'server-only';
import type { Db } from '@/db';
import { auditLogs } from '@/db/schema';
import { newId } from './password';

type Actor = { id?: string; username?: string; institutionId?: string | null } | null;

/** Append-only journal of logins and important changes. Never pass passwords or personal data in `details`. */
export async function audit(db: Db, actor: Actor, action: string, entity?: string, entityId?: string | null, details = '') {
  await db.insert(auditLogs).values({
    id: newId('aud'), userId: actor?.id ?? null, username: actor?.username ?? '—', institutionId: actor?.institutionId ?? null,
    action, entity: entity ?? null, entityId: entityId ?? null, details: String(details).slice(0, 300),
  });
}
