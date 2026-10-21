import 'server-only';
import { cookies } from 'next/headers';
import { and, eq, gt, lt } from 'drizzle-orm';
import { getDb, type Db } from '@/db';
import { authSessions, institutions, loginAttempts, users } from '@/db/schema';
import type { Role, SessionUser } from '@/lib/core/types';
import { fail } from './errors';
import { newToken, sha256, verifyPassword } from './password';
import { audit } from './audit';

export const SESSION_COOKIE = 'ait_session';
const SESSION_TTL_MS = 12 * 3600_000;
const MAX_FAILURES = 5;
const LOCK_MS = 60_000;

export type Portal = 'admin' | 'classroom';

export interface Ctx {
  db: Db;
  user: SessionUser;
}

async function loadUser(db: Db, userId: string): Promise<SessionUser | null> {
  const [row] = await db
    .select({ u: users, instName: institutions.name, instType: institutions.type })
    .from(users)
    .leftJoin(institutions, eq(users.institutionId, institutions.id))
    .where(eq(users.id, userId));
  if (!row || row.u.status !== 'active') return null;
  return {
    id: row.u.id, username: row.u.username, fullName: row.u.fullName, role: row.u.role, institutionId: row.u.institutionId,
    institutionName: row.instName ?? null, institutionType: row.instType ?? null,
  };
}

/** Resolve the signed-in user from the session cookie, or null. */
export async function currentUser(): Promise<SessionUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const db = await getDb();
  const [s] = await db.select().from(authSessions).where(and(eq(authSessions.tokenHash, sha256(token)), gt(authSessions.expiresAt, new Date())));
  if (!s) return null;
  return loadUser(db, s.userId);
}

/** For route handlers: authenticated context or 401. */
export async function requireCtx(roles?: Role[]): Promise<Ctx> {
  const user = await currentUser();
  if (!user) fail(401, 'Avtorizatsiya talab qilinadi');
  if (roles && !roles.includes(user!.role)) fail(403, 'Ruxsat yo‘q');
  return { db: await getDb(), user: user! };
}

export async function login(db: Db, username: string, password: string, portal: Portal) {
  username = username.trim().toLowerCase();
  const [attempt] = await db.select().from(loginAttempts).where(eq(loginAttempts.username, username));
  if (attempt?.lockedUntil && attempt.lockedUntil > new Date()) fail(429, 'Juda ko‘p urinish. Bir daqiqadan so‘ng qayta urinib ko‘ring.');

  const [u] = await db.select().from(users).where(eq(users.username, username));
  const ok = !!u && u.status === 'active' && (await verifyPassword(password, u.passwordHash));
  if (!ok) {
    const failures = (attempt?.failures ?? 0) + 1;
    const lockedUntil = failures >= MAX_FAILURES ? new Date(Date.now() + LOCK_MS) : null;
    await db.insert(loginAttempts).values({ username, failures, lockedUntil })
      .onConflictDoUpdate({ target: loginAttempts.username, set: { failures: lockedUntil ? 0 : failures, lockedUntil } });
    await audit(db, u ? { id: u.id, username: u.username, institutionId: u.institutionId } : { username }, 'auth.login_failed', 'users', u?.id, portal);
    fail(401, 'Login yoki parol noto‘g‘ri');
  }
  if (portal === 'admin' && u!.role === 'student') fail(403, 'Administrativ panelga kirish huquqi yo‘q');
  if (portal === 'classroom' && u!.role === 'technician') fail(403, 'Texnik xodim uchun Admin → Qurilmalar bo‘limi mo‘ljallangan');

  await db.delete(loginAttempts).where(eq(loginAttempts.username, username));
  await db.delete(authSessions).where(lt(authSessions.expiresAt, new Date()));
  const token = newToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await db.insert(authSessions).values({ tokenHash: sha256(token), userId: u!.id, portal, expiresAt });
  await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, u!.id));
  await audit(db, u!, 'auth.login', 'users', u!.id, portal);
  return { token, expiresAt, user: (await loadUser(db, u!.id))! };
}

export async function setSessionCookie(token: string, expires: Date) {
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true, sameSite: 'lax', path: '/', expires, secure: process.env.NODE_ENV === 'production' && process.env.INSECURE_COOKIES !== 'true',
  });
}

export async function logout() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    const db = await getDb();
    await db.delete(authSessions).where(eq(authSessions.tokenHash, sha256(token)));
  }
  jar.delete(SESSION_COOKIE);
}

export async function revokeUserSessions(db: Db, userId: string) {
  await db.delete(authSessions).where(eq(authSessions.userId, userId));
}

/** For server pages: authenticated context or a redirect to the admin login. */
export async function pageCtx(): Promise<Ctx> {
  const user = await currentUser();
  if (!user) {
    const { redirect } = await import('next/navigation');
    redirect('/admin/login');
  }
  return { db: await getDb(), user: user! };
}
