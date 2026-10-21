import { beforeAll, describe, expect, test } from 'vitest';
import { eq } from 'drizzle-orm';
import type { Db } from '@/db';
import * as t from '@/db/schema';
import { login } from '@/lib/server/auth';
import { createEntity, deleteEntity, getEntity, listEntity, updateEntity } from '@/lib/server/crud';
import { answerQuestion, classroomOptions, completeSession, logQuestion, markAttendance, saveAvatar, saveResult, saveSnapshot, startSession } from '@/lib/server/classroom';
import { offlineAnswer } from '@/lib/core/knowledge';
import { ZodError } from 'zod';
import { HttpError } from '@/lib/server/errors';
import { ctxFor, testDb } from './helpers';

const status = async (p: Promise<unknown>) => {
  try { await p; return 200; } catch (e) { if (e instanceof HttpError) return e.status; if (e instanceof ZodError) return 400; throw e; }
};

let db: Db;
beforeAll(async () => { db = await testDb(); });

describe('authentication', () => {
  test('valid credentials work, wrong password does not, hashes never leak', async () => {
    expect(await status(login(db, 'teacher', 'nope', 'classroom'))).toBe(401);
    const { user, token } = await login(db, 'teacher', 'Teacher#2026', 'classroom');
    expect(user.username).toBe('teacher');
    expect(token.length).toBeGreaterThan(30);
    const [row] = await db.select().from(t.users).where(eq(t.users.username, 'teacher'));
    expect(row.passwordHash.startsWith('scrypt$')).toBe(true);
    const [s] = await db.select().from(t.authSessions).where(eq(t.authSessions.userId, row.id));
    expect(s.tokenHash).not.toBe(token); // only the hash of the token is stored
    const admin = await ctxFor(db, 'maktab.admin', 'Admin#2026');
    const users = await listEntity(admin, 'users', {});
    expect(users.items.every((u) => !('passwordHash' in u))).toBe(true);
  });

  test('login is locked after repeated failures', async () => {
    for (let i = 0; i < 5; i++) await status(login(db, 'director', 'x', 'admin'));
    expect(await status(login(db, 'director', 'Director#2026', 'admin'))).toBe(429);
  });

  test('portal restrictions', async () => {
    expect(await status(login(db, 'tech', 'Tech#2026', 'classroom'))).toBe(403);
  });
});

describe('access control and tenant isolation', () => {
  test('institution admin only sees and changes own institution', async () => {
    const ctx = await ctxFor(db, 'maktab.admin', 'Admin#2026');
    const groups = await listEntity(ctx, 'groups', {});
    expect(groups.items.length).toBeGreaterThan(0);
    expect(groups.items.every((g) => g.institutionId === 'inst_school')).toBe(true);
    expect(await status(getEntity(ctx, 'lessons', 'les_nn'))).toBe(404);
    expect(await status(updateEntity(ctx, 'groups', 'grp_lola', { name: 'hack' }))).toBe(404);
    expect(await status(deleteEntity(ctx, 'students', 'stu_grp_ai21_1'))).toBe(404);
    const g = await createEntity(ctx, 'groups', { name: '9-V', institutionId: 'inst_uni' });
    expect(g.institutionId).toBe('inst_school');
    expect(await status(createEntity(ctx, 'students', { fullName: 'X', groupId: 'grp_ai21' }))).toBe(400);
    expect(await status(createEntity(ctx, 'lessons', { title: 'x', groupIds: ['grp_ai21'], sections: [{ title: 'a', sentences: ['b'] }] }))).toBe(400);
  });

  test('role permissions are enforced', async () => {
    const teacher = await ctxFor(db, 'teacher', 'Teacher#2026');
    expect(await status(createEntity(teacher, 'users', { username: 'x', fullName: 'x', role: 'teacher', password: '12345678' }))).toBe(403);
    expect(await status(listEntity(teacher, 'audit', {}))).toBe(403);
    const tech = await ctxFor(db, 'tech', 'Tech#2026');
    expect(await status(listEntity(tech, 'students', {}))).toBe(403); // no personal data for technicians
    expect(await status(listEntity(tech, 'devices', {}))).toBe(200);
    const admin = await ctxFor(db, 'maktab.admin', 'Admin#2026');
    expect(await status(createEntity(admin, 'users', { username: 'boss', fullName: 'x', role: 'super_admin', password: '12345678' }))).toBe(403);
    expect(await status(createEntity(admin, 'institutions', { name: 'x', type: 'school' }))).toBe(403);
    expect(await status(saveAvatar(teacher, undefined, {}))).toBe(403);
  });

  test('validation rejects bad input', async () => {
    const admin = await ctxFor(db, 'maktab.admin', 'Admin#2026');
    expect(await status(createEntity(admin, 'lessons', { title: 'Bo‘sh', sections: [] }))).toBe(400);
    expect(await status(createEntity(admin, 'users', { username: 'a b', fullName: 'x', role: 'teacher', password: '12345678' }))).toBe(400);
    expect(await status(createEntity(admin, 'users', { username: 'short', fullName: 'x', role: 'teacher', password: '123' }))).toBe(400);
  });

  test('teacher materials go to moderation and cannot be self-approved', async () => {
    const teacher = await ctxFor(db, 'teacher', 'Teacher#2026');
    const m = await createEntity(teacher, 'materials', { title: 'Mening slaydim', status: 'approved' });
    expect(m.status).toBe('pending');
    expect(await status(updateEntity(teacher, 'materials', String(m.id), { status: 'approved' }))).toBe(403);
    const admin = await ctxFor(db, 'maktab.admin', 'Admin#2026');
    expect(((await updateEntity(admin, 'materials', String(m.id), { status: 'approved' })) as { status?: string }).status).toBe('approved');
  });

  test('super admin creates a full institution; blocked users lose their sessions', async () => {
    const sa = await ctxFor(db, 'superadmin', 'Admin#2026');
    const inst = await createEntity(sa, 'institutions', { name: 'Yangi maktab', type: 'school' });
    const grp = await createEntity(sa, 'groups', { name: '1-A', institutionId: inst.id });
    const sub = await createEntity(sa, 'subjects', { name: 'Matematika', institutionId: inst.id });
    const usr = await createEntity(sa, 'users', { username: 'new.teacher', fullName: 'Yangi', role: 'teacher', password: 'Secret#123', institutionId: inst.id });
    await createEntity(sa, 'lessons', { institutionId: inst.id, title: 'Sonlar', status: 'published', subjectId: sub.id, groupIds: [grp.id], sections: [{ title: 'Bir', sentences: ['Bir — birinchi son.'] }, { title: 'Ikki', sentences: ['Ikki.'] }] });
    const nt = await ctxFor(db, 'new.teacher', 'Secret#123', 'classroom');
    const opts = await classroomOptions(nt);
    expect(opts.lessons.map((l) => l.title)).toEqual(['Sonlar']);
    expect(opts.lessons[0].groupIds).toEqual([grp.id]);
    await updateEntity(sa, 'users', String(usr.id), { status: 'blocked' });
    expect(await db.select().from(t.authSessions).where(eq(t.authSessions.userId, String(usr.id)))).toHaveLength(0);
    expect(await status(login(db, 'new.teacher', 'Secret#123', 'classroom'))).toBe(401);
    const auditRows = await listEntity(sa, 'audit', { pageSize: '200' });
    const actions = auditRows.items.map((a) => a.action);
    expect(actions).toContain('users.update');
    expect(actions).toContain('lessons.create');
  });
});

