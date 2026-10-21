// AI Teacher Admin: institutions, users, groups, students, lessons, materials, devices,
// reports, avatar studio and audit log. Every action is re-checked on the server.
import { get, post, put, del, apiMode, resetOfflineData } from './api.js';
import { Avatar } from './avatar.js';
import { VISUAL_IDS } from './visuals.js';
import { t, setUiLang, uiLang } from './i18n.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
let me = null;
const cache = {};

const ROLE = { super_admin: 'Super Admin', inst_admin: 'Muassasa admini', director: 'Direktor', teacher: 'O‘qituvchi / tarbiyachi', student: 'O‘quvchi', technician: 'Texnik xodim' };
const TYPE = { kindergarten: 'Bog‘cha', school: 'Maktab', university: 'Universitet / institut' };
const STATUS = { active: ['ok', 'faol'], blocked: ['bad', 'bloklangan'], inactive: ['warn', 'nofaol'], approved: ['ok', 'tasdiqlangan'], pending: ['warn', 'moderatsiyada'], rejected: ['bad', 'rad etilgan'], published: ['ok', 'nashr'], draft: ['warn', 'qoralama'], online: ['ok', 'onlayn'], offline: ['bad', 'oflayn'], completed: ['ok', 'yakunlangan'] };
const pill = (v) => { const [k, l] = STATUS[v] || ['', v]; return `<span class="pill ${k}">${esc(l)}</span>`; };
const isSuper = () => me.role === 'super_admin';
const isAdmin = () => ['super_admin', 'inst_admin'].includes(me.role);

function toast(msg, kind = '') {
  const el = document.createElement('div');
  el.className = `toast ${kind}`;
  el.textContent = msg;
  $('toasts').append(el);
  setTimeout(() => el.remove(), 4500);
}

async function ref(entity) {
  if (!cache[entity]) cache[entity] = (await get(`${entity}?pageSize=200`).catch(() => ({ items: [] }))).items;
  return cache[entity];
}
const nameOf = (list, id) => list?.find((x) => x.id === id)?.name || list?.find((x) => x.id === id)?.title || '—';

