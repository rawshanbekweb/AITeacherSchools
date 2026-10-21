import 'server-only';
import { and, asc, desc, eq, ilike, inArray, ne, or, sql, type SQL } from 'drizzle-orm';
import type { PgColumn, PgTable } from 'drizzle-orm/pg-core';
import { z } from 'zod';
import * as t from '@/db/schema';
import type { Role } from '@/lib/core/types';
import { VISUAL_IDS } from '@/lib/core/visual-ids';
import { buildSeed } from '@/lib/core/seed';
import type { Ctx } from './auth';
import { revokeUserSessions } from './auth';
import { audit } from './audit';
import { fail } from './errors';
import { hashPassword, newId } from './password';
import { saveDataUrl } from './storage';

const ADMINS: Role[] = ['super_admin', 'inst_admin'];
const EDU: Role[] = ['super_admin', 'inst_admin', 'director', 'teacher'];
const STAFF: Role[] = [...EDU, 'technician'];

const str = z.string().trim();
const req = (label: string) => str.min(1, `${label} majburiy`);
const opt = str.max(500).optional().nullable();

const sectionSchema = z.object({ title: req('Bo‘lim sarlavhasi').max(200), materialId: str.optional().nullable().transform((v) => v || undefined), sentences: z.array(str.min(1).max(1000)).min(1, 'Bo‘limda kamida bitta gap bo‘lsin').max(80) });
const quizSchema = z.object({ q: req('Savol').max(500), options: z.array(str.min(1).max(200)).min(2).max(6), answer: z.number().int().min(0), explain: str.max(500).optional() })
  .refine((q) => q.answer < q.options.length, 'To‘g‘ri javob varianti noto‘g‘ri');
const faqSchema = z.object({ keys: z.array(str.min(1).max(60)).min(1).max(20), a: req('Javob').max(2000) });

type AnyTable = PgTable & Record<string, PgColumn>;
interface EntityDef {
  table: AnyTable;
  prefix: string;
  scoped: boolean;
  read: Role[];
  write: Role[];
  create: z.ZodType<Record<string, unknown>>;
  search: string[];
  filters: string[];
  order: string;
  label: (r: Record<string, unknown>) => string;
}

