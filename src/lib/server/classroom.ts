import 'server-only';
import { and, asc, desc, eq, inArray, ne, sql, type SQL } from 'drizzle-orm';
import type { PgColumn, PgTable } from 'drizzle-orm/pg-core';
import { z } from 'zod';
import * as t from '@/db/schema';
import type { AnswerResult, AvatarConfig, Lesson, LessonSnapshot, Role, SessionReport } from '@/lib/core/types';
import { offlineAnswer } from '@/lib/core/knowledge';
import type { Ctx } from './auth';
import { audit } from './audit';
import { fail } from './errors';
import { newId } from './password';
import { getEntity, getScoped } from './crud';
import { getAnswerProvider } from './ai';

const EDU: Role[] = ['super_admin', 'inst_admin', 'director', 'teacher'];
const TEACH: Role[] = ['super_admin', 'inst_admin', 'teacher'];
const ADMINS: Role[] = ['super_admin', 'inst_admin'];
const must = (ctx: Ctx, roles: Role[], msg = 'Ruxsat yo‘q') => { if (!roles.includes(ctx.user.role)) fail(403, msg); };
const tenant = (ctx: Ctx, col: PgColumn): SQL | undefined => (ctx.user.role === 'super_admin' ? undefined : eq(col, ctx.user.institutionId ?? '-'));

export async function classroomOptions(ctx: Ctx) {
  must(ctx, EDU);
  const instQ = ctx.db.select({ id: t.institutions.id, name: t.institutions.name, type: t.institutions.type, languages: t.institutions.languages }).from(t.institutions);
  const [institutions, groups, lessons, links, active] = await Promise.all([
    ctx.user.role === 'super_admin' ? instQ.orderBy(asc(t.institutions.name)) : instQ.where(eq(t.institutions.id, ctx.user.institutionId ?? '-')),
    ctx.db.select().from(t.groups).where(tenant(ctx, t.groups.institutionId)).orderBy(asc(t.groups.name)),
    ctx.db.select({ id: t.lessons.id, title: t.lessons.title, institutionId: t.lessons.institutionId, language: t.lessons.language, durationMin: t.lessons.durationMin, status: t.lessons.status, sections: sql<number>`jsonb_array_length(${t.lessons.sections})::int` })
      .from(t.lessons).where(and(tenant(ctx, t.lessons.institutionId), eq(t.lessons.status, 'published'))).orderBy(asc(t.lessons.title)),
    ctx.db.select().from(t.lessonGroups),
    ctx.db.select({ id: t.lessonSessions.id, lessonId: t.lessonSessions.lessonId, groupId: t.lessonSessions.groupId }).from(t.lessonSessions)
      .where(and(tenant(ctx, t.lessonSessions.institutionId), eq(t.lessonSessions.status, 'active'))),
  ]);
  return {
    institutions, groups,
    lessons: lessons.map((l) => ({ ...l, groupIds: links.filter((x) => x.lessonId === l.id).map((x) => x.groupId) })),
    activeSessions: active,
  };
}

export async function getAvatar(ctx: Ctx, institutionId?: string | null) {
  const id = ctx.user.role === 'super_admin' ? institutionId : ctx.user.institutionId;
  if (!id) fail(400, 'Muassasani tanlang');
  const [row] = await ctx.db.select({ avatar: t.institutions.avatar }).from(t.institutions).where(eq(t.institutions.id, id!));
  if (!row) fail(404, 'Muassasa topilmadi');
  return row.avatar;
}