// ───────────────────────── entity schemas ─────────────────────────
const instCol = { k: 'institutionId', label: 'Muassasa', fmt: (v) => esc(nameOf(cache.institutions, v)), superOnly: true };
const SCHEMAS = {
  institutions: {
    title: 'Muassasalar', icon: '🏫',
    cols: [{ k: 'name', label: 'Nomi' }, { k: 'type', label: 'Turi', fmt: (v) => TYPE[v] }, { k: 'city', label: 'Shahar' }, { k: 'languages', label: 'Tillar', fmt: (v) => (v || []).join(', ') }, { k: 'status', label: 'Holat', fmt: pill }],
    fields: [{ k: 'name', label: 'Nomi', req: true, full: true }, { k: 'type', label: 'Turi', type: 'select', options: TYPE, req: true }, { k: 'city', label: 'Shahar' }, { k: 'languages', label: 'Tillar (vergul bilan: uz, ru, en)', type: 'tags' }, { k: 'status', label: 'Holat', type: 'select', options: { active: 'faol', inactive: 'nofaol' } }],
  },
  departments: {
    title: 'Fakultet / kafedralar', icon: '🏛', scoped: true,
    cols: [instCol, { k: 'name', label: 'Nomi' }],
    fields: [{ k: 'name', label: 'Nomi', req: true, full: true }],
  },
  groups: {
    title: 'Sinf / guruhlar', icon: '👥', scoped: true,
    cols: [instCol, { k: 'name', label: 'Nomi' }, { k: 'level', label: 'Daraja' }, { k: 'room', label: 'Xona' }],
    fields: [{ k: 'name', label: 'Nomi', req: true }, { k: 'level', label: 'Daraja / yosh' }, { k: 'room', label: 'Auditoriya' }, { k: 'departmentId', label: 'Bo‘lim', type: 'ref', ref: 'departments', optional: true }],
  },
  students: {
    title: 'O‘quvchilar', icon: '🎒', scoped: true, filters: [{ k: 'groupId', ref: 'groups', label: 'Guruh' }],
    cols: [instCol, { k: 'fullName', label: 'F.I.Sh.' }, { k: 'groupId', label: 'Guruh', fmt: (v) => esc(nameOf(cache.groups, v)) }, { k: 'status', label: 'Holat', fmt: pill }],
    fields: [{ k: 'fullName', label: 'F.I.Sh.', req: true, full: true }, { k: 'groupId', label: 'Guruh', type: 'ref', ref: 'groups', req: true }, { k: 'status', label: 'Holat', type: 'select', options: { active: 'faol', inactive: 'nofaol' } }],
    note: 'Faqat minimal zarur ma’lumot saqlanadi (ism va guruh). Biometrik ma’lumotlar saqlanmaydi.',
  },
  users: {
    title: 'Foydalanuvchilar', icon: '🔑', scoped: true, filters: [{ k: 'role', options: ROLE, label: 'Rol' }],
    cols: [instCol, { k: 'username', label: 'Login' }, { k: 'fullName', label: 'F.I.Sh.' }, { k: 'role', label: 'Rol', fmt: (v) => ROLE[v] }, { k: 'status', label: 'Holat', fmt: pill }],
    fields: [{ k: 'username', label: 'Login', req: true }, { k: 'fullName', label: 'F.I.Sh.', req: true }, { k: 'role', label: 'Rol', type: 'select', options: ROLE, req: true }, { k: 'status', label: 'Holat', type: 'select', options: { active: 'faol', blocked: 'bloklangan' } }, { k: 'password', label: 'Parol (kamida 8 belgi; tahrirlashda bo‘sh qoldiring)', type: 'password', full: true }],
    extraActions: (row) => row.id === me.id ? '' : `<button class="btn" data-x="toggleBlock">${row.status === 'active' ? 'Bloklash' : 'Tiklash'}</button>`,
  },
  subjects: {
    title: 'Fanlar / kurslar', icon: '📘', scoped: true,
    cols: [instCol, { k: 'name', label: 'Nomi' }, { k: 'code', label: 'Kod' }],
    fields: [{ k: 'name', label: 'Nomi', req: true }, { k: 'code', label: 'Kod' }],
  },
  lessons: {
    title: 'Darslar', icon: '📝', scoped: true, custom: 'lesson',
    cols: [instCol, { k: 'title', label: 'Mavzu' }, { k: 'subjectId', label: 'Fan', fmt: (v) => esc(nameOf(cache.subjects, v)) }, { k: 'groupIds', label: 'Guruhlar', fmt: (v) => esc((v || []).map((g) => nameOf(cache.groups, g)).join(', ')) }, { k: 'language', label: 'Til', fmt: (v) => (v || '').toUpperCase() }, { k: 'sections', label: 'Bo‘limlar', fmt: (v) => (v || []).length }, { k: 'status', label: 'Holat', fmt: pill }],
  },
  materials: {
    title: 'Materiallar', icon: '📚', scoped: true, filters: [{ k: 'status', options: { approved: 'tasdiqlangan', pending: 'moderatsiyada', rejected: 'rad etilgan' }, label: 'Holat' }],
    cols: [instCol, { k: 'title', label: 'Nomi' }, { k: 'subject', label: 'Fan' }, { k: 'topic', label: 'Mavzu' }, { k: 'level', label: 'Daraja' }, { k: 'language', label: 'Til' }, { k: 'type', label: 'Turi' }, { k: 'rights', label: 'Huquqlar' }, { k: 'status', label: 'Holat', fmt: pill }],
    fields: [{ k: 'title', label: 'Nomi', req: true, full: true }, { k: 'subject', label: 'Fan' }, { k: 'topic', label: 'Mavzu' }, { k: 'level', label: 'Yosh / daraja' }, { k: 'language', label: 'Til', type: 'select', options: { uz: 'uz', ru: 'ru', en: 'en' } }, { k: 'type', label: 'Turi', type: 'select', options: { animation: 'animatsiya', image: 'rasm', pdf: 'PDF', presentation: 'taqdimot', scheme: 'sxema' } }, { k: 'visual', label: 'Kutubxona animatsiyasi', type: 'select', options: Object.fromEntries([['', '—'], ...VISUAL_IDS.map((v) => [v, v])]) }, { k: 'source', label: 'Manba' }, { k: 'rights', label: 'Foydalanish huquqi' }, { k: 'status', label: 'Moderatsiya', type: 'select', options: { pending: 'moderatsiyada', approved: 'tasdiqlangan', rejected: 'rad etilgan' }, adminOnly: true }, { k: 'fileData', label: 'Fayl (rasm/PDF, maks. 3 MB)', type: 'file', full: true }],
    note: 'O‘qituvchi yuklagan material moderatsiyadan o‘tgach darsda ishlatiladi.',
  },
  schedule: {
    title: 'Dars jadvali', icon: '🗓', scoped: true,
    cols: [instCol, { k: 'day', label: 'Kun' }, { k: 'time', label: 'Vaqt' }, { k: 'groupId', label: 'Guruh', fmt: (v) => esc(nameOf(cache.groups, v)) }, { k: 'lessonId', label: 'Dars', fmt: (v) => esc(nameOf(cache.lessons, v)) }, { k: 'room', label: 'Xona' }],
    fields: [{ k: 'day', label: 'Kun' }, { k: 'time', label: 'Vaqt', type: 'time' }, { k: 'groupId', label: 'Guruh', type: 'ref', ref: 'groups', req: true }, { k: 'lessonId', label: 'Dars', type: 'ref', ref: 'lessons', req: true }, { k: 'room', label: 'Xona' }],
  },
  devices: {
    title: 'Qurilmalar', icon: '🖥', scoped: true,
    cols: [instCol, { k: 'room', label: 'Auditoriya' }, { k: 'kind', label: 'Turi', fmt: (v) => ({ camera: '📷 kamera', microphone: '🎙 mikrofon', speaker: '🔊 karnay', panel: '🖥 panel', agent: '🧩 lokal agent' })[v] || v }, { k: 'model', label: 'Model' }, { k: 'status', label: 'Holat', fmt: pill }],
    fields: [{ k: 'room', label: 'Auditoriya', req: true }, { k: 'kind', label: 'Turi', type: 'select', options: { camera: 'kamera', microphone: 'mikrofon', speaker: 'karnay', panel: 'interaktiv panel', agent: 'lokal agent' }, req: true }, { k: 'model', label: 'Model' }, { k: 'status', label: 'Holat', type: 'select', options: { online: 'onlayn', offline: 'oflayn' } }],
  },
};

const NAV = [
  { id: 'dashboard', title: 'Boshqaruv paneli', icon: '📊', roles: ['super_admin', 'inst_admin', 'director', 'teacher', 'technician'] },
  { sep: 'Tuzilma' },
  { id: 'institutions', roles: ['super_admin', 'inst_admin'] },
  { id: 'departments', roles: ['super_admin', 'inst_admin'] },
  { id: 'groups', roles: ['super_admin', 'inst_admin', 'director', 'teacher'] },
  { id: 'students', roles: ['super_admin', 'inst_admin', 'director', 'teacher'] },
  { id: 'users', roles: ['super_admin', 'inst_admin'] },
  { sep: 'O‘quv jarayoni' },
  { id: 'subjects', roles: ['super_admin', 'inst_admin', 'director', 'teacher'] },
  { id: 'lessons', roles: ['super_admin', 'inst_admin', 'director', 'teacher'] },
  { id: 'materials', roles: ['super_admin', 'inst_admin', 'director', 'teacher'] },
  { id: 'schedule', roles: ['super_admin', 'inst_admin', 'director', 'teacher'] },
  { id: 'reports', title: 'Hisobotlar', icon: '📈', roles: ['super_admin', 'inst_admin', 'director', 'teacher'] },
  { sep: 'Tizim' },
  { id: 'devices', roles: ['super_admin', 'inst_admin', 'teacher', 'technician'] },
  { id: 'avatar', title: 'Avatar studiyasi', icon: '🧑‍🏫', roles: ['super_admin', 'inst_admin'] },
  { id: 'audit', title: 'Audit jurnali', icon: '🧾', roles: ['super_admin', 'inst_admin'] },
];
const WRITE = { institutions: ['super_admin'], departments: ['super_admin', 'inst_admin'], groups: ['super_admin', 'inst_admin'], students: ['super_admin', 'inst_admin'], users: ['super_admin', 'inst_admin'], subjects: ['super_admin', 'inst_admin'], lessons: ['super_admin', 'inst_admin', 'teacher'], materials: ['super_admin', 'inst_admin', 'teacher'], schedule: ['super_admin', 'inst_admin'], devices: ['super_admin', 'inst_admin', 'technician'] };
const canWrite = (e) => WRITE[e]?.includes(me.role);

