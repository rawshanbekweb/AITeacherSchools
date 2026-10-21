import { beforeAll, describe, expect, test } from 'vitest';
import { eq } from 'drizzle-orm';
import { ZodError } from 'zod';
import type { Db } from '@/db';
import * as t from '@/db/schema';
import { completeMfa, login } from '@/lib/server/auth';
import { changePassword, disableMfa, enableMfa, startMfaSetup } from '@/lib/server/account';
import { listEntity, updateEntity } from '@/lib/server/crud';
import { base32Encode, currentStep, decryptSecret, encryptSecret, totpAt, verifyTotp } from '@/lib/server/totp';
import { HttpError } from '@/lib/server/errors';
import { ctxFor, testDb } from './helpers';

process.env.APP_SECRET = 'test-secret';
const status = async (p: Promise<unknown>) => {
  try { await p; return 200; } catch (e) { if (e instanceof HttpError) return e.status; if (e instanceof ZodError) return 400; throw e; }
};

describe('TOTP', () => {
  test('RFC 6238 test vector (SHA-1)', () => {
    const secret = base32Encode(Buffer.from('12345678901234567890'));
    expect(totpAt(secret, 1)).toBe('287082'); // T = 59 s
    expect(totpAt(secret, Math.floor(1111111109 / 30))).toBe('081804');
  });
  test('verification window and replay protection', () => {
    const secret = base32Encode(Buffer.from('12345678901234567890'));
    const now = 1_700_000_000_000;
    const s = currentStep(now);
    expect(verifyTotp(secret, totpAt(secret, s), null, now)).toBe(s);
    expect(verifyTotp(secret, totpAt(secret, s - 1), null, now)).toBe(s - 1);
    expect(verifyTotp(secret, totpAt(secret, s - 3), null, now)).toBeNull();
    expect(verifyTotp(secret, totpAt(secret, s), s, now)).toBeNull(); // already used
    expect(verifyTotp(secret, 'abc', null, now)).toBeNull();
  });
  test('secrets are encrypted at rest', () => {
    const enc = encryptSecret('JBSWY3DPEHPK3PXP');
    expect(enc).not.toContain('JBSWY3DPEHPK3PXP');
    expect(decryptSecret(enc)).toBe('JBSWY3DPEHPK3PXP');
  });
});

describe('two-step login', () => {
  let db: Db;
  beforeAll(async () => { db = await testDb(); });

  test('enrol, sign in with a code, admin reset', async () => {
    const ctx = await ctxFor(db, 'maktab.admin', 'Admin#2026');
    const { secret, qr } = await startMfaSetup(ctx);
    expect(qr.startsWith('data:image/png')).toBe(true);
    expect(await status(enableMfa(ctx, { code: '000000' }))).toBe(400);
    await enableMfa(ctx, { code: totpAt(secret, currentStep()) });

    const [row] = await db.select().from(t.users).where(eq(t.users.username, 'maktab.admin'));
    expect(row.totpEnabled).toBe(true);
    expect(row.totpSecret).not.toContain(secret);

    const first = await login(db, 'maktab.admin', 'Admin#2026', 'admin');
    expect(first.mfa).toBe(true);
    // the pending ticket is not a session
    const [pending] = await db.select().from(t.authSessions).where(eq(t.authSessions.stage, 'mfa'));
    expect(pending).toBeTruthy();
    expect(await status(completeMfa(db, first.token, '123456'))).toBe(401);
    await db.update(t.users).set({ totpLastStep: currentStep() - 2 }).where(eq(t.users.id, row.id)); // allow the current code again in this test
    const done = await completeMfa(db, first.token, totpAt(secret, currentStep()));
    expect(done.user.mfaEnabled).toBe(true);
    expect(await status(completeMfa(db, first.token, totpAt(secret, currentStep())))).toBe(401); // ticket consumed

    // secrets never leave the server
    const sa = await ctxFor(db, 'superadmin', 'Admin#2026');
    const users = await listEntity(sa, 'users', { pageSize: '200' });
    expect(users.items.every((u) => !('totpSecret' in u) && !('passwordHash' in u))).toBe(true);

    await updateEntity(sa, 'users', row.id, { resetMfa: true });
    const again = await login(db, 'maktab.admin', 'Admin#2026', 'admin');
    expect(again.mfa).toBe(false);
  });

  test('disable needs the password; password change revokes other sessions', async () => {
    const ctx = await ctxFor(db, 'director', 'Director#2026');
    const { secret } = await startMfaSetup(ctx);
    await enableMfa(ctx, { code: totpAt(secret, currentStep()) });
    expect(await status(disableMfa(ctx, { password: 'wrong' }))).toBe(400);
    await disableMfa(ctx, { password: 'Director#2026' });
    const other = await login(db, 'director', 'Director#2026', 'admin');
    expect(other.mfa).toBe(false);
    expect(await status(changePassword(ctx, { current: 'nope', next: 'NewPass#2026' }, null))).toBe(400);
    await changePassword(ctx, { current: 'Director#2026', next: 'NewPass#2026' }, null);
    const sessions = await db.select().from(t.authSessions).where(eq(t.authSessions.userId, ctx.user.id));
    expect(sessions).toHaveLength(0);
    expect(await status(login(db, 'director', 'Director#2026', 'admin'))).toBe(401);
    expect((await login(db, 'director', 'NewPass#2026', 'admin')).mfa).toBe(false);
  });

  test('policy flags admins without MFA when REQUIRE_MFA_FOR_ADMINS=true', async () => {
    process.env.REQUIRE_MFA_FOR_ADMINS = 'true';
    try {
      const admin = await login(db, 'superadmin', 'Admin#2026', 'admin');
      const teacher = await login(db, 'teacher', 'Teacher#2026', 'classroom');
      expect(!admin.mfa && admin.user.mfaRequired).toBe(true);
      expect(!teacher.mfa && teacher.user.mfaRequired).toBe(false);
    } finally {
      delete process.env.REQUIRE_MFA_FOR_ADMINS;
    }
  });
});
