// Platform core: data store, authentication, role/institution access control, audit log and
// the REST-style API router. Runs unchanged in Node (server/index.js) and in the browser
// (offline demo mode), so the permission rules exist in exactly one place.

import { buildSeed, DEMO_ACCOUNTS } from './seed.js';
import { offlineAnswer } from './knowledge.js';

const subtle = globalThis.crypto.subtle;
const enc = new TextEncoder();
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
const randomHex = (n = 16) => hex(globalThis.crypto.getRandomValues(new Uint8Array(n)));
const newId = (prefix) => `${prefix}_${randomHex(6)}`;

export async function hashPassword(password, salt = randomHex(16)) {
  const key = await subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode(salt), iterations: 120000 }, key, 256);
  return { salt, hash: hex(bits) };
}
function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

export const ROLES = ['super_admin', 'inst_admin', 'director', 'teacher', 'student', 'technician'];
const ADMINS = ['super_admin', 'inst_admin'];
const EDU_STAFF = ['super_admin', 'inst_admin', 'director', 'teacher'];
const ALL_STAFF = [...EDU_STAFF, 'technician'];

// Per-entity access rules. `scoped` entities belong to one institution and are invisible to
// users of other institutions (spec §3, §10). `fields` is the write whitelist.
const ENTITIES = {
  institutions: { scoped: false, read: ALL_STAFF, write: ['super_admin'], fields: ['name', 'type', 'city', 'languages', 'status'] },
  departments: { scoped: true, read: EDU_STAFF, write: ADMINS, fields: ['name'] },
  groups: { scoped: true, read: EDU_STAFF, write: ADMINS, fields: ['name', 'level', 'room', 'departmentId'] },
  students: { scoped: true, read: EDU_STAFF, write: ADMINS, fields: ['fullName', 'groupId', 'status'] },
  subjects: { scoped: true, read: EDU_STAFF, write: ADMINS, fields: ['name', 'code'] },
  materials: { scoped: true, read: EDU_STAFF, write: [...ADMINS, 'teacher'], fields: ['title', 'subject', 'topic', 'level', 'language', 'type', 'visual', 'source', 'rights', 'status', 'fileName', 'fileData'] },
  lessons: { scoped: true, read: EDU_STAFF, write: [...ADMINS, 'teacher'], fields: ['title', 'subjectId', 'groupIds', 'language', 'durationMin', 'status', 'greeting', 'sections', 'quiz', 'faq', 'sampleQuestions'] },
  schedule: { scoped: true, read: EDU_STAFF, write: ADMINS, fields: ['groupId', 'lessonId', 'day', 'time', 'room'] },
  devices: { scoped: true, read: [...ADMINS, 'teacher', 'technician'], write: [...ADMINS, 'technician'], fields: ['room', 'kind', 'model', 'status'] },
  users: { scoped: true, read: ADMINS, write: ADMINS, fields: ['username', 'fullName', 'role', 'status'] },
  sessions: { scoped: true, read: EDU_STAFF, write: [], fields: [] },
  attendance: { scoped: true, read: EDU_STAFF, write: [], fields: [] },
  questions: { scoped: true, read: EDU_STAFF, write: [], fields: [] },
  results: { scoped: true, read: EDU_STAFF, write: [], fields: [] },
  audit: { scoped: true, read: ADMINS, write: [], fields: [] },
};
const PREFIX = { institutions: 'inst', departments: 'dep', groups: 'grp', students: 'stu', subjects: 'sub', materials: 'mat', lessons: 'les', schedule: 'sch', devices: 'dev', users: 'usr' };

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
const fail = (status, message) => { throw new HttpError(status, message); };

export class Platform {
  /** @param {{data?:object, persist?:(data)=>void, ai?:Function, keepSessionsInData?:boolean}} opts */
  constructor(opts = {}) {
    this.persist = opts.persist || (() => {});
    this.ai = opts.ai || null;
    this.keepSessionsInData = !!opts.keepSessionsInData;
    this.data = opts.data;
    this.tokens = new Map(this.keepSessionsInData ? Object.entries(this.data?.tokens || {}) : []);
    this.loginFailures = new Map();
  }