// ───────────────────────── boot ─────────────────────────
async function boot() {
  setUiLang(uiLang());
  document.querySelectorAll('[data-t]').forEach((el) => { el.textContent = t(el.dataset.t); });
  if ((await apiMode()) === 'local') {
    $('modeBanner').hidden = false;
    $('modeBanner').innerHTML = 'Oflayn demo rejimi (server ishlamayapti) · <a href="#" id="resetDemo">demo ma’lumotlarini tiklash</a>';
    $('resetDemo').onclick = (e) => { e.preventDefault(); if (confirm('Barcha oflayn ma’lumotlar o‘chiriladi. Davom etasizmi?')) { resetOfflineData(); location.reload(); } };
  }
  try {
    ({ user: me } = await get('me'));
    start();
  } catch {
    $('login').hidden = false;
  }
}

$('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = new FormData(e.target);
  try {
    ({ user: me } = await post('auth/login', { username: f.get('username'), password: f.get('password'), portal: 'admin' }));
    $('login').hidden = true;
    start();
  } catch (err) { $('loginError').textContent = err.message; }
});

function start() {
  $('app').hidden = false;
  $('me').innerHTML = `<div><b>${esc(me.fullName)}</b><br>${esc(ROLE[me.role])}${me.institutionName ? '<br>' + esc(me.institutionName) : ''}</div><a class="btn ghost" href="classroom.html">▶ Classroom</a><button class="btn ghost" id="logout">${t('logout')}</button>`;
  $('logout').onclick = async () => { await post('auth/logout').catch(() => {}); location.reload(); };
  $('nav').innerHTML = NAV.filter((n) => n.sep || n.roles.includes(me.role)).map((n) => n.sep ? `<div class="sep">${n.sep}</div>` : `<a href="#${n.id}" data-id="${n.id}"><span>${n.icon || SCHEMAS[n.id].icon}</span>${esc(n.title || SCHEMAS[n.id].title)}</a>`).join('');
  $('menuBtn').onclick = () => document.querySelector('.sidebar').classList.toggle('open');
  window.addEventListener('hashchange', route);
  route();
}

async function route() {
  document.querySelector('.sidebar').classList.remove('open');
  const allowed = NAV.filter((n) => !n.sep && n.roles.includes(me.role)).map((n) => n.id);
  let id = location.hash.slice(1) || 'dashboard';
  if (!allowed.includes(id)) id = allowed[0];
  document.querySelectorAll('#nav a').forEach((a) => a.classList.toggle('on', a.dataset.id === id));
  const n = NAV.find((x) => x.id === id);
  $('pageTitle').textContent = n.title || SCHEMAS[id].title;
  $('pageActions').innerHTML = '';
  $('page').innerHTML = '<div class="empty">Yuklanmoqda…</div>';
  for (const k of Object.keys(cache)) delete cache[k];
  if (isSuper()) await ref('institutions');
  try {
    if (id === 'dashboard') await dashboard();
    else if (id === 'reports') await reports();
    else if (id === 'avatar') await avatarStudio();
    else if (id === 'audit') await audit();
    else await table(id);
  } catch (e) {
    $('page').innerHTML = `<div class="empty">Xatolik: ${esc(e.message)}</div>`;
  }
}

// ───────────────────────── dashboard ─────────────────────────
async function dashboard() {
  const d = await get('dashboard');
  const c = d.counts;
  const kpi = (v, l) => `<div class="kpi"><b>${v ?? '—'}</b><span>${l}</span></div>`;
  const alerts = [];
  if (d.pendingMaterials) alerts.push(`<div class="alert">📚 ${d.pendingMaterials} ta material moderatsiyani kutmoqda — <a href="#materials">ko‘rish</a></div>`);
  if (d.offlineDevices) alerts.push(`<div class="alert bad">🖥 ${d.offlineDevices} ta qurilma oflayn — <a href="#devices">ko‘rish</a></div>`);
  if (d.escalatedQuestions) alerts.push(`<div class="alert">❓ AI ${d.escalatedQuestions} ta savolni o‘qituvchiga yo‘naltirdi — <a href="#reports">hisobotlar</a></div>`);
  $('page').innerHTML = `
    <div class="cards">
      ${isSuper() ? kpi(c.institutions, 'Muassasalar') : ''}${kpi(c.groups, 'Guruhlar')}${kpi(c.students, 'O‘quvchilar')}${kpi(c.lessons, 'Darslar')}
      ${kpi(d.sessions.total, 'O‘tkazilgan darslar')}${kpi(d.attendanceRate != null ? d.attendanceRate + '%' : null, 'Davomat')}${kpi(d.quizAccuracy != null ? d.quizAccuracy + '%' : null, 'Test aniqligi')}${kpi(c.devices, 'Qurilmalar')}
    </div>
    <div class="alerts">${alerts.join('')}</div>
    <div class="two">
      <div class="box"><h3>So‘nggi darslar</h3>${d.recentSessions.length ? `<table class="data"><tr><th>Dars</th><th>Guruh</th><th>O‘qituvchi</th><th>Holat</th></tr>${d.recentSessions.map((s) => `<tr><td>${esc(s.lesson)}</td><td>${esc(s.group)}</td><td>${esc(s.teacher)}</td><td>${pill(s.status)}</td></tr>`).join('')}</table>` : '<p class="muted">Hali dars o‘tkazilmagan. <a href="classroom.html">Classroom</a> orqali birinchi darsni boshlang.</p>'}</div>
      <div class="box"><h3>Tezkor harakatlar</h3><div class="row">
        <a class="btn primary" href="classroom.html">▶ Darsni boshlash</a>
        ${canWrite('lessons') ? '<a class="btn" href="#lessons">📝 Darslar</a>' : ''}
        ${isAdmin() ? '<a class="btn" href="#avatar">🧑‍🏫 Avatarni sozlash</a><a class="btn" href="#users">🔑 Foydalanuvchilar</a>' : ''}
      </div><p class="hint">Huquqlar serverda har bir so‘rovda tekshiriladi; boshqa muassasa ma’lumotlari ko‘rinmaydi.</p></div>
    </div>`;
}

