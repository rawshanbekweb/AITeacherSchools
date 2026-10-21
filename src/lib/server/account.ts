import 'server-only';
import { eq } from 'drizzle-orm';
import QRCode from 'qrcode';
import { z } from 'zod';
import { users } from '@/db/schema';
import type { Ctx } from './auth';
import { revokeUserSessions } from './auth';
import { audit } from './audit';
import { fail } from './errors';
import { hashPassword, verifyPassword } from './password';
import { decryptSecret, encryptSecret, newTotpSecret, otpauthUri, verifyTotp } from './totp';

async function row(ctx: Ctx) {
  const [u] = await ctx.db.select().from(users).where(eq(users.id, ctx.user.id));
  return u ?? fail(404, 'Topilmadi');
}

/** Step 1 of enrolment: a fresh secret, shown once as a QR code. Not active until confirmed. */
export async function startMfaSetup(ctx: Ctx) {
  const u = await row(ctx);
  if (u.totpEnabled) fail(409, 'MFA allaqachon yoqilgan');
  const secret = newTotpSecret();
  await ctx.db.update(users).set({ totpSecret: encryptSecret(secret), totpLastStep: null }).where(eq(users.id, u.id));
  const uri = otpauthUri(secret, u.username);
  return { secret, uri, qr: await QRCode.toDataURL(uri, { margin: 1, width: 240 }) };
}

export async function enableMfa(ctx: Ctx, input: unknown) {
  const { code } = z.object({ code: z.string().min(6).max(10) }).parse(input);
  const u = await row(ctx);
  if (!u.totpSecret) fail(400, 'Avval QR-kodni yarating');
  const step = verifyTotp(decryptSecret(u.totpSecret!), code, null);
  if (step === null) fail(400, 'Kod noto‘g‘ri. Ilovadagi joriy kodni kiriting.');
  await ctx.db.update(users).set({ totpEnabled: true, totpLastStep: step }).where(eq(users.id, u.id));
  await audit(ctx.db, ctx.user, 'auth.mfa_enabled', 'users', u.id);
  return { ok: true };
}

export async function disableMfa(ctx: Ctx, input: unknown) {
  const { password } = z.object({ password: z.string().min(1).max(200) }).parse(input);
  const u = await row(ctx);
  if (!(await verifyPassword(password, u.passwordHash))) fail(400, 'Parol noto‘g‘ri');
  if (process.env.REQUIRE_MFA_FOR_ADMINS === 'true' && ['super_admin', 'inst_admin'].includes(u.role)) fail(403, 'Administratorlar uchun MFA majburiy');
  await ctx.db.update(users).set({ totpEnabled: false, totpSecret: null, totpLastStep: null }).where(eq(users.id, u.id));
  await audit(ctx.db, ctx.user, 'auth.mfa_disabled', 'users', u.id);
  return { ok: true };
}

export async function changePassword(ctx: Ctx, input: unknown, keepTokenHash: string | null) {
  const { current, next } = z.object({ current: z.string().min(1).max(200), next: z.string().min(8, 'Yangi parol kamida 8 belgi').max(200) }).parse(input);
  const u = await row(ctx);
  if (!(await verifyPassword(current, u.passwordHash))) fail(400, 'Joriy parol noto‘g‘ri');
  if (current === next) fail(400, 'Yangi parol eskisidan farq qilishi kerak');
  await ctx.db.update(users).set({ passwordHash: await hashPassword(next), updatedAt: new Date() }).where(eq(users.id, u.id));
  await revokeUserSessions(ctx.db, u.id, keepTokenHash); // other devices are signed out
  await audit(ctx.db, ctx.user, 'auth.password_changed', 'users', u.id);
  return { ok: true };
}