  static async create(opts = {}) {
    const p = new Platform(opts);
    if (!p.data || !p.data.institutions) {
      p.data = buildSeed();
      for (const a of DEMO_ACCOUNTS) await p.insertUser(a);
      p.log(null, 'system.seed', 'platform', null, 'Demo ma’lumotlari yaratildi');
      p.save();
    }
    return p;
  }

  async insertUser({ username, password, role, fullName, institutionId, status = 'active' }) {
    const { salt, hash } = await hashPassword(password);
    const u = { id: newId('usr'), username, fullName, role, institutionId, status, salt, passwordHash: hash, createdAt: new Date().toISOString() };
    this.data.users.push(u);
    return u;
  }

  save() {
    if (this.keepSessionsInData) this.data.tokens = Object.fromEntries(this.tokens);
    this.persist(this.data);
  }

  log(user, action, entity, entityId, details = '') {
    this.data.audit.unshift({
      id: newId('aud'), at: new Date().toISOString(), userId: user?.id || null, username: user?.username || '—',
      institutionId: user?.institutionId ?? null, action, entity, entityId, details: String(details).slice(0, 300),
    });
    if (this.data.audit.length > 2000) this.data.audit.length = 2000;
  }

  publicUser(u) {
    if (!u) return null;
    const { salt, passwordHash, ...rest } = u;
    const inst = this.data.institutions.find((i) => i.id === u.institutionId);
    return { ...rest, institutionName: inst?.name || null, institutionType: inst?.type || null };
  }

  userFromToken(token) {
    if (!token) return null;
    const t = this.tokens.get(token);
    if (!t || t.expires < Date.now()) { if (t) this.tokens.delete(token); return null; }
    const u = this.data.users.find((x) => x.id === t.userId);
    return u && u.status === 'active' ? u : null;
  }

  // ───────────────────────── access helpers ─────────────────────────
  canRead(user, entity) { return ENTITIES[entity]?.read.includes(user.role); }
  canWrite(user, entity) { return ENTITIES[entity]?.write.includes(user.role); }

  visible(user, entity, rows) {
    const def = ENTITIES[entity];
    if (user.role === 'super_admin') return rows;
    if (!def.scoped) return rows.filter((r) => r.id === user.institutionId);
    let out = rows.filter((r) => r.institutionId === user.institutionId);
    if (entity === 'users') out = out.filter((r) => r.role !== 'super_admin');
    return out;
  }

  getScoped(user, entity, id) {
    const row = this.data[entity].find((r) => r.id === id);
    if (!row) fail(404, 'Topilmadi');
    if (!this.visible(user, entity, [row]).length) fail(404, 'Topilmadi'); // do not reveal foreign data
    return row;
  }

  // ───────────────────────── router ─────────────────────────
  async handle({ method = 'GET', path, query = {}, body = {}, token }) {
    try {
      const out = await this.route(method.toUpperCase(), path.replace(/\/+$/, ''), query, body || {}, token);
      return { status: 200, ...out };
    } catch (e) {
      if (e instanceof HttpError) return { status: e.status, body: { error: e.message } };
      console.error(e);
      return { status: 500, body: { error: 'Ichki xatolik' } };
    }
  }