// ───────────────────────── generic tables ─────────────────────────
const tableState = {};
async function table(entity) {
  const sc = SCHEMAS[entity];
  const st = (tableState[entity] ||= { q: '', page: 1, filters: {} });
  for (const r of ['groups', 'subjects', 'lessons', 'departments']) if (JSON.stringify(sc).includes(r) || entity === 'lessons') await ref(r);
  if (canWrite(entity)) {
    $('pageActions').innerHTML = `<button class="btn primary" id="addBtn">＋ Qo‘shish</button>`;
    $('addBtn').onclick = () => (sc.custom === 'lesson' ? lessonEditor() : editForm(entity));
  }
  const filters = [...(sc.filters || [])];
  if (isSuper() && sc.scoped) filters.unshift({ k: 'institutionId', ref: 'institutions', label: 'Muassasa' });
  const filterHtml = await Promise.all(filters.map(async (f) => {
    const opts = f.ref ? (await ref(f.ref)).map((r) => [r.id, r.name || r.title]) : Object.entries(f.options);
    return `<select data-f="${f.k}"><option value="">${esc(f.label)}: barchasi</option>${opts.map(([v, l]) => `<option value="${esc(v)}" ${st.filters[f.k] === v ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
  }));
  const qs = new URLSearchParams({ q: st.q, page: st.page, pageSize: 20, ...st.filters });
  const { items, total, page, pageSize } = await get(`${entity}?${qs}`);
  const cols = sc.cols.filter((c) => !c.superOnly || isSuper());
  $('page').innerHTML = `
    ${sc.note ? `<p class="hint">${esc(sc.note)}</p>` : ''}
    <div class="toolbar"><input type="search" id="q" placeholder="Qidirish…" value="${esc(st.q)}">${filterHtml.join('')}</div>
    <div class="table-wrap"><table class="data"><thead><tr>${cols.map((c) => `<th>${esc(c.label)}</th>`).join('')}<th></th></tr></thead>
    <tbody>${items.map((r) => `<tr data-id="${r.id}">${cols.map((c) => `<td>${c.fmt ? c.fmt(r[c.k], r) ?? '' : esc(r[c.k])}</td>`).join('')}
      <td class="actions">${sc.extraActions?.(r) || ''}${canWrite(entity) || (entity === 'institutions' && me.role === 'inst_admin') ? `<button class="btn" data-x="edit">✎</button>` : ''}${canWrite(entity) ? `<button class="btn danger" data-x="delete">🗑</button>` : ''}</td></tr>`).join('') || `<tr><td colspan="${cols.length + 1}" class="empty">Ma’lumot topilmadi</td></tr>`}</tbody></table></div>
    <div class="pager"><span>${total} ta yozuv</span><button class="btn" id="prev" ${page <= 1 ? 'disabled' : ''}>‹</button><span>${page} / ${Math.max(1, Math.ceil(total / pageSize))}</span><button class="btn" id="next" ${page * pageSize >= total ? 'disabled' : ''}>›</button></div>`;
  let deb;
  $('q').oninput = () => { clearTimeout(deb); deb = setTimeout(() => { st.q = $('q').value; st.page = 1; table(entity).then(() => { $('q').focus(); $('q').setSelectionRange(st.q.length, st.q.length); }); }, 300); };
  document.querySelectorAll('[data-f]').forEach((s) => s.onchange = () => { st.filters[s.dataset.f] = s.value; if (!s.value) delete st.filters[s.dataset.f]; st.page = 1; table(entity); });
  $('prev').onclick = () => { st.page--; table(entity); };
  $('next').onclick = () => { st.page++; table(entity); };
  document.querySelectorAll('tbody tr[data-id]').forEach((tr) => tr.querySelectorAll('[data-x]').forEach((b) => b.onclick = async () => {
    const row = items.find((x) => x.id === tr.dataset.id);
    if (b.dataset.x === 'edit') {
      if (sc.custom === 'lesson') { const { item } = await get(`lessons/${row.id}`); lessonEditor(item); } else editForm(entity, row);
    }
    if (b.dataset.x === 'delete') {
      const label = row.name || row.title || row.fullName || row.username;
      const extra = entity === 'institutions' ? '\n\nDIQQAT: muassasaning barcha guruhlari, foydalanuvchilari va darslari ham o‘chiriladi!' : '';
      if (!confirm(`«${label}» o‘chirilsinmi? Bu amalni qaytarib bo‘lmaydi.${extra}`)) return;
      if (entity === 'institutions' && prompt('Tasdiqlash uchun muassasa nomini kiriting:') !== row.name) return toast('Nom mos kelmadi — bekor qilindi', 'warn');
      try { await del(`${entity}/${row.id}`); toast('O‘chirildi', 'ok'); table(entity); } catch (e) { toast(e.message, 'bad'); }
    }
    if (b.dataset.x === 'toggleBlock') {
      const next = row.status === 'active' ? 'blocked' : 'active';
      if (next === 'blocked' && !confirm(`${row.username} bloklansinmi? Uning barcha seanslari tugatiladi.`)) return;
      try { await put(`users/${row.id}`, { status: next }); toast(next === 'blocked' ? 'Bloklandi' : 'Kirish tiklandi', 'ok'); table(entity); } catch (e) { toast(e.message, 'bad'); }
    }
  }));
}

async function fieldHtml(f, val) {
  const id = `f_${f.k}`;
  const req = f.req ? 'required' : '';
  let input;
  if (f.type === 'select') input = `<select id="${id}" ${req}>${Object.entries(f.options).map(([v, l]) => `<option value="${esc(v)}" ${String(val ?? '') === v ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
  else if (f.type === 'ref') {
    const list = await ref(f.ref);
    input = `<select id="${id}" ${req}>${f.optional ? '<option value="">—</option>' : ''}${list.map((r) => `<option value="${r.id}" ${val === r.id ? 'selected' : ''}>${esc(r.name || r.title)}${isSuper() ? ' · ' + esc(nameOf(cache.institutions, r.institutionId)) : ''}</option>`).join('')}</select>`;
  } else if (f.type === 'password') input = `<input id="${id}" type="password" autocomplete="new-password" minlength="8">`;
  else if (f.type === 'tags') input = `<input id="${id}" value="${esc((val || []).join(', '))}">`;
  else if (f.type === 'file') input = `<input id="${id}" type="file" accept="image/*,application/pdf">${val ? '<span class="hint">Fayl mavjud</span>' : ''}`;
  else input = `<input id="${id}" type="${f.type || 'text'}" value="${esc(val ?? '')}" ${req}>`;
  return `<label class="${f.full ? 'full' : ''}"><span>${esc(f.label)}${f.req ? ' *' : ''}</span>${input}</label>`;
}

function openModal(html) {
  $('modalBody').innerHTML = `<div class="modal-inner">${html}</div>`;
  $('modal').showModal();
}
const closeModal = () => $('modal').close();

async function editForm(entity, row) {
  const sc = SCHEMAS[entity];
  let fields = sc.fields.filter((f) => !f.adminOnly || isAdmin());
  if (entity === 'institutions' && me.role === 'inst_admin') fields = fields.filter((f) => ['name', 'city', 'languages'].includes(f.k));
  const instField = isSuper() && sc.scoped && !row ? [{ k: 'institutionId', label: 'Muassasa', type: 'ref', ref: 'institutions', req: true }] : [];
  const html = (await Promise.all([...instField, ...fields].map((f) => fieldHtml(f, row?.[f.k])))).join('');
  openModal(`<h2>${row ? 'Tahrirlash' : 'Yangi yozuv'} · ${esc(sc.title)}</h2><form id="ef" class="form-grid">${html}<p class="form-error full" id="efErr"></p><div class="row end full"><button type="button" class="btn ghost" id="efCancel">Bekor qilish</button><button class="btn primary">Saqlash</button></div></form>`);
  $('efCancel').onclick = closeModal;
  $('ef').onsubmit = async (e) => {
    e.preventDefault();
    const body = {};
    for (const f of [...instField, ...fields]) {
      const el = $(`f_${f.k}`);
      if (f.type === 'tags') body[f.k] = el.value.split(',').map((s) => s.trim()).filter(Boolean);
      else if (f.type === 'password') { if (el.value) body.password = el.value; }
      else if (f.type === 'file') {
        const file = el.files[0];
        if (file) {
          if (file.size > 3 * 1024 * 1024) { $('efErr').textContent = 'Fayl 3 MB dan katta'; return; }
          body.fileData = await new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(file); });
          body.fileName = file.name;
        }
      } else body[f.k] = el.value;
    }
    try {
      if (row) await put(`${entity}/${row.id}`, body); else await post(entity, body);
      closeModal();
      toast('Saqlandi', 'ok');
      route();
    } catch (err) { $('efErr').textContent = err.message; }
  };
}

