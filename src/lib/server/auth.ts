import 'server-only';
import { cookies } from 'next/headers';
import { and, eq, gt, lt, ne } from 'drizzle-orm';
import { getDb, type Db } from '@/db';
import { authSessions, institutions, loginAttempts, users } from '@/db/schema';
import type { Role, SessionUser } from '@/lib/core/types';
import { fail } from './errors';
import { newToken, sha256, verifyPassword } from './password';
import { decryptSecret, verifyTotp } from './totp';
import { audit } from './audit';

export const SESSION_COOKIE = 'ait_session';
export const MFA_COOKIE = 'ait_mfa';
const SESSION_TTL_MS = 12 * 3600_000;
const MFA_TTL_MS = 5 * 60_000;
const MAX_FAILURES = 5;
const LOCK_MS = 60_000;
const PRIVILEGED: Role[] = ['super_admin', 'inst_admin'];

export type Portal = 'admin' | 'classroom';

export interface Ctx {
  db: Db;
  user: SessionUser;
}

/** Spec §13: MFA for privileged accounts. Enforced when REQUIRE_MFA_FOR_ADMINS=true. */
export const mfaPolicyApplies = (role: Role) => process.env.REQUIRE_MFA_FOR_ADMINS === 'true' && PRIVILEGED.includes(role);

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
    mfaEnabled: row.u.totpEnabled, mfaRequired: mfaPolicyApplies(row.u.role) && !row.u.totpEnabled,
  };
}

/** Hash of the current session token (to keep this session when revoking the others). */
export async function currentTokenHash() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return token ? sha256(token) : null;
}

/** Resolve the signed-in user from the session cookie, or null. */
export async function currentUser(): Promise<SessionUser | null> {
  const hash = await currentTokenHash();
  if (!hash) return null;
  const db = await getDb();
  const [s] = await db.select().from(authSessions).where(and(eq(authSessions.tokenHash, hash), eq(authSessions.stage, 'full'), gt(authSessions.expiresAt, new Date())));
  if (!s) return null;
  return loadUser(db, s.userId);
}

/** For route handlers: authenticated context or 401/403. */
export async function requireCtx(roles?: Role[], opts: { allowMfaSetup?: boolean } = {}): Promise<Ctx> {
  const user = await currentUser();
  if (!user) fail(401, 'Avtorizatsiya talab qilinadi');
  if (roles && !roles.includes(user!.role)) fail(403, 'Ruxsat yo‘q');
  if (user!.mfaRequired && !opts.allowMfaSetup) fail(403, 'Ikki bosqichli kirishni (MFA) yoqing: Admin → Profil');
  return { db: await getDb(), user: user! };
}

async function noteFailure(db: Db, username: string, failures: number) {
  const lockedUntil = failures >= MAX_FAILURES ? new Date(Date.now() + LOCK_MS) : null;
  await db.insert(loginAttempts).values({ username, failures, lockedUntil })
    .onConflictDoUpdate({ target: loginAttempts.username, set: { failures: lockedUntil ? 0 : failures, lockedUntil } });
}

async function checkLock(db: Db, username: string) {
  const [attempt] = await db.select().from(loginAttempts).where(eq(loginAttempts.username, username));
  if (attempt?.lockedUntil && attempt.lockedUntil > new Date()) fail(429, 'Juda ko‘p urinish. Bir daqiqadan so‘ng qayta urinib ko‘ring.');
  return attempt?.failures ?? 0;
}

async function openSession(db: Db, userId: string, portal: string) {
  await db.delete(authSessions).where(lt(authSessions.expiresAt, new Date()));
  const token = newToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await db.insert(authSessions).values({ tokenHash: sha256(token), userId, portal, expiresAt, stage: 'full' });
  await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, userId));
  return { token, expiresAt };
}

export type LoginResult =
  | { mfa: false; token: string; expiresAt: Date; user: SessionUser }
  | { mfa: true; token: string; expiresAt: Date };