const defs: Record<string, EntityDef> = {
  institutions: {
    table: t.institutions as unknown as AnyTable, prefix: 'inst', scoped: false, read: STAFF, write: ['super_admin'],
    create: z.object({ name: req('Nomi').max(200), type: z.enum(['kindergarten', 'school', 'university']), city: opt, languages: z.array(z.enum(['uz', 'ru', 'en'])).default(['uz']), status: z.enum(['active', 'inactive']).default('active') }),
    search: ['name', 'city'], filters: ['type', 'status'], order: 'name', label: (r) => String(r.name),
  },
  departments: {
    table: t.departments as unknown as AnyTable, prefix: 'dep', scoped: true, read: EDU, write: ADMINS,
    create: z.object({ name: req('Nomi').max(200) }), search: ['name'], filters: [], order: 'name', label: (r) => String(r.name),
  },
  groups: {
    table: t.groups as unknown as AnyTable, prefix: 'grp', scoped: true, read: EDU, write: ADMINS,
    create: z.object({ name: req('Nomi').max(120), level: opt, room: opt, departmentId: str.optional().nullable().transform((v) => v || null) }),
    search: ['name', 'level', 'room'], filters: ['departmentId'], order: 'name', label: (r) => String(r.name),
  },
  students: {
    table: t.students as unknown as AnyTable, prefix: 'stu', scoped: true, read: EDU, write: ADMINS,
    create: z.object({ fullName: req('F.I.Sh.').max(200), groupId: req('Guruh'), status: z.enum(['active', 'inactive']).default('active') }),
    search: ['fullName'], filters: ['groupId', 'status'], order: 'fullName', label: (r) => String(r.fullName),
  },
  users: {
    table: t.users as unknown as AnyTable, prefix: 'usr', scoped: true, read: ADMINS, write: ADMINS,
    create: z.object({ username: req('Login').max(60).regex(/^[a-z0-9._-]+$/i, 'faqat lotin harflari, raqam, . _ -'), fullName: req('F.I.Sh.').max(200), role: z.enum(['super_admin', 'inst_admin', 'director', 'teacher', 'student', 'technician']), status: z.enum(['active', 'blocked']).default('active'), password: str.min(8, 'Parol kamida 8 belgi').max(200).optional() }),
    search: ['username', 'fullName'], filters: ['role', 'status'], order: 'username', label: (r) => String(r.username),
  },
  subjects: {
    table: t.subjects as unknown as AnyTable, prefix: 'sub', scoped: true, read: EDU, write: ADMINS,
    create: z.object({ name: req('Nomi').max(200), code: opt }), search: ['name', 'code'], filters: [], order: 'name', label: (r) => String(r.name),
  },
  materials: {
    table: t.materials as unknown as AnyTable, prefix: 'mat', scoped: true, read: EDU, write: [...ADMINS, 'teacher'],
    create: z.object({ title: req('Nomi').max(200), subject: opt, topic: opt, level: opt, language: opt, type: z.enum(['animation', 'image', 'pdf', 'presentation', 'scheme']).default('animation'), visual: z.enum(['', ...VISUAL_IDS]).optional().nullable().transform((v) => v || null), source: opt, rights: opt, status: z.enum(['pending', 'approved', 'rejected']).optional(), fileData: str.optional(), fileName: str.max(200).optional() }),
    search: ['title', 'subject', 'topic'], filters: ['status', 'type', 'language'], order: 'title', label: (r) => String(r.title),
  },
  lessons: {
    table: t.lessons as unknown as AnyTable, prefix: 'les', scoped: true, read: EDU, write: [...ADMINS, 'teacher'],
    create: z.object({
      title: req('Mavzu').max(200), subjectId: str.optional().nullable().transform((v) => v || null), language: z.enum(['uz', 'ru', 'en']).default('uz'),
      durationMin: z.coerce.number().int().min(5).max(240).default(30), status: z.enum(['draft', 'published']).default('draft'), greeting: str.max(2000).default(''),
      sections: z.array(sectionSchema).min(1, 'Kamida bitta bo‘lim kerak').max(30), quiz: z.array(quizSchema).max(30).default([]), faq: z.array(faqSchema).max(100).default([]),
      sampleQuestions: z.array(str.min(1).max(200)).max(20).default([]), groupIds: z.array(str).max(100).default([]),
    }),
    search: ['title'], filters: ['status', 'language', 'subjectId'], order: 'title', label: (r) => String(r.title),
  },
  schedule: {
    table: t.schedule as unknown as AnyTable, prefix: 'sch', scoped: true, read: EDU, write: ADMINS,
    create: z.object({ groupId: req('Guruh'), lessonId: req('Dars'), day: opt, time: opt, room: opt }), search: ['day', 'room'], filters: ['groupId', 'lessonId'], order: 'day', label: (r) => `${r.day ?? ''} ${r.time ?? ''}`,
  },
  devices: {
    table: t.devices as unknown as AnyTable, prefix: 'dev', scoped: true, read: [...ADMINS, 'teacher', 'technician'], write: [...ADMINS, 'technician'],
    create: z.object({ room: req('Auditoriya').max(120), kind: z.enum(['camera', 'microphone', 'speaker', 'panel', 'agent']), model: opt, status: z.enum(['online', 'offline']).default('online') }),
    search: ['room', 'model'], filters: ['kind', 'status', 'room'], order: 'room', label: (r) => `${r.room} ${r.kind}`,
  },
  sessions: { table: t.lessonSessions as unknown as AnyTable, prefix: 'ses', scoped: true, read: EDU, write: [], create: z.object({}), search: ['teacherName'], filters: ['status', 'groupId', 'lessonId'], order: '-startedAt', label: (r) => String(r.id) },
  attendance: { table: t.attendance as unknown as AnyTable, prefix: 'att', scoped: true, read: EDU, write: [], create: z.object({}), search: [], filters: ['sessionId', 'studentId', 'status'], order: '-changedAt', label: (r) => String(r.id) },
  audit: { table: t.auditLogs as unknown as AnyTable, prefix: 'aud', scoped: true, read: ADMINS, write: [], create: z.object({}), search: ['username', 'action', 'details'], filters: ['action', 'entity'], order: '-at', label: (r) => String(r.id) },
};