// ───────────────────────── lesson editor ─────────────────────────
async function lessonEditor(lesson) {
  const [subjects, groups, materials] = await Promise.all([ref('subjects'), ref('groups'), ref('materials')]);
  const L = structuredClone(lesson || { title: '', language: 'uz', durationMin: 30, status: 'draft', greeting: '', groupIds: [], sections: [{ title: '', sentences: [], materialId: '' }], quiz: [], faq: [], sampleQuestions: [] });
  const instId = lesson?.institutionId;
  const own = (list) => (instId ? list.filter((x) => x.institutionId === instId) : list);
  const draw = () => {
    openModal(`<h2>${lesson ? 'Darsni tahrirlash' : 'Yangi dars'}</h2>
    <form id="lf" class="form-grid">
      ${isSuper() && !lesson ? `<label class="full"><span>Muassasa *</span><select id="l_inst">${cache.institutions.map((i) => `<option value="${i.id}">${esc(i.name)}</option>`).join('')}</select></label>` : ''}
      <label class="full"><span>Mavzu *</span><input id="l_title" value="${esc(L.title)}" required></label>
      <label><span>Fan</span><select id="l_subject"><option value="">—</option>${own(subjects).map((s) => `<option value="${s.id}" ${L.subjectId === s.id ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select></label>
      <label><span>Til</span><select id="l_lang">${['uz', 'ru', 'en'].map((l) => `<option ${L.language === l ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
      <label><span>Davomiyligi (daq.)</span><input id="l_dur" type="number" min="5" max="180" value="${L.durationMin}"></label>
      <label><span>Holat</span><select id="l_status"><option value="draft" ${L.status === 'draft' ? 'selected' : ''}>qoralama</option><option value="published" ${L.status === 'published' ? 'selected' : ''}>nashr</option></select></label>
      <div class="full"><span class="muted">Guruhlar</span><div class="checks-list">${own(groups).map((g) => `<label><input type="checkbox" class="l_grp" value="${g.id}" ${L.groupIds.includes(g.id) ? 'checked' : ''}>${esc(g.name)}</label>`).join('')}</div></div>
      <label class="full"><span>Salomlashish (AI dars boshida aytadi)</span><textarea id="l_greet">${esc(L.greeting)}</textarea></label>
      <div class="full"><h3>Bo‘limlar</h3><div id="secs" style="display:grid;gap:10px">${L.sections.map((s, i) => `
        <div class="sec-edit" data-i="${i}"><div class="row"><input class="s_title" placeholder="${i + 1}-bo‘lim sarlavhasi" value="${esc(s.title)}">
        <select class="s_mat"><option value="">— material —</option>${own(materials).filter((m) => m.status === 'approved').map((m) => `<option value="${m.id}" ${s.materialId === m.id ? 'selected' : ''}>${esc(m.title)}</option>`).join('')}</select>
        <button type="button" class="btn danger s_del" style="flex:0">🗑</button></div>
        <textarea class="s_text" placeholder="Har bir gap alohida qatorda — AI ularni ketma-ket aytadi">${esc(s.sentences.join('\n'))}</textarea></div>`).join('')}</div>
        <button type="button" class="btn" id="addSec" style="margin-top:8px">＋ Bo‘lim</button></div>
      <div class="full"><h3>Nazorat savollari</h3><div id="quiz" style="display:grid;gap:10px">${L.quiz.map((q, i) => `
        <div class="sec-edit" data-i="${i}"><div class="row"><input class="q_q" placeholder="Savol" value="${esc(q.q)}"><button type="button" class="btn danger q_del" style="flex:0">🗑</button></div>
        <textarea class="q_opts" placeholder="Variantlar — har biri alohida qatorda. To‘g‘ri javob oldiga * qo‘ying">${esc(q.options.map((o, k) => (k === q.answer ? '*' : '') + o).join('\n'))}</textarea>
        <input class="q_exp" placeholder="Izoh (javobdan keyin aytiladi)" value="${esc(q.explain || '')}"></div>`).join('')}</div>
        <button type="button" class="btn" id="addQ" style="margin-top:8px">＋ Savol</button></div>
      <label class="full"><span>Tasdiqlangan qo‘shimcha javoblar (oflayn AI uchun): har qatorda «kalit so‘zlar | javob»</span><textarea id="l_faq">${esc(L.faq.map((f) => `${f.keys.join(', ')} | ${f.a}`).join('\n'))}</textarea></label>
      <label class="full"><span>Namuna savollar (har qatorda bittadan)</span><textarea id="l_samples">${esc((L.sampleQuestions || []).join('\n'))}</textarea></label>
      <p class="form-error full" id="lfErr"></p>
      <div class="row end full"><button type="button" class="btn ghost" id="lfCancel">Bekor qilish</button><button class="btn primary">Saqlash</button></div>
    </form>`);
    $('lfCancel').onclick = closeModal;
    $('addSec').onclick = () => { collect(); L.sections.push({ title: '', sentences: [], materialId: '' }); draw(); };
    $('addQ').onclick = () => { collect(); L.quiz.push({ q: '', options: ['', ''], answer: 0, explain: '' }); draw(); };
    document.querySelectorAll('.s_del').forEach((b) => b.onclick = () => { collect(); L.sections.splice(Number(b.closest('.sec-edit').dataset.i), 1); draw(); });
    document.querySelectorAll('.q_del').forEach((b) => b.onclick = () => { collect(); L.quiz.splice(Number(b.closest('.sec-edit').dataset.i), 1); draw(); });
    $('lf').onsubmit = async (e) => {
      e.preventDefault();
      collect();
      const body = { ...L };
      if ($('l_inst')) body.institutionId = $('l_inst').value;
      try {
        if (lesson) await put(`lessons/${lesson.id}`, body); else await post('lessons', body);
        closeModal(); toast('Dars saqlandi', 'ok'); route();
      } catch (err) { $('lfErr').textContent = err.message; }
    };
  };
  const collect = () => {
    if (!$('lf')) return;
    L.title = $('l_title').value.trim();
    L.subjectId = $('l_subject').value || undefined;
    L.language = $('l_lang').value;
    L.durationMin = Number($('l_dur').value);
    L.status = $('l_status').value;
    L.greeting = $('l_greet').value.trim();
    L.groupIds = [...document.querySelectorAll('.l_grp:checked')].map((c) => c.value);
    L.sections = [...document.querySelectorAll('#secs .sec-edit')].map((d) => ({
      title: d.querySelector('.s_title').value.trim(), materialId: d.querySelector('.s_mat').value || undefined,
      sentences: d.querySelector('.s_text').value.split('\n').map((s) => s.trim()).filter(Boolean),
    }));
    L.quiz = [...document.querySelectorAll('#quiz .sec-edit')].map((d) => {
      const lines = d.querySelector('.q_opts').value.split('\n').map((s) => s.trim()).filter(Boolean);
      return { q: d.querySelector('.q_q').value.trim(), options: lines.map((l) => l.replace(/^\*/, '')), answer: Math.max(0, lines.findIndex((l) => l.startsWith('*'))), explain: d.querySelector('.q_exp').value.trim() };
    }).filter((q) => q.q && q.options.length >= 2);
    L.faq = $('l_faq').value.split('\n').map((l) => l.split('|')).filter((p) => p.length >= 2).map(([k, ...a]) => ({ keys: k.split(',').map((s) => s.trim()).filter(Boolean), a: a.join('|').trim() }));
    L.sampleQuestions = $('l_samples').value.split('\n').map((s) => s.trim()).filter(Boolean);
  };
  draw();
}

// ───────────────────────── reports ─────────────────────────
async function reports() {
  await Promise.all([ref('lessons'), ref('groups')]);
  const { items } = await get('sessions?pageSize=200');
  items.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  $('page').innerHTML = `<div class="table-wrap"><table class="data"><thead><tr><th>Sana</th><th>Dars</th><th>Guruh</th><th>O‘qituvchi</th><th>Holat</th><th></th></tr></thead><tbody>
    ${items.map((s) => `<tr><td>${new Date(s.startedAt).toLocaleString()}</td><td>${esc(nameOf(cache.lessons, s.lessonId))}</td><td>${esc(nameOf(cache.groups, s.groupId))}</td><td>${esc(s.teacherName)}</td><td>${pill(s.status)} ${s.snapshot?.state && s.status === 'active' ? `<span class="pill">${esc(s.snapshot.state)}</span>` : ''}</td><td class="actions"><button class="btn" data-id="${s.id}">Hisobot</button></td></tr>`).join('') || '<tr><td colspan="6" class="empty">Hali darslar yo‘q</td></tr>'}
  </tbody></table></div>`;
  document.querySelectorAll('[data-id]').forEach((b) => b.onclick = () => showReport(b.dataset.id));
}

async function showReport(id) {
  const r = await get(`sessions/${id}/report`);
  const present = r.attendance.filter((a) => ['present', 'late'].includes(a.status)).length;
  const lbl = { present: '✅ bor', late: '⏰ kechikdi', absent: '❌ yo‘q', excused: '📄 sababli', unmarked: '—' };
  openModal(`<h2>${esc(r.lesson?.title)} · ${esc(r.group?.name)}</h2>
    <p class="muted">${new Date(r.session.startedAt).toLocaleString()} · ${esc(r.session.teacherName)} · ${pill(r.session.status)}</p>
    <div class="cards"><div class="kpi"><b>${present}/${r.attendance.length}</b><span>Davomat</span></div><div class="kpi"><b>${r.lesson.sections.filter((s) => s.done).length}/${r.lesson.sections.length}</b><span>Bo‘limlar</span></div><div class="kpi"><b>${r.score ?? '—'}${r.score != null ? '%' : ''}</b><span>Test</span></div><div class="kpi"><b>${r.questions.length}</b><span>Savollar</span></div></div>
    <div class="two"><div><h3>Davomat</h3><table class="data">${r.attendance.map((a) => `<tr><td>${esc(a.fullName)}</td><td>${lbl[a.status] || a.status}</td><td class="muted">${esc(a.method || '')} ${esc(a.changedBy || '')}</td></tr>`).join('')}</table></div>
    <div><h3>Bo‘limlar</h3><ul>${r.lesson.sections.map((s) => `<li>${s.done ? '✅' : '⬜'} ${esc(s.title)}</li>`).join('')}</ul>
    <h3>Test natijalari</h3><ul>${r.results.map((x) => `<li>${x.correct ? '✅' : '❌'} ${esc(x.question)} — <i>${esc(x.answer)}</i></li>`).join('') || '<li class="muted">—</li>'}</ul>
    <h3>Savol-javoblar</h3><ul>${r.questions.map((q) => `<li><b>${esc(q.text)}</b><br><span class="muted">${esc(q.answer)}</span> ${q.escalated ? '<span class="pill warn">o‘qituvchiga</span>' : ''} <span class="pill">${esc(q.source)}</span></li>`).join('') || '<li class="muted">—</li>'}</ul></div></div>
    <div class="row end"><button class="btn" id="csv">⬇ CSV eksport</button><button class="btn primary" id="closeR">Yopish</button></div>`);
  $('closeR').onclick = closeModal;
  $('csv').onclick = () => {
    const rows = [['student', 'status', 'method', 'changedBy'], ...r.attendance.map((a) => [a.fullName, a.status, a.method || '', a.changedBy || '']), [], ['question', 'answer', 'correct'], ...r.results.map((x) => [x.question, x.answer, x.correct])];
    const csv = rows.map((row) => row.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv' }));
    a.download = `report-${r.session.id}.csv`;
    a.click();
  };
}

// ───────────────────────── audit ─────────────────────────
async function audit() {
  const { items } = await get('audit?pageSize=200');
  $('page').innerHTML = `<p class="hint">Kirishlar va muhim administrativ amallar. Parollar va shaxsiy ma’lumotlar jurnalga yozilmaydi.</p>
    <div class="table-wrap"><table class="data"><thead><tr><th>Vaqt</th><th>Foydalanuvchi</th><th>Amal</th><th>Obyekt</th><th>Tafsilot</th></tr></thead><tbody>
    ${items.map((a) => `<tr><td>${new Date(a.at).toLocaleString()}</td><td>${esc(a.username)}</td><td><span class="pill ${a.action.includes('fail') || a.action.includes('delete') ? 'bad' : ''}">${esc(a.action)}</span></td><td class="muted">${esc(a.entity || '')}</td><td>${esc(a.details)}</td></tr>`).join('')}
    </tbody></table></div>`;
}

// ───────────────────────── avatar studio ─────────────────────────
const POINTS = [
  ['eyeL', 'Ko‘z 1', 'Chap ko‘z markazi'], ['eyeR', 'Ko‘z 2', 'O‘ng ko‘z markazi'], ['mouthL', 'Og‘iz 1', 'Og‘iz chap burchagi'], ['mouthC', 'Lab', 'Lablar orasi (o‘rta)'],
  ['mouthR', 'Og‘iz 2', 'Og‘iz o‘ng burchagi'], ['chin', 'Iyak', 'Iyak pasti'], ['neck', 'Bo‘yin', 'Bo‘yin (aylanish nuqtasi)'],
];
async function avatarStudio() {
  let instId = me.institutionId;
  if (isSuper()) instId = cache.institutions[0]?.id;
  const load = async () => (await get('avatar?institutionId=' + instId)).avatar;
  let cfg = structuredClone(await load());
  let preview = null;
  const render = () => {
    $('page').innerHTML = `
    ${isSuper() ? `<div class="toolbar"><select id="avInst">${cache.institutions.map((i) => `<option value="${i.id}" ${i.id === instId ? 'selected' : ''}>${esc(i.name)}</option>`).join('')}</select></div>` : ''}
    <div class="studio">
      <div class="box"><h3>1. Rasm va yuz nuqtalari</h3>
        <p class="hint">Nuqtalarni sichqoncha bilan surib, rasmdagi joyiga qo‘ying. Eng yaxshi natija: yuz to‘g‘riga qaragan, og‘iz yopiq, fon shaffof (PNG/WebP) yoki bir xil rangli, yuqori sifatli portret.</p>
        <div class="studio-zoom"><div class="studio-canvas" id="sc"><img id="scImg" src="${esc(cfg.image)}" alt="Avatar rasmi"></div></div>
        <div class="row" style="margin-top:10px">
          <label class="btn">📷 Yangi rasm yuklash<input type="file" id="upload" accept="image/*" hidden></label>
          <label><span>Ko‘z kengligi</span><input type="range" id="eyeW" min="10" max="120" value="${cfg.landmarks.eyeW}"></label>
          <label><span>Ko‘z balandligi</span><input type="range" id="eyeH" min="6" max="60" value="${cfg.landmarks.eyeH}"></label>
        </div>
      </div>
      <div class="box"><h3>2. Jonli ko‘rinish</h3>
        <div class="preview-stage"><canvas id="pv"></canvas></div>
        <div class="row" style="margin-top:10px"><button class="btn" id="pvTalk">🗣 Gapirtirish</button><button class="btn" id="pvSmile">😊 Tabassum</button><button class="btn" id="pvListen">👂 Tinglash</button><button class="btn" id="pvBrows">🤨 Qosh</button></div>
        <h3 style="margin-top:16px">3. Xarakter</h3>
        <label><span>Ism (subtitrda ko‘rinadi)</span><input id="avName" value="${esc(cfg.name || '')}"></label>
        <label><span>Xarizma / ekspressivlik: <b id="chV">${cfg.charisma}</b></span><input type="range" id="charisma" min="0" max="1" step="0.05" value="${cfg.charisma}"></label>
        <label><span>Ovoz</span><select id="voiceG"><option value="male" ${cfg.voiceGender === 'male' ? 'selected' : ''}>Erkak</option><option value="female" ${cfg.voiceGender === 'female' ? 'selected' : ''}>Ayol</option></select></label>
        <p class="hint">Mashhur shaxs yuzidan foydalanish uchun uning yozma roziligi kerak. O‘z rasmingiz yoki litsenziyalangan rasm ishlating.</p>
        <div class="row end"><button class="btn ghost" id="avReset">Bekor qilish</button><button class="btn primary" id="avSave">💾 Saqlash</button></div>
      </div>
    </div>`;
    if ($('avInst')) $('avInst').onchange = async () => { instId = $('avInst').value; cfg = structuredClone(await load()); preview?.destroy(); render(); };
    const img = $('scImg');
    const place = () => {
      const k = img.clientWidth / img.naturalWidth;
      document.querySelectorAll('#sc .pt, #sc .eyebox').forEach((e) => e.remove());
      for (const [key, name, hint] of POINTS) {
        const [x, y] = cfg.landmarks[key];
        const el = document.createElement('div');
        el.className = 'pt';
        el.style.left = x * k + 'px';
        el.style.top = y * k + 'px';
        el.innerHTML = `<span>${name}</span>`;
        el.title = hint;
        if (key === 'mouthL' || key === 'eyeL') el.classList.add('left');
        el.onpointerdown = (e) => {
          el.setPointerCapture(e.pointerId);
          el.onpointermove = (ev) => {
            const r = img.getBoundingClientRect();
            const nx = Math.round(Math.max(0, Math.min(img.naturalWidth, (ev.clientX - r.left) / k)));
            const ny = Math.round(Math.max(0, Math.min(img.naturalHeight, (ev.clientY - r.top) / k)));
            cfg.landmarks[key] = [nx, ny];
            el.style.left = nx * k + 'px';
            el.style.top = ny * k + 'px';
            boxes();
          };
          el.onpointerup = () => { el.onpointermove = null; preview?.updateConfig({ landmarks: cfg.landmarks }); };
        };
        $('sc').append(el);
      }
      boxes();
    };
    const boxes = () => {
      const k = img.clientWidth / img.naturalWidth;
      document.querySelectorAll('#sc .eyebox').forEach((e) => e.remove());
      for (const key of ['eyeL', 'eyeR']) {
        const [x, y] = cfg.landmarks[key];
        const b = document.createElement('div');
        b.className = 'eyebox';
        const w = cfg.landmarks.eyeW * 1.3 * k;
        const h = cfg.landmarks.eyeH * k;
        Object.assign(b.style, { left: x * k - w + 'px', top: y * k - h + 'px', width: 2 * w + 'px', height: 2 * h + 'px' });
        $('sc').append(b);
      }
    };
    if (img.complete) place(); else img.onload = place;
    new ResizeObserver(place).observe(img);
    for (const id of ['eyeW', 'eyeH']) $(id).oninput = () => { cfg.landmarks[id] = Number($(id).value); boxes(); preview?.updateConfig({ landmarks: cfg.landmarks }); };
    $('charisma').oninput = () => { cfg.charisma = Number($('charisma').value); $('chV').textContent = cfg.charisma; preview?.updateConfig({ charisma: cfg.charisma }); };
    preview = new Avatar($('pv'), cfg);
    $('pvTalk').onclick = () => { const txt = 'Assalomu alaykum, aziz o‘quvchilar! Bugun juda qiziqarli mavzuni o‘rganamiz.'; const d = preview.speak(txt, 13); setTimeout(() => preview.stopSpeaking(), d * 1000); };
    $('pvSmile').onclick = () => { preview.setMood('happy'); setTimeout(() => preview.setMood('idle'), 2500); };
    $('pvListen').onclick = () => { preview.setMood('listening'); setTimeout(() => preview.setMood('idle'), 3000); };
    $('pvBrows').onclick = () => preview.react('brows');
    $('upload').onchange = async () => {
      const file = $('upload').files[0];
      if (!file) return;
      const dataUrl = await prepareImage(file);
      cfg.image = dataUrl;
      // reset landmarks proportionally to a typical portrait so the user only fine-tunes
      const im = new Image();
      im.src = dataUrl;
      await im.decode();
      const W = im.naturalWidth;
      const H = im.naturalHeight;
      const fx = W / 1269;
      const fy = H / 2000;
      const def = { eyeL: [492, 334], eyeR: [674, 327], mouthL: [519, 537], mouthC: [596, 527], mouthR: [673, 521], chin: [600, 700], neck: [605, 790] };
      for (const [k, [x, y]] of Object.entries(def)) cfg.landmarks[k] = [Math.round(x * fx), Math.round(y * fy)];
      cfg.landmarks.eyeW = Math.round(40 * fx);
      cfg.landmarks.eyeH = Math.round(21 * fy);
      preview.destroy();
      render();
      toast('Rasm yuklandi. Endi nuqtalarni ko‘z, og‘iz va iyakka moslang.', 'ok');
    };
    $('avReset').onclick = async () => { cfg = structuredClone(await load()); preview.destroy(); render(); };
    $('avSave').onclick = async () => {
      cfg.name = $('avName').value.trim() || 'AI Ustoz';
      cfg.voiceGender = $('voiceG').value;
      try { await put('avatar', { institutionId: instId, avatar: cfg }); toast('Avatar saqlandi — Classroom’da ishlatiladi', 'ok'); } catch (e) { toast(e.message, 'bad'); }
    };
  };
  render();
}

// Downscale large photos and keep transparency (WebP), so the classroom PC stays fast.
async function prepareImage(file) {
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.src = url;
  await img.decode();
  const scale = Math.min(1, 2000 / img.naturalHeight);
  const c = document.createElement('canvas');
  c.width = Math.round(img.naturalWidth * scale);
  c.height = Math.round(img.naturalHeight * scale);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  URL.revokeObjectURL(url);
  return c.toDataURL('image/webp', 0.9);
}

boot();