  async route(method, path, query, body, token) {
    const parts = path.split('/').filter(Boolean); // ['api', ...]
    if (parts[0] !== 'api') fail(404, 'Not found');
    const [, a, b, c] = parts;

    if (a === 'health') return { body: { ok: true, ai: this.ai ? 'llm' : 'offline', time: new Date().toISOString() } };
    if (a === 'auth' && b === 'login' && method === 'POST') return this.login(body);

    const user = this.userFromToken(token);
    if (!user) fail(401, 'Avtorizatsiya talab qilinadi');

    if (a === 'auth' && b === 'logout') { this.tokens.delete(token); this.save(); return { body: { ok: true }, clearToken: true }; }
    if (a === 'me') return { body: { user: this.publicUser(user) } };
    if (a === 'classroom') return { body: this.classroomOptions(user) };
    if (a === 'avatar') return this.avatar(user, method, query, body);
    if (a === 'ai' && b === 'answer' && method === 'POST') return this.answer(user, body);
    if (a === 'dashboard') return { body: this.dashboard(user) };
    if (a === 'sessions' && b && c) return this.sessionAction(user, method, b, c, body);
    if (a === 'sessions' && b === 'start' && method === 'POST') return this.startSession(user, body);

    if (ENTITIES[a]) {
      if (method === 'GET' && !b) return { body: this.list(user, a, query) };
      if (method === 'GET' && b) {
        if (!this.canRead(user, a)) fail(403, 'Ruxsat yo‘q');
        return { body: { item: this.clean(a, this.getScoped(user, a, b)) } };
      }
      if (method === 'POST' && !b) return { body: { item: await this.create(user, a, body) } };
      if (method === 'PUT' && b) return { body: { item: await this.update(user, a, b, body) } };
      if (method === 'DELETE' && b) return { body: this.remove(user, a, b) };
    }
    fail(404, 'Not found');
  }

  // ───────────────────────── auth ─────────────────────────
  async login({ username, password, portal }) {
    username = String(username || '').trim().toLowerCase();
    const f = this.loginFailures.get(username);
    if (f && f.until > Date.now()) fail(429, 'Juda ko‘p urinish. Bir daqiqadan so‘ng qayta urinib ko‘ring.');
    const u = this.data.users.find((x) => x.username === username);
    let ok = false;
    if (u && u.status === 'active') {
      const { hash } = await hashPassword(String(password || ''), u.salt);
      ok = safeEqual(hash, u.passwordHash);
    }
    if (!ok) {
      const n = (f?.count || 0) + 1;
      this.loginFailures.set(username, { count: n, until: n >= 5 ? Date.now() + 60_000 : 0 });
      this.log(u || { username }, 'auth.login_failed', 'users', u?.id || null, portal || '');
      this.save();
      fail(401, 'Login yoki parol noto‘g‘ri');
    }
    if (portal === 'admin' && u.role === 'student') fail(403, 'Administrativ panelga kirish huquqi yo‘q');
    if (portal === 'classroom' && u.role === 'technician') fail(403, 'Texnik xodim Classroom’dan foydalanmaydi — Admin → Qurilmalar bo‘limiga kiring');
    this.loginFailures.delete(username);
    const token = randomHex(32);
    this.tokens.set(token, { userId: u.id, expires: Date.now() + 12 * 3600_000 });
    this.log(u, 'auth.login', 'users', u.id, portal || '');
    this.save();
    return { body: { user: this.publicUser(u) }, token };
  }

  // ───────────────────────── generic CRUD ─────────────────────────
  clean(entity, row) {
    if (entity === 'users') return this.publicUser(row);
    if (entity === 'materials' && row.fileData) { const { fileData, ...r } = row; return { ...r, hasFile: true }; }
    return row;
  }

  list(user, entity, query) {
    if (!this.canRead(user, entity)) fail(403, 'Ruxsat yo‘q');
    let rows = this.visible(user, entity, this.data[entity]);
    for (const [k, v] of Object.entries(query)) {
      if (['q', 'page', 'pageSize'].includes(k) || v === '' || v == null) continue;
      rows = rows.filter((r) => (Array.isArray(r[k]) ? r[k].includes(v) : String(r[k]) === String(v)));
    }
    if (query.q) {
      const q = String(query.q).toLowerCase();
      rows = rows.filter((r) => Object.values(r).some((v) => typeof v === 'string' && !v.startsWith('data:') && v.toLowerCase().includes(q)));
    }
    const total = rows.length;
    const pageSize = Math.min(200, Math.max(1, Number(query.pageSize) || 50));
    const page = Math.max(1, Number(query.page) || 1);
    const items = rows.slice((page - 1) * pageSize, page * pageSize).map((r) => this.clean(entity, r));
    return { items, total, page, pageSize };
  }