describe('Appendix A: lesson session end to end', () => {
  test('start, attendance with correction, question, quiz, completion report', async () => {
    const ctx = await ctxFor(db, 'teacher', 'Teacher#2026', 'classroom');
    const director = await ctxFor(db, 'maktab.admin', 'Admin#2026');
    const { session, resumed } = await startSession(ctx, { lessonId: 'les_solar', groupId: 'grp_5a' });
    expect(resumed).toBe(false);
    const again = await startSession(ctx, { lessonId: 'les_solar', groupId: 'grp_5a' });
    expect(again.session.id).toBe(session.id);
    expect(again.resumed).toBe(true);
    expect(await status(startSession(ctx, { lessonId: 'les_frac', groupId: 'grp_5a' }))).toBe(409);

    await markAttendance(ctx, session.id, { records: [{ studentId: 'stu_grp_5a_1', status: 'absent' }, { studentId: 'stu_grp_5a_2', status: 'present' }, { studentId: 'stu_grp_7b_1', status: 'present' }] });
    await markAttendance(ctx, session.id, { records: [{ studentId: 'stu_grp_5a_1', status: 'late' }] });

    const ans = await answerQuestion(ctx, { lessonId: 'les_solar', question: 'Pluton nega sayyora emas?' });
    expect(ans.answer).toMatch(/mitti sayyora/);
    await logQuestion(ctx, session.id, { text: 'Pluton?', answer: ans.answer, confidence: ans.confidence });
    await saveResult(ctx, session.id, { quizIndex: 0, question: 'Q', answer: 'Merkuriy', correct: true });
    await saveSnapshot(ctx, session.id, { snapshot: { lessonId: 'les_solar', state: 'KNOWLEDGE_CHECK', completedSections: [0, 1, 2] } });
    expect(await status(saveSnapshot(ctx, session.id, { snapshot: { lessonId: 'les_nn' } }))).toBe(400);

    const rep = await completeSession(ctx, session.id, {});
    const a1 = rep.attendance.find((a) => a.studentId === 'stu_grp_5a_1')!;
    expect(a1).toMatchObject({ status: 'late', method: 'manual', changedBy: 'teacher' });
    expect(rep.attendance.some((a) => a.studentId === 'stu_grp_7b_1')).toBe(false); // foreign student ignored
    expect(rep.score).toBe(100);
    expect(rep.questions).toHaveLength(1);
    expect(rep.lesson.sections.every((s) => s.done)).toBe(true);
    expect(await status(saveResult(ctx, session.id, { quizIndex: 1, question: 'q', answer: 'a', correct: false }))).toBe(409);
    const corrections = await listEntity(director, 'audit', { action: 'attendance.correct' });
    expect(corrections.items.length).toBe(1);

    const other = await ctxFor(db, 'professor', 'Teacher#2026', 'classroom');
    expect(await status(markAttendance(other, session.id, { records: [] }))).toBe(404);
  });

  test('offline answers use approved material only; off-topic questions are escalated', async () => {
    const [lesson] = await db.select().from(t.lessons).where(eq(t.lessons.id, 'les_solar'));
    expect(offlineAnswer(lesson, 'Mars nega qizil rangda?').answer).toMatch(/temir oksidi/);
    expect(offlineAnswer(lesson, 'Eng katta sayyora qaysi?').answer).toMatch(/Yupiter/);
    expect(offlineAnswer(lesson, 'Futbolni kim ixtiro qilgan?').escalated).toBe(true);
    const [ru] = await db.select().from(t.lessons).where(eq(t.lessons.id, 'les_nn'));
    expect(offlineAnswer(ru, 'Что такое переобучение?').answer).toMatch(/Переобучение/);
  });
});