export const ENTITY_NAMES = Object.keys(defs);
export const entityDef = (name: string) => defs[name] ?? fail(404, 'Not found');
export const canRead = (role: Role, entity: string) => !!defs[entity]?.read.includes(role);
export const canWrite = (role: Role, entity: string) => !!defs[entity]?.write.includes(role);

/** Tenant filter: platform admins see everything, everyone else only their institution. */
function scopeWhere(ctx: Ctx, entity: string): SQL | undefined {
  const d = defs[entity];
  if (ctx.user.role === 'super_admin') return undefined;
  if (!d.scoped) return eq(d.table.id, ctx.user.institutionId ?? '-');
  const conds = [eq(d.table.institutionId, ctx.user.institutionId ?? '-')];
  if (entity === 'users') conds.push(ne(d.table.role, 'super_admin'));
  return and(...conds);
}

function serialize(entity: string, row: Record<string, unknown>) {
  if (entity === 'users') {
    const { passwordHash: _p, totpSecret: _t, totpLastStep: _s, ...rest } = row;
    return rest;
  }
  if (entity === 'materials') {
    const { fileKey, ...rest } = row;
    return { ...rest, hasFile: !!fileKey };
  }
  return row;
}

async function attachLessonGroups(ctx: Ctx, rows: Record<string, unknown>[]) {
  if (!rows.length) return rows;
  const links = await ctx.db.select().from(t.lessonGroups).where(inArray(t.lessonGroups.lessonId, rows.map((r) => String(r.id))));
  return rows.map((r) => ({ ...r, groupIds: links.filter((l) => l.lessonId === r.id).map((l) => l.groupId) }));
}

export async function listEntity(ctx: Ctx, entity: string, query: Record<string, string>) {
  const d = entityDef(entity);
  if (!canRead(ctx.user.role, entity)) fail(403, 'Ruxsat yo‘q');
  const where: (SQL | undefined)[] = [scopeWhere(ctx, entity)];
  for (const f of [...d.filters, ...(d.scoped && ctx.user.role === 'super_admin' ? ['institutionId'] : [])]) {
    if (query[f]) where.push(eq(d.table[f], query[f]));
  }
  if (entity === 'lessons' && query.groupId) {
    where.push(inArray(d.table.id, ctx.db.select({ id: t.lessonGroups.lessonId }).from(t.lessonGroups).where(eq(t.lessonGroups.groupId, query.groupId))));
  }
  if (query.q && d.search.length) {
    const q = `%${query.q.replace(/[%_\\]/g, (m) => '\\' + m)}%`;
    where.push(or(...d.search.map((c) => ilike(d.table[c], q))));
  }
  const cond = and(...where.filter(Boolean));
  const pageSize = Math.min(200, Math.max(1, Number(query.pageSize) || 50));
  const page = Math.max(1, Number(query.page) || 1);
  const orderCol = d.order.replace('-', '');
  const [{ total }] = await ctx.db.select({ total: sql<number>`count(*)::int` }).from(d.table).where(cond);
  let rows = (await ctx.db.select().from(d.table).where(cond)
    .orderBy(d.order.startsWith('-') ? desc(d.table[orderCol]) : asc(d.table[orderCol]))
    .limit(pageSize).offset((page - 1) * pageSize)) as Record<string, unknown>[];
  if (entity === 'lessons') rows = await attachLessonGroups(ctx, rows);
  return { items: rows.map((r) => serialize(entity, r)), total, page, pageSize };
}

export async function getScoped(ctx: Ctx, entity: string, id: string) {
  const d = entityDef(entity);
  const [row] = (await ctx.db.select().from(d.table).where(and(eq(d.table.id, id), scopeWhere(ctx, entity)))) as Record<string, unknown>[];
  if (!row) fail(404, 'Topilmadi'); // never reveal that a foreign record exists
  return row;
}

export async function getEntity(ctx: Ctx, entity: string, id: string) {
  if (!canRead(ctx.user.role, entity)) fail(403, 'Ruxsat yo‘q');
  let row = await getScoped(ctx, entity, id);
  if (entity === 'lessons') [row] = await attachLessonGroups(ctx, [row]);
  return serialize(entity, row);
}