  pick(entity, body) {
    const out = {};
    for (const f of ENTITIES[entity].fields) if (body[f] !== undefined) out[f] = body[f];
    return out;
  }

  resolveInstitution(user, body) {
    if (user.role === 'super_admin') {
      const id = body.institutionId;
      if (!id || !this.data.institutions.some((i) => i.id === id)) fail(400, 'Muassasani tanlang');
      return id;
    }
    return user.institutionId; // never trust a client-supplied institution for scoped users
  }

  checkRefs(user, entity, rec) {
    const own = (coll, id) => !id || this.data[coll].some((r) => r.id === id && r.institutionId === rec.institutionId);
    if (rec.groupId && !own('groups', rec.groupId)) fail(400, 'Guruh boshqa muassasaga tegishli');
    if (rec.lessonId && !own('lessons', rec.lessonId)) fail(400, 'Dars boshqa muassasaga tegishli');
    if (rec.subjectId && !own('subjects', rec.subjectId)) fail(400, 'Fan boshqa muassasaga tegishli');
    if (Array.isArray(rec.groupIds) && !rec.groupIds.every((g) => own('groups', g))) fail(400, 'Guruh boshqa muassasaga tegishli');
    if (entity === 'users' && rec.role) {
      if (!ROLES.includes(rec.role)) fail(400, 'Noma’lum rol');
      if (rec.role === 'super_admin' && user.role !== 'super_admin') fail(403, 'Super Admin yaratish huquqi yo‘q');
    }
    if (entity === 'lessons' && rec.sections) {
      if (!Array.isArray(rec.sections) || !rec.sections.length) fail(400, 'Darsda kamida bitta bo‘lim bo‘lishi kerak');
      for (const s of rec.sections) if (!s.title || !Array.isArray(s.sentences) || !s.sentences.length) fail(400, 'Har bir bo‘limda sarlavha va matn bo‘lishi kerak');
    }
  }

  validate(entity, rec) {
    const required = { institutions: ['name', 'type'], departments: ['name'], groups: ['name'], students: ['fullName', 'groupId'], subjects: ['name'], materials: ['title'], lessons: ['title', 'sections'], schedule: ['groupId', 'lessonId'], devices: ['room', 'kind'], users: ['username', 'fullName', 'role'] }[entity] || [];
    for (const f of required) if (rec[f] === undefined || rec[f] === '' || rec[f] === null) fail(400, `«${f}» maydoni majburiy`);
    if (entity === 'institutions' && !['kindergarten', 'school', 'university'].includes(rec.type)) fail(400, 'Muassasa turi noto‘g‘ri');
  }

  async create(user, entity, body) {
    if (!this.canWrite(user, entity)) fail(403, 'Ruxsat yo‘q');
    const rec = { id: newId(PREFIX[entity] || entity), ...this.pick(entity, body) };
    if (ENTITIES[entity].scoped) rec.institutionId = this.resolveInstitution(user, body);
    if (entity === 'institutions') rec.avatar = structuredClone(this.data.institutions[0]?.avatar || null);
    if (entity === 'lessons') { rec.sections ||= []; rec.quiz ||= []; rec.faq ||= []; rec.groupIds ||= []; }
    if (entity === 'materials' && user.role === 'teacher') rec.status = 'pending'; // moderation (spec §9)
    this.validate(entity, rec);
    this.checkRefs(user, entity, rec);
    if (entity === 'users') {
      rec.username = String(rec.username).trim().toLowerCase();
      if (this.data.users.some((u) => u.username === rec.username)) fail(409, 'Bunday login mavjud');
      if (!body.password || String(body.password).length < 8) fail(400, 'Parol kamida 8 belgidan iborat bo‘lsin');
      const u = await this.insertUser({ ...rec, password: body.password });
      this.log(user, 'users.create', 'users', u.id, `${u.username} (${u.role})`);
      this.save();
      return this.publicUser(u);
    }
    rec.createdAt = new Date().toISOString();
    this.data[entity].push(rec);
    this.log(user, `${entity}.create`, entity, rec.id, rec.name || rec.title || rec.fullName || '');
    this.save();
    return this.clean(entity, rec);
  }

