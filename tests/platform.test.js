import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Platform } from '../shared/platform.js';
import { offlineAnswer } from '../shared/knowledge.js';

async function setup() {
  const p = await Platform.create({});
  const login = async (username, password, portal = 'admin') => {
    const r = await p.handle({ method: 'POST', path: '/api/auth/login', body: { username, password, portal } });
    assert.equal(r.status, 200, `login ${username}: ${JSON.stringify(r.body)}`);
    return r.token;
  };
  const call = (token, method, path, body) => {
    const [pathname, qs] = path.split('?');
    return p.handle({ method, path: pathname, query: Object.fromEntries(new URLSearchParams(qs || '')), body, token });
  };
  return { p, login, call };
}

test('valid credentials log in; a wrong password does not; passwords are never exposed', async () => {
  const { p, login, call } = await setup();
  const bad = await p.handle({ method: 'POST', path: '/api/auth/login', body: { username: 'teacher', password: 'nope' } });
  assert.equal(bad.status, 401);
  assert.equal(bad.token, undefined);
  const tok = await login('teacher', 'Teacher#2026', 'classroom');
  const me = await call(tok, 'GET', '/api/me');
  assert.equal(me.body.user.username, 'teacher');
  assert.equal(me.body.user.passwordHash, undefined);
  assert.equal(me.body.user.salt, undefined);
  assert.ok(p.data.users.every((u) => u.passwordHash && u.passwordHash !== 'Teacher#2026'));
});

test('login is rate limited after repeated failures', async () => {
  const { p } = await setup();
  for (let i = 0; i < 5; i++) await p.handle({ method: 'POST', path: '/api/auth/login', body: { username: 'director', password: 'x' } });
  const r = await p.handle({ method: 'POST', path: '/api/auth/login', body: { username: 'director', password: 'Director#2026' } });
  assert.equal(r.status, 429);
});

test('unauthenticated requests are rejected', async () => {
  const { call } = await setup();
  assert.equal((await call(null, 'GET', '/api/lessons')).status, 401);
});

test('institution isolation: a user never sees or touches another institution', async () => {
  const { login, call } = await setup();
  const tok = await login('maktab.admin', 'Admin#2026');
  const groups = (await call(tok, 'GET', '/api/groups')).body.items;
  assert.ok(groups.length > 0);
  assert.ok(groups.every((g) => g.institutionId === 'inst_school'));
  assert.equal((await call(tok, 'GET', '/api/lessons/les_nn')).status, 404);
  assert.equal((await call(tok, 'PUT', '/api/groups/grp_lola', { name: 'hack' })).status, 404);
  assert.equal((await call(tok, 'DELETE', '/api/students/stu_grp_ai21_1')).status, 404);
  // client-supplied institutionId is ignored for scoped users
  const created = await call(tok, 'POST', '/api/groups', { name: '9-V', institutionId: 'inst_uni' });
  assert.equal(created.body.item.institutionId, 'inst_school');
  // cross-institution references are refused
  const bad = await call(tok, 'POST', '/api/students', { fullName: 'X', groupId: 'grp_ai21' });
  assert.equal(bad.status, 400);
});

test('role permissions are enforced on the server', async () => {
  const { login, call } = await setup();
  const teacher = await login('teacher', 'Teacher#2026');
  assert.equal((await call(teacher, 'POST', '/api/users', { username: 'x', fullName: 'x', role: 'teacher', password: '12345678' })).status, 403);
  assert.equal((await call(teacher, 'GET', '/api/audit')).status, 403);
  const director = await login('director', 'Director#2026');
  assert.equal((await call(director, 'POST', '/api/sessions/start', { lessonId: 'les_solar', groupId: 'grp_5a' })).status, 403);
  const tech = await login('tech', 'Tech#2026');
  assert.equal((await call(tech, 'GET', '/api/students')).status, 403); // no access to personal data
  assert.equal((await call(tech, 'GET', '/api/devices')).status, 200);
  const admin = await login('maktab.admin', 'Admin#2026');
  assert.equal((await call(admin, 'POST', '/api/users', { username: 'boss', fullName: 'x', role: 'super_admin', password: '12345678' })).status, 403);
  assert.equal((await call(admin, 'POST', '/api/institutions', { name: 'x', type: 'school' })).status, 403);
});

test('teacher materials go to moderation and cannot self-approve', async () => {
  const { login, call } = await setup();
  const teacher = await login('teacher', 'Teacher#2026');
  const m = (await call(teacher, 'POST', '/api/materials', { title: 'Mening slaydim', status: 'approved' })).body.item;
  assert.equal(m.status, 'pending');
  assert.equal((await call(teacher, 'PUT', `/api/materials/${m.id}`, { status: 'approved' })).status, 403);
  const admin = await login('maktab.admin', 'Admin#2026');
  assert.equal((await call(admin, 'PUT', `/api/materials/${m.id}`, { status: 'approved' })).body.item.status, 'approved');
});