const pt = z.tuple([z.number().min(0).max(10000), z.number().min(0).max(10000)]);
// Own uploads, bundled assets, or (legacy) inline images only — never arbitrary external URLs.
const mediaSrc = z.string().max(8_000_000).refine((v) => v.startsWith('data:image/') || /^\/?assets\//.test(v) || /^\/api\/avatar\/media\/[a-f0-9]{32}\.(png|jpg|webp|mp4|webm|mov)$/.test(v), 'Media manzili noto‘g‘ri');
const landmarksSchema = z.object({ eyeL: pt, eyeR: pt, mouthL: pt, mouthC: pt, mouthR: pt, chin: pt, neck: pt, eyeW: z.number().min(2).max(500), eyeH: z.number().min(2).max(500) });
const poseSchema = z.object({
  id: z.string().min(1).max(40),
  name: z.string().trim().min(1).max(80),
  kind: z.enum(['idle', 'welcome', 'explain', 'point', 'think', 'praise', 'listen']),
  media: z.enum(['image', 'video']),
  src: mediaSrc,
  landmarks: landmarksSchema,
  track: z.object({ fps: z.number().min(1).max(60), frames: z.array(landmarksSchema).max(3600) }).optional(),
  chroma: z.object({ color: z.tuple([z.number().min(0).max(255), z.number().min(0).max(255), z.number().min(0).max(255)]), tolerance: z.number().min(0).max(1) }).nullable().optional(),
});
const avatarSchema = z.object({
  name: z.string().trim().min(1).max(80),
  image: mediaSrc,
  landmarks: landmarksSchema,
  voiceGender: z.enum(['male', 'female']),
  charisma: z.number().min(0).max(1),
  poses: z.array(poseSchema).max(16).optional(),
});

export async function saveAvatar(ctx: Ctx, institutionId: string | undefined, input: unknown) {
  must(ctx, ADMINS);
  const id = ctx.user.role === 'super_admin' ? institutionId : ctx.user.institutionId;
  if (!id) fail(400, 'Muassasani tanlang');
  const avatar = avatarSchema.parse(input) as AvatarConfig;
  if (avatar.landmarks.mouthL[0] >= avatar.landmarks.mouthR[0]) fail(400, 'Og‘iz burchaklari tartibi noto‘g‘ri');
  await ctx.db.update(t.institutions).set({ avatar, updatedAt: new Date() }).where(eq(t.institutions.id, id!));
  await audit(ctx.db, ctx.user, 'avatar.update', 'institutions', id, avatar.image.startsWith('data:') ? 'yangi rasm' : 'sozlamalar');
  return avatar;
}

export async function startSession(ctx: Ctx, body: unknown) {
  must(ctx, TEACH, 'Darsni faqat o‘qituvchi boshlaydi');
  const { lessonId, groupId } = z.object({ lessonId: z.string().min(1), groupId: z.string().min(1) }).parse(body);
  const lesson = (await getEntity(ctx, 'lessons', lessonId)) as unknown as Lesson;
  const group = await getScoped(ctx, 'groups', groupId);
  if (group.institutionId !== lesson.institutionId) fail(400, 'Guruh va dars mos emas');
  // Protection against an accidental second start: the group's running session is reused.
  const [existing] = await ctx.db.select().from(t.lessonSessions).where(and(eq(t.lessonSessions.groupId, groupId), eq(t.lessonSessions.status, 'active')));
  if (existing) {
    if (existing.lessonId !== lessonId) fail(409, 'Bu guruhda boshqa dars davom etmoqda. Avval uni yakunlang yoki davom ettiring.');
    return { session: existing, lesson, resumed: true };
  }
  const [session] = await ctx.db.insert(t.lessonSessions).values({
    id: newId('ses'), institutionId: lesson.institutionId, lessonId, groupId, teacherId: ctx.user.id, teacherName: ctx.user.fullName,
  }).returning();
  await audit(ctx.db, ctx.user, 'sessions.start', 'sessions', session.id, lesson.title);
  return { session, lesson, resumed: false };
}

async function activeSession(ctx: Ctx, id: string) {
  must(ctx, TEACH);
  const s = (await getScoped(ctx, 'sessions', id)) as typeof t.lessonSessions.$inferSelect;
  if (s.status !== 'active') fail(409, 'Dars yakunlangan');
  return s;
}

export async function saveSnapshot(ctx: Ctx, id: string, body: unknown) {
  const s = await activeSession(ctx, id);
  const { snapshot } = z.object({ snapshot: z.record(z.string(), z.unknown()) }).parse(body);
  if (snapshot.lessonId !== s.lessonId) fail(400, 'Holat boshqa darsga tegishli');
  await ctx.db.update(t.lessonSessions).set({ snapshot: snapshot as unknown as LessonSnapshot, updatedAt: new Date() }).where(eq(t.lessonSessions.id, id));
  return { ok: true };
}

export async function markAttendance(ctx: Ctx, id: string, body: unknown) {
  const s = await activeSession(ctx, id);
  const { records } = z.object({ records: z.array(z.object({ studentId: z.string(), status: z.enum(['present', 'absent', 'late', 'excused']), method: z.enum(['manual', 'camera_assisted']).default('manual') })).max(500) }).parse(body);
  const students = await ctx.db.select({ id: t.students.id }).from(t.students).where(eq(t.students.groupId, s.groupId));
  const valid = new Set(students.map((x) => x.id));
  const existing = await ctx.db.select().from(t.attendance).where(eq(t.attendance.sessionId, id));
  for (const r of records) {
    if (!valid.has(r.studentId)) continue;
    const prev = existing.find((x) => x.studentId === r.studentId);
    if (prev && prev.status !== r.status) await audit(ctx.db, ctx.user, 'attendance.correct', 'attendance', prev.id, `${prev.status} → ${r.status}`);
    await ctx.db.insert(t.attendance)
      .values({ id: newId('att'), institutionId: s.institutionId, sessionId: id, studentId: r.studentId, status: r.status, method: r.method, changedBy: ctx.user.username })
      .onConflictDoUpdate({ target: [t.attendance.sessionId, t.attendance.studentId], set: { status: r.status, method: r.method, changedBy: ctx.user.username, changedAt: new Date() } });
  }
  return { items: await ctx.db.select().from(t.attendance).where(eq(t.attendance.sessionId, id)) };
}

export async function logQuestion(ctx: Ctx, id: string, body: unknown) {
  const s = await activeSession(ctx, id);
  const q = z.object({ text: z.string().trim().min(1).max(1000), answer: z.string().max(4000), confidence: z.number().nullable().optional(), source: z.string().max(40).optional(), escalated: z.boolean().default(false), section: z.number().int().nullable().optional() }).parse(body);
  const [row] = await ctx.db.insert(t.questions).values({ id: newId('qst'), institutionId: s.institutionId, sessionId: id, ...q, confidence: q.confidence ?? null, source: q.source ?? 'offline', section: q.section ?? null }).returning();
  return { item: row };
}

export async function saveResult(ctx: Ctx, id: string, body: unknown) {
  const s = await activeSession(ctx, id);
  const r = z.object({ quizIndex: z.number().int().min(0), question: z.string().max(500), answer: z.string().max(500), correct: z.boolean(), checkType: z.string().max(40).default('class_quiz') }).parse(body);
  const [row] = await ctx.db.insert(t.results).values({ id: newId('res'), institutionId: s.institutionId, sessionId: id, ...r }).returning();
  return { item: row };
}

export async function completeSession(ctx: Ctx, id: string, body: unknown) {
  await activeSession(ctx, id);
  const { snapshot } = z.object({ snapshot: z.record(z.string(), z.unknown()).optional() }).parse(body ?? {});
  await ctx.db.update(t.lessonSessions).set({ status: 'completed', endedAt: new Date(), updatedAt: new Date(), ...(snapshot ? { snapshot: snapshot as unknown as LessonSnapshot } : {}) }).where(eq(t.lessonSessions.id, id));
  await audit(ctx.db, ctx.user, 'sessions.complete', 'sessions', id);
  return report(ctx, id);
}

export async function report(ctx: Ctx, id: string): Promise<SessionReport> {
  must(ctx, EDU);
  const s = (await getScoped(ctx, 'sessions', id)) as typeof t.lessonSessions.$inferSelect;
  const [[lesson], [group], students, att, qs, res] = await Promise.all([
    ctx.db.select().from(t.lessons).where(eq(t.lessons.id, s.lessonId)),
    ctx.db.select().from(t.groups).where(eq(t.groups.id, s.groupId)),
    ctx.db.select().from(t.students).where(eq(t.students.groupId, s.groupId)).orderBy(asc(t.students.fullName)),
    ctx.db.select().from(t.attendance).where(eq(t.attendance.sessionId, id)),
    ctx.db.select().from(t.questions).where(eq(t.questions.sessionId, id)).orderBy(asc(t.questions.createdAt)),
    ctx.db.select().from(t.results).where(eq(t.results.sessionId, id)).orderBy(asc(t.results.quizIndex)),
  ]);
  const done = s.snapshot?.completedSections ?? [];
  return {
    session: { id: s.id, status: s.status, startedAt: s.startedAt.toISOString(), endedAt: s.endedAt?.toISOString() ?? null, teacherName: s.teacherName, snapshot: s.snapshot },
    lesson: { id: lesson.id, title: lesson.title, sections: lesson.sections.map((x, i) => ({ title: x.title, done: done.includes(i) })) },
    group: { id: group.id, name: group.name },
    attendance: students.map((st) => {
      const a = att.find((x) => x.studentId === st.id);
      return { studentId: st.id, fullName: st.fullName, status: a?.status ?? 'unmarked', method: a?.method, changedBy: a?.changedBy };
    }),
    questions: qs.map((q) => ({ id: q.id, text: q.text, answer: q.answer, escalated: q.escalated, source: q.source, confidence: q.confidence })),
    results: res.map((r) => ({ id: r.id, question: r.question, answer: r.answer, correct: r.correct, quizIndex: r.quizIndex })),
    score: res.length ? Math.round((100 * res.filter((r) => r.correct).length) / res.length) : null,
  };
}

export async function answerQuestion(ctx: Ctx, body: unknown): Promise<AnswerResult> {
  must(ctx, EDU);
  const { lessonId, sectionIndex, question, history } = z.object({
    lessonId: z.string(), sectionIndex: z.number().int().min(0).default(0), question: z.string().trim().min(1, 'Savol bo‘sh').max(1000),
    history: z.array(z.object({ q: z.string().max(1000), a: z.string().max(4000) })).max(10).default([]),
  }).parse(body);
  const lesson = (await getScoped(ctx, 'lessons', lessonId)) as unknown as Lesson;
  const [inst] = await ctx.db.select({ type: t.institutions.type }).from(t.institutions).where(eq(t.institutions.id, lesson.institutionId));
  const provider = getAnswerProvider();
  if (provider) {
    try {
      const r = await provider({ lesson, institutionType: inst?.type ?? 'school', question, sectionIndex, history });
      if (r) return r;
    } catch (e) {
      console.warn('AI provider failed, using offline engine:', (e as Error).message);
    }
  }
  return offlineAnswer(lesson, question, sectionIndex);
}

export async function dashboard(ctx: Ctx) {
  type Scoped = PgTable & { institutionId: PgColumn };
  const scope = (tbl: Scoped) => tenant(ctx, tbl.institutionId);
  const count = async (tbl: Scoped, extra?: SQL) =>
    (await ctx.db.select({ c: sql<number>`count(*)::int` }).from(tbl).where(and(scope(tbl), extra)))[0].c;
  const isEdu = EDU.includes(ctx.user.role);
  const [groups, studentsN, lessonsN, materialsN, devicesN, pending, offline] = await Promise.all([
    isEdu ? count(t.groups) : 0, isEdu ? count(t.students) : 0, isEdu ? count(t.lessons) : 0, isEdu ? count(t.materials) : 0,
    count(t.devices), isEdu ? count(t.materials, eq(t.materials.status, 'pending')) : 0, count(t.devices, eq(t.devices.status, 'offline')),
  ]);
  const institutionsN = ctx.user.role === 'super_admin' ? (await ctx.db.select({ c: sql<number>`count(*)::int` }).from(t.institutions))[0].c : 1;
  if (!isEdu) return { counts: { institutions: institutionsN, groups, students: studentsN, lessons: lessonsN, materials: materialsN, devices: devicesN }, sessions: { total: 0, active: 0, completed: 0 }, quizAccuracy: null, attendanceRate: null, pendingMaterials: 0, offlineDevices: offline, escalatedQuestions: 0, recentSessions: [], weekly: [] };
  const [sess] = await ctx.db.select({ total: sql<number>`count(*)::int`, active: sql<number>`count(*) filter (where ${t.lessonSessions.status} = 'active')::int` }).from(t.lessonSessions).where(scope(t.lessonSessions));
  const [quiz] = await ctx.db.select({ n: sql<number>`count(*)::int`, ok: sql<number>`count(*) filter (where ${t.results.correct})::int` }).from(t.results).where(scope(t.results));
  const [att] = await ctx.db.select({ n: sql<number>`count(*)::int`, ok: sql<number>`count(*) filter (where ${t.attendance.status} in ('present','late'))::int` }).from(t.attendance).where(scope(t.attendance));
  const [esc] = await ctx.db.select({ n: sql<number>`count(*)::int` }).from(t.questions).where(and(scope(t.questions), eq(t.questions.escalated, true)));
  const recent = await ctx.db.select({ id: t.lessonSessions.id, status: t.lessonSessions.status, startedAt: t.lessonSessions.startedAt, teacher: t.lessonSessions.teacherName, lesson: t.lessons.title, group: t.groups.name })
    .from(t.lessonSessions).innerJoin(t.lessons, eq(t.lessons.id, t.lessonSessions.lessonId)).innerJoin(t.groups, eq(t.groups.id, t.lessonSessions.groupId))
    .where(scope(t.lessonSessions)).orderBy(desc(t.lessonSessions.startedAt)).limit(8);
  const weekly = await ctx.db.select({ day: sql<string>`to_char(date_trunc('day', ${t.lessonSessions.startedAt}), 'YYYY-MM-DD')`, n: sql<number>`count(*)::int` })
    .from(t.lessonSessions).where(and(scope(t.lessonSessions), sql`${t.lessonSessions.startedAt} > now() - interval '14 days'`))
    .groupBy(sql`1`).orderBy(sql`1`);
  return {
    counts: { institutions: institutionsN, groups, students: studentsN, lessons: lessonsN, materials: materialsN, devices: devicesN },
    sessions: { total: sess.total, active: sess.active, completed: sess.total - sess.active },
    quizAccuracy: quiz.n ? Math.round((100 * quiz.ok) / quiz.n) : null,
    attendanceRate: att.n ? Math.round((100 * att.ok) / att.n) : null,
    pendingMaterials: pending, offlineDevices: offline, escalatedQuestions: esc.n,
    recentSessions: recent.map((r) => ({ ...r, startedAt: r.startedAt.toISOString() })),
    weekly,
  };
}

/** Materials referenced by a lesson (approved only), for the classroom board. */
export async function lessonMaterials(ctx: Ctx, lesson: Lesson) {
  const ids = lesson.sections.map((s) => s.materialId).filter(Boolean) as string[];
  if (!ids.length) return [];
  const rows = await ctx.db.select().from(t.materials).where(and(inArray(t.materials.id, ids), eq(t.materials.institutionId, lesson.institutionId), ne(t.materials.status, 'rejected')));
  return rows.map(({ fileKey, ...m }) => ({ ...m, hasFile: !!fileKey }));
}