  async update(user, entity, id, body) {
    if (entity === 'institutions' && user.role === 'inst_admin' && id === user.institutionId) {
      // institution admins may edit their own institution's profile, but not its type
      const row = this.getScoped(user, entity, id);
      Object.assign(row, this.pick(entity, { name: body.name, city: body.city, languages: body.languages }));
      this.log(user, 'institutions.update', entity, id, row.name);
      this.save();
      return row;
    }
    if (!this.canWrite(user, entity)) fail(403, 'Ruxsat yo‘q');
    const row = this.getScoped(user, entity, id);
    const patch = this.pick(entity, body);
    if (entity === 'materials' && user.role === 'teacher' && patch.status && patch.status !== row.status) fail(403, 'Materialni faqat administrator tasdiqlaydi');
    const next = { ...row, ...patch };
    this.validate(entity, next);
    this.checkRefs(user, entity, next);
    if (entity === 'users') {
      if (row.role === 'super_admin' && user.role !== 'super_admin') fail(403, 'Ruxsat yo‘q');
      if (row.id === user.id && patch.status && patch.status !== 'active') fail(400, 'O‘zingizni bloklay olmaysiz');
      if (patch.username) next.username = String(patch.username).trim().toLowerCase();
      if (next.username !== row.username && this.data.users.some((u) => u.username === next.username)) fail(409, 'Bunday login mavjud');
      if (body.password) {
        if (String(body.password).length < 8) fail(400, 'Parol kamida 8 belgidan iborat bo‘lsin');
        Object.assign(next, await hashPassword(String(body.password)).then(({ salt, hash }) => ({ salt, passwordHash: hash })));
      }
      if (next.status !== 'active') for (const [t, s] of this.tokens) if (s.userId === row.id) this.tokens.delete(t);
    }
    Object.assign(row, next);
    row.updatedAt = new Date().toISOString();
    const what = entity === 'users' && patch.status ? `status=${patch.status}` : Object.keys(patch).join(', ');
    this.log(user, `${entity}.update`, entity, id, what);
    this.save();
    return this.clean(entity, row);
  }

  remove(user, entity, id) {
    if (!this.canWrite(user, entity)) fail(403, 'Ruxsat yo‘q');
    const row = this.getScoped(user, entity, id);
    if (entity === 'users' && row.id === user.id) fail(400, 'O‘zingizni o‘chira olmaysiz');
    if (entity === 'users' && row.role === 'super_admin' && user.role !== 'super_admin') fail(403, 'Ruxsat yo‘q');
    this.data[entity] = this.data[entity].filter((r) => r.id !== id);
    if (entity === 'institutions') {
      for (const k of Object.keys(ENTITIES)) if (ENTITIES[k].scoped && k !== 'audit') this.data[k] = this.data[k].filter((r) => r.institutionId !== id);
    }
    this.log(user, `${entity}.delete`, entity, id, row.name || row.title || row.fullName || row.username || '');
    this.save();
    return { ok: true };
  }

  // ───────────────────────── classroom ─────────────────────────
  classroomOptions(user) {
    if (!EDU_STAFF.includes(user.role)) fail(403, 'Ruxsat yo‘q');
    const pickV = (e) => this.visible(user, e, this.data[e]);
    return {
      institutions: pickV('institutions').map(({ id, name, type, languages, city }) => ({ id, name, type, languages, city })),
      groups: pickV('groups'),
      subjects: pickV('subjects'),
      lessons: pickV('lessons').filter((l) => l.status !== 'draft' || user.role !== 'director').map((l) => ({ id: l.id, title: l.title, institutionId: l.institutionId, subjectId: l.subjectId, groupIds: l.groupIds, language: l.language, durationMin: l.durationMin, sections: l.sections.length })),
      activeSessions: pickV('sessions').filter((s) => s.status === 'active').map((s) => ({ id: s.id, lessonId: s.lessonId, groupId: s.groupId, state: s.snapshot?.state })),
    };
  }