async function checkRefs(ctx: Ctx, institutionId: string, rec: Record<string, unknown>) {
  const own = async (table: AnyTable, refId: unknown, label: string) => {
    if (!refId) return;
    const [r] = await ctx.db.select({ id: table.id }).from(table).where(and(eq(table.id, String(refId)), eq(table.institutionId, institutionId)));
    if (!r) fail(400, `${label} boshqa muassasaga tegishli yoki topilmadi`);
  };
  await own(t.groups as unknown as AnyTable, rec.groupId, 'Guruh');
  await own(t.lessons as unknown as AnyTable, rec.lessonId, 'Dars');
  await own(t.subjects as unknown as AnyTable, rec.subjectId, 'Fan');
  await own(t.departments as unknown as AnyTable, rec.departmentId, 'Bo‘lim');
  if (Array.isArray(rec.groupIds)) for (const g of rec.groupIds) await own(t.groups as unknown as AnyTable, g, 'Guruh');
  if (Array.isArray(rec.sections)) {
    for (const s of rec.sections as { materialId?: string }[]) await own(t.materials as unknown as AnyTable, s.materialId, 'Material');
  }
}

function resolveInstitution(ctx: Ctx, body: Record<string, unknown>) {
  if (ctx.user.role === 'super_admin') {
    if (!body.institutionId || typeof body.institutionId !== 'string') fail(400, 'Muassasani tanlang');
    return body.institutionId as string;
  }
  return ctx.user.institutionId!; // a client-supplied institution is never trusted
}

export async function createEntity(ctx: Ctx, entity: string, body: Record<string, unknown>) {
  const d = entityDef(entity);
  if (!canWrite(ctx.user.role, entity)) fail(403, 'Ruxsat yo‘q');
  const data = d.create.parse(body) as Record<string, unknown>;
  const rec: Record<string, unknown> = { id: newId(d.prefix), ...data };
  if (d.scoped) {
    rec.institutionId = resolveInstitution(ctx, body);
    await checkRefs(ctx, rec.institutionId as string, rec);
  }
  if (entity === 'institutions') rec.avatar = buildSeed().institutions[0].avatar;
  if (entity === 'users') {
    if (rec.role === 'super_admin' && ctx.user.role !== 'super_admin') fail(403, 'Super Admin yaratish huquqi yo‘q');
    if (!rec.password) fail(400, 'Parol kamida 8 belgidan iborat bo‘lsin');
    rec.username = String(rec.username).toLowerCase();
    const [dup] = await ctx.db.select({ id: t.users.id }).from(t.users).where(eq(t.users.username, rec.username as string));
    if (dup) fail(409, 'Bunday login mavjud');
    rec.passwordHash = await hashPassword(String(rec.password));
    delete rec.password;
    if (rec.role === 'super_admin') rec.institutionId = null;
  }
  if (entity === 'materials') {
    if (ctx.user.role === 'teacher' || !rec.status) rec.status = ctx.user.role === 'teacher' ? 'pending' : 'approved'; // moderation (spec §9)
    await attachFile(rec);
    rec.createdBy = ctx.user.username;
  }
  const groupIds = entity === 'lessons' ? (rec.groupIds as string[]) : null;
  if (groupIds) delete rec.groupIds;
  await ctx.db.transaction(async (tx) => {
    await tx.insert(d.table).values(rec as never);
    if (groupIds?.length) await tx.insert(t.lessonGroups).values(groupIds.map((groupId) => ({ lessonId: String(rec.id), groupId })));
  });
  await audit(ctx.db, ctx.user, `${entity}.create`, entity, String(rec.id), d.label(rec));
  return getEntity(ctx, entity, String(rec.id)).catch(() => serialize(entity, rec));
}

async function attachFile(rec: Record<string, unknown>) {
  if (typeof rec.fileData === 'string' && rec.fileData) {
    const f = await saveDataUrl(rec.fileData, String(rec.fileName || 'file'));
    rec.fileKey = f.key;
    rec.fileMime = f.mime;
    rec.fileName = f.name;
  }
  delete rec.fileData;
}