export async function login(db: Db, username: string, password: string, portal: Portal): Promise<LoginResult> {
  username = username.trim().toLowerCase();
  const failures = await checkLock(db, username);
  const [u] = await db.select().from(users).where(eq(users.username, username));
  const ok = !!u && u.status === 'active' && (await verifyPassword(password, u.passwordHash));
  if (!ok) {
    await noteFailure(db, username, failures + 1);
    await audit(db, u ? { id: u.id, username: u.username, institutionId: u.institutionId } : { username }, 'auth.login_failed', 'users', u?.id, portal);
    fail(401, 'Login yoki parol noto‘g‘ri');
  }
  if (portal === 'admin' && u!.role === 'student') fail(403, 'Administrativ panelga kirish huquqi yo‘q');
  if (portal === 'classroom' && u!.role === 'technician') fail(403, 'Texnik xodim uchun Admin → Qurilmalar bo‘limi mo‘ljallangan');

  if (u!.totpEnabled && u!.totpSecret) {
    // Password is right; the session stays unusable until the one-time code is entered.
    const token = newToken();
    const expiresAt = new Date(Date.now() + MFA_TTL_MS);
    await db.insert(authSessions).values({ tokenHash: sha256(token), userId: u!.id, portal, expiresAt, stage: 'mfa' });
    return { mfa: true, token, expiresAt };
  }
  await db.delete(loginAttempts).where(eq(loginAttempts.username, username));
  const s = await openSession(db, u!.id, portal);
  await audit(db, u!, 'auth.login', 'users', u!.id, portal);
  return { mfa: false, ...s, user: (await loadUser(db, u!.id))! };
}

/** Second step: exchange a pending MFA ticket + TOTP code for a full session. */
export async function completeMfa(db: Db, mfaToken: string, code: string) {
  const [s] = await db.select().from(authSessions).where(and(eq(authSessions.tokenHash, sha256(mfaToken)), eq(authSessions.stage, 'mfa'), gt(authSessions.expiresAt, new Date())));
  if (!s) fail(401, 'Sessiya muddati tugadi. Qaytadan kiring.');
  const [u] = await db.select().from(users).where(eq(users.id, s!.userId));
  if (!u || u.status !== 'active' || !u.totpSecret) fail(401, 'Qaytadan kiring');
  const failures = await checkLock(db, u!.username);
  const step = verifyTotp(decryptSecret(u!.totpSecret!), code, u!.totpLastStep);
  if (step === null) {
    await noteFailure(db, u!.username, failures + 1);
    await audit(db, u!, 'auth.mfa_failed', 'users', u!.id, s!.portal);
    fail(401, 'Kod noto‘g‘ri yoki muddati o‘tgan');
  }
  await db.update(users).set({ totpLastStep: step }).where(eq(users.id, u!.id));
  await db.delete(authSessions).where(eq(authSessions.tokenHash, s!.tokenHash));
  await db.delete(loginAttempts).where(eq(loginAttempts.username, u!.username));
  const full = await openSession(db, u!.id, s!.portal);
  await audit(db, u!, 'auth.login', 'users', u!.id, `${s!.portal} +MFA`);
  return { ...full, user: (await loadUser(db, u!.id))! };
}

const secure = () => process.env.NODE_ENV === 'production' && process.env.INSECURE_COOKIES !== 'true';

export async function setSessionCookie(token: string, expires: Date, name = SESSION_COOKIE) {
  (await cookies()).set(name, token, { httpOnly: true, sameSite: 'lax', path: '/', expires, secure: secure() });
}

export async function logout() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    const db = await getDb();
    await db.delete(authSessions).where(eq(authSessions.tokenHash, sha256(token)));
  }
  jar.delete(SESSION_COOKIE);
  jar.delete(MFA_COOKIE);
}

export async function revokeUserSessions(db: Db, userId: string, keepTokenHash?: string | null) {
  await db.delete(authSessions).where(keepTokenHash ? and(eq(authSessions.userId, userId), ne(authSessions.tokenHash, keepTokenHash)) : eq(authSessions.userId, userId));
}

/** For server pages: authenticated context, or a redirect to login / MFA setup. */
export async function pageCtx(opts: { allowMfaSetup?: boolean } = {}): Promise<Ctx> {
  const user = await currentUser();
  const { redirect } = await import('next/navigation');
  if (!user) redirect('/admin/login');
  if (user!.mfaRequired && !opts.allowMfaSetup) redirect('/admin/profile?mfa=required');
  return { db: await getDb(), user: user! };
}