  avatar(user, method, query, body) {
    const instId = user.role === 'super_admin' ? (query.institutionId || body.institutionId) : user.institutionId;
    const inst = this.data.institutions.find((i) => i.id === instId);
    if (!inst) fail(404, 'Muassasa topilmadi');
    if (method === 'GET') return { body: { avatar: inst.avatar } };
    if (!ADMINS.includes(user.role)) fail(403, 'Ruxsat yo‘q');
    const a = body.avatar || {};
    if (a.image && typeof a.image === 'string' && a.image.length > 7_000_000) fail(413, 'Rasm juda katta (maks. ~5 MB)');
    inst.avatar = { ...inst.avatar, ...a, landmarks: { ...(inst.avatar?.landmarks || {}), ...(a.landmarks || {}) } };
    this.log(user, 'avatar.update', 'institutions', inst.id, a.image ? 'yangi rasm' : 'sozlamalar');
    this.save();
    return { body: { avatar: inst.avatar } };
  }

  async startSession(user, { lessonId, groupId }) {
    if (!['super_admin', 'inst_admin', 'teacher'].includes(user.role)) fail(403, 'Darsni faqat o‘qituvchi boshlaydi');
    const lesson = this.getScoped(user, 'lessons', lessonId);
    const group = this.getScoped(user, 'groups', groupId);
    if (group.institutionId !== lesson.institutionId) fail(400, 'Guruh va dars mos emas');
    // protection against accidental double start: reuse the group's active session
    const existing = this.data.sessions.find((s) => s.groupId === groupId && s.status === 'active');
    if (existing) return { body: { session: existing, lesson, resumed: true } };
    const s = {
      id: newId('ses'), institutionId: lesson.institutionId, lessonId, groupId, teacherId: user.id, teacherName: user.fullName,
      status: 'active', startedAt: new Date().toISOString(), endedAt: null, snapshot: null,
    };
    this.data.sessions.push(s);
    this.log(user, 'sessions.start', 'sessions', s.id, lesson.title);
    this.save();
    return { body: { session: s, lesson, resumed: false } };
  }

  async sessionAction(user, method, id, action, body) {
    const s = this.getScoped(user, 'sessions', id);
    const canTeach = ['super_admin', 'inst_admin', 'teacher'].includes(user.role);
    if (action === 'report' && method === 'GET') return { body: this.report(s) };
    if (!canTeach) fail(403, 'Ruxsat yo‘q');
    if (s.status !== 'active' && action !== 'report') fail(409, 'Dars yakunlangan');

    if (action === 'state') { s.snapshot = body.snapshot; s.updatedAt = new Date().toISOString(); this.save(); return { body: { ok: true } }; }
    if (action === 'attendance') {
      const students = this.data.students.filter((x) => x.groupId === s.groupId);
      for (const r of body.records || []) {
        if (!students.some((x) => x.id === r.studentId)) continue;
        if (!['present', 'absent', 'late', 'excused'].includes(r.status)) continue;
        const prev = this.data.attendance.find((x) => x.sessionId === s.id && x.studentId === r.studentId);
        const rec = { status: r.status, method: r.method || 'manual', changedBy: user.username, changedAt: new Date().toISOString() };
        if (prev) {
          if (prev.status !== rec.status) this.log(user, 'attendance.correct', 'attendance', prev.id, `${prev.status} → ${rec.status}`);
          Object.assign(prev, rec);
        } else this.data.attendance.push({ id: newId('att'), institutionId: s.institutionId, sessionId: s.id, studentId: r.studentId, date: s.startedAt.slice(0, 10), ...rec });
      }
      this.save();
      return { body: { items: this.data.attendance.filter((x) => x.sessionId === s.id) } };
    }
    if (action === 'questions') {
      const q = { id: newId('qst'), institutionId: s.institutionId, sessionId: s.id, at: new Date().toISOString(), text: String(body.text || '').slice(0, 1000), answer: String(body.answer || '').slice(0, 4000), confidence: body.confidence ?? null, source: body.source || 'offline', escalated: !!body.escalated, section: body.section ?? null };
      this.data.questions.push(q);
      this.save();
      return { body: { item: q } };
    }
    if (action === 'results') {
      const r = { id: newId('res'), institutionId: s.institutionId, sessionId: s.id, at: new Date().toISOString(), quizIndex: body.quizIndex, question: body.question, answer: body.answer, correct: !!body.correct, checkType: body.checkType || 'class_quiz' };
      this.data.results.push(r);
      this.save();
      return { body: { item: r } };
    }
    if (action === 'complete') {
      s.status = 'completed';
      s.endedAt = new Date().toISOString();
      if (body.snapshot) s.snapshot = body.snapshot;
      this.log(user, 'sessions.complete', 'sessions', s.id, '');
      this.save();
      return { body: this.report(s) };
    }
    fail(404, 'Not found');
  }