test('admin can create institution, group, user, subject and lesson; blocked users lose access', async () => {
  const { login, call } = await setup();
  const sa = await login('superadmin', 'Admin#2026');
  const inst = (await call(sa, 'POST', '/api/institutions', { name: 'Yangi maktab', type: 'school' })).body.item;
  const grp = (await call(sa, 'POST', '/api/groups', { name: '1-A', institutionId: inst.id })).body.item;
  const sub = (await call(sa, 'POST', '/api/subjects', { name: 'Matematika', institutionId: inst.id })).body.item;
  const usr = (await call(sa, 'POST', '/api/users', { username: 'new.teacher', fullName: 'Yangi', role: 'teacher', password: 'Secret#123', institutionId: inst.id })).body.item;
  const les = await call(sa, 'POST', '/api/lessons', { institutionId: inst.id, title: 'Sonlar', subjectId: sub.id, groupIds: [grp.id], sections: [{ title: 'Bir', sentences: ['Bir — birinchi son.'] }, { title: 'Ikki', sentences: ['Ikki.'] }] });
  assert.equal(les.status, 200);
  const nt = await login('new.teacher', 'Secret#123', 'classroom');
  const opts = (await call(nt, 'GET', '/api/classroom')).body;
  assert.deepEqual(opts.lessons.map((l) => l.title), ['Sonlar']);
  await call(sa, 'PUT', `/api/users/${usr.id}`, { status: 'blocked' });
  assert.equal((await call(nt, 'GET', '/api/me')).status, 401);
  const audit = (await call(sa, 'GET', '/api/audit?pageSize=200')).body.items.map((a) => a.action);
  assert.ok(audit.includes('users.update') && audit.includes('lessons.create'));
});

test('Appendix A: run a session, mark & correct attendance, save quiz result, get report', async () => {
  const { login, call } = await setup();
  const tok = await login('teacher', 'Teacher#2026', 'classroom');
  const { session, resumed } = (await call(tok, 'POST', '/api/sessions/start', { lessonId: 'les_solar', groupId: 'grp_5a' })).body;
  assert.equal(resumed, false);
  // accidental second start returns the same session
  const again = (await call(tok, 'POST', '/api/sessions/start', { lessonId: 'les_solar', groupId: 'grp_5a' })).body;
  assert.equal(again.session.id, session.id);
  assert.equal(again.resumed, true);
  await call(tok, 'POST', `/api/sessions/${session.id}/attendance`, { records: [{ studentId: 'stu_grp_5a_1', status: 'absent' }, { studentId: 'stu_grp_5a_2', status: 'present' }] });
  await call(tok, 'POST', `/api/sessions/${session.id}/attendance`, { records: [{ studentId: 'stu_grp_5a_1', status: 'late' }] });
  const ans = (await call(tok, 'POST', '/api/ai/answer', { lessonId: 'les_solar', question: 'Pluton nega sayyora emas?' })).body;
  assert.match(ans.answer, /mitti sayyora/);
  await call(tok, 'POST', `/api/sessions/${session.id}/questions`, { text: 'Pluton?', answer: ans.answer, confidence: ans.confidence });
  await call(tok, 'POST', `/api/sessions/${session.id}/results`, { quizIndex: 0, question: 'Q', answer: 'Merkuriy', correct: true });
  await call(tok, 'PUT', `/api/sessions/${session.id}/state`, { snapshot: { state: 'KNOWLEDGE_CHECK', completedSections: [0, 1, 2] } });
  const rep = (await call(tok, 'POST', `/api/sessions/${session.id}/complete`, {})).body;
  const a1 = rep.attendance.find((a) => a.studentId === 'stu_grp_5a_1');
  assert.equal(a1.status, 'late');
  assert.equal(a1.method, 'manual');
  assert.equal(a1.changedBy, 'teacher');
  assert.equal(rep.score, 100);
  assert.equal(rep.questions.length, 1);
  assert.ok(rep.lesson.sections.every((s) => s.done));
  assert.equal((await call(tok, 'POST', `/api/sessions/${session.id}/results`, {})).status, 409);
});

test('offline answers come only from approved material; off-topic questions are escalated', async () => {
  const { p } = await setup();
  const lesson = p.data.lessons.find((l) => l.id === 'les_solar');
  assert.match(offlineAnswer(lesson, 'Mars nega qizil rangda?').answer, /temir oksidi/);
  assert.match(offlineAnswer(lesson, 'Eng katta sayyora qaysi?').answer, /Yupiter/);
  const off = offlineAnswer(lesson, 'Futbolni kim ixtiro qilgan?');
  assert.equal(off.escalated, true);
  const ru = p.data.lessons.find((l) => l.id === 'les_nn');
  assert.match(offlineAnswer(ru, 'Что такое переобучение?').answer, /Переобучение/);
});