export async function updateEntity(ctx: Ctx, entity: string, id: string, body: Record<string, unknown>) {
  const d = entityDef(entity);
  // Institution admins may edit their own institution profile (but not its type or status).
  const ownInstitution = entity === 'institutions' && ctx.user.role === 'inst_admin' && id === ctx.user.institutionId;
  if (!ownInstitution && !canWrite(ctx.user.role, entity)) fail(403, 'Ruxsat yo‘q');
  const row = await getScoped(ctx, entity, id);
  const schema = d.create as unknown as z.ZodObject<z.ZodRawShape>;
  let patch = schema.partial().parse(body) as Record<string, unknown>;
  // partial() keeps defaults; drop keys the client did not send
  patch = Object.fromEntries(Object.entries(patch).filter(([k]) => k in body));
  if (ownInstitution) patch = Object.fromEntries(Object.entries(patch).filter(([k]) => ['name', 'city', 'languages'].includes(k)));
  if (d.scoped) await checkRefs(ctx, String(row.institutionId), patch);

  if (entity === 'users') {
    if (row.role === 'super_admin' && ctx.user.role !== 'super_admin') fail(403, 'Ruxsat yo‘q');
    if (patch.role === 'super_admin' && ctx.user.role !== 'super_admin') fail(403, 'Ruxsat yo‘q');
    if (row.id === ctx.user.id && patch.status && patch.status !== 'active') fail(400, 'O‘zingizni bloklay olmaysiz');
    if (row.id === ctx.user.id && patch.role && patch.role !== row.role) fail(400, 'O‘z rolingizni o‘zgartira olmaysiz');
    if (patch.username) {
      patch.username = String(patch.username).toLowerCase();
      const [dup] = await ctx.db.select({ id: t.users.id }).from(t.users).where(and(eq(t.users.username, patch.username as string), ne(t.users.id, id)));
      if (dup) fail(409, 'Bunday login mavjud');
    }
    if (patch.password) patch.passwordHash = await hashPassword(String(patch.password));
    delete patch.password;
    if (body.resetMfa === true) {
      // lost phone: an administrator clears the second factor; the user enrols again on next login
      patch.totpEnabled = false;
      patch.totpSecret = null;
      patch.totpLastStep = null;
    }
  }
  if (entity === 'materials') {
    if (ctx.user.role === 'teacher' && patch.status && patch.status !== row.status) fail(403, 'Materialni faqat administrator tasdiqlaydi');
    await attachFile(patch);
  }
  const groupIds = entity === 'lessons' && Array.isArray(patch.groupIds) ? (patch.groupIds as string[]) : null;
  delete patch.groupIds;
  if ('updatedAt' in d.table) patch.updatedAt = new Date();
  await ctx.db.transaction(async (tx) => {
    if (Object.keys(patch).length) await tx.update(d.table).set(patch as never).where(eq(d.table.id, id));
    if (groupIds) {
      await tx.delete(t.lessonGroups).where(eq(t.lessonGroups.lessonId, id));
      if (groupIds.length) await tx.insert(t.lessonGroups).values(groupIds.map((groupId) => ({ lessonId: id, groupId })));
    }
  });
  if (entity === 'users' && (patch.status === 'blocked' || patch.passwordHash || body.resetMfa === true)) await revokeUserSessions(ctx.db, id);
  const what = entity === 'users' && body.resetMfa === true ? 'MFA tiklandi' : entity === 'users' && patch.status ? `status=${patch.status}` : Object.keys(patch).filter((k) => !['passwordHash', 'updatedAt', 'totpSecret', 'totpLastStep'].includes(k)).join(', ');
  await audit(ctx.db, ctx.user, `${entity}.update`, entity, id, what);
  return getEntity(ctx, entity, id).catch(() => ({ id }));
}

export async function deleteEntity(ctx: Ctx, entity: string, id: string) {
  const d = entityDef(entity);
  if (!canWrite(ctx.user.role, entity)) fail(403, 'Ruxsat yo‘q');
  const row = await getScoped(ctx, entity, id);
  if (entity === 'users' && row.id === ctx.user.id) fail(400, 'O‘zingizni o‘chira olmaysiz');
  if (entity === 'users' && row.role === 'super_admin' && ctx.user.role !== 'super_admin') fail(403, 'Ruxsat yo‘q');
  await ctx.db.delete(d.table).where(eq(d.table.id, id)); // FK cascades remove dependent rows
  await audit(ctx.db, ctx.user, `${entity}.delete`, entity, id, d.label(row));
  return { ok: true };
}