  report(s) {
    const lesson = this.data.lessons.find((l) => l.id === s.lessonId);
    const group = this.data.groups.find((g) => g.id === s.groupId);
    const students = this.data.students.filter((x) => x.groupId === s.groupId);
    const att = this.data.attendance.filter((x) => x.sessionId === s.id);
    const results = this.data.results.filter((x) => x.sessionId === s.id);
    const done = s.snapshot?.completedSections || [];
    return {
      session: s,
      lesson: lesson ? { id: lesson.id, title: lesson.title, sections: lesson.sections.map((x, i) => ({ title: x.title, done: done.includes(i) })) } : null,
      group: group ? { id: group.id, name: group.name } : null,
      attendance: students.map((st) => ({ studentId: st.id, fullName: st.fullName, ...(att.find((a) => a.studentId === st.id) || { status: 'unmarked' }) })),
      questions: this.data.questions.filter((x) => x.sessionId === s.id),
      results,
      score: results.length ? Math.round((100 * results.filter((r) => r.correct).length) / results.length) : null,
    };
  }

  async answer(user, { lessonId, sectionIndex = 0, question, history = [] }) {
    if (!EDU_STAFF.includes(user.role)) fail(403, 'Ruxsat yo‘q');
    const lesson = this.getScoped(user, 'lessons', lessonId);
    const inst = this.data.institutions.find((i) => i.id === lesson.institutionId);
    if (!question || !String(question).trim()) fail(400, 'Savol bo‘sh');
    if (this.ai) {
      try {
        const r = await this.ai({ lesson, institution: inst, question: String(question).slice(0, 1000), sectionIndex, history });
        if (r && r.answer) return { body: r };
      } catch (e) {
        console.warn('AI provider failed, using offline engine:', e.message);
      }
    }
    return { body: offlineAnswer(lesson, question, sectionIndex) };
  }

  dashboard(user) {
    const v = (e) => (this.canRead(user, e) ? this.visible(user, e, this.data[e]) : []);
    const sessions = v('sessions');
    const results = v('results');
    const att = v('attendance');
    return {
      counts: {
        institutions: v('institutions').length, groups: v('groups').length, students: v('students').length,
        users: v('users').length, lessons: v('lessons').length, materials: v('materials').length, devices: v('devices').length,
      },
      sessions: { total: sessions.length, active: sessions.filter((s) => s.status === 'active').length, completed: sessions.filter((s) => s.status === 'completed').length },
      quizAccuracy: results.length ? Math.round((100 * results.filter((r) => r.correct).length) / results.length) : null,
      attendanceRate: att.length ? Math.round((100 * att.filter((a) => a.status === 'present' || a.status === 'late').length) / att.length) : null,
      pendingMaterials: v('materials').filter((m) => m.status === 'pending').length,
      offlineDevices: v('devices').filter((d) => d.status !== 'online').length,
      escalatedQuestions: v('questions').filter((q) => q.escalated).length,
      recentSessions: sessions.slice(-8).reverse().map((s) => ({ id: s.id, status: s.status, startedAt: s.startedAt, lesson: this.data.lessons.find((l) => l.id === s.lessonId)?.title, group: this.data.groups.find((g) => g.id === s.groupId)?.name, teacher: s.teacherName })),
    };
  }
}
