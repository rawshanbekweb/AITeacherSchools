// AI Teacher Classroom: lesson runner driven by the explicit state machine (spec §5, §6).
import { get, post, put, apiMode } from './api.js';
import { Avatar } from './avatar.js';
import { Voice, Ears, checkDevices } from './speech.js';
import { mountVisual } from './visuals.js';
import { t, tState, setUiLang, uiLang, phrase } from './i18n.js';
import { S, createSnapshot, transition, isActive } from '../../shared/lessonMachine.js';

const $ = (id) => document.getElementById(id);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const app = {
  user: null, options: null, lesson: null, session: null, snap: null, group: null, institution: null,
  avatar: null, setupAvatar: null, avatarConfig: null, voice: new Voice(), ears: new Ears(),
  visual: null, visualSection: -1, materials: {}, students: [], attendance: {},
  runId: 0, history: [], micMuted: false, health: { ok: true, ai: 'offline' }, startedAt: 0, announced: {},
  wake: null, followTimer: null, saveTimer: null,
};
const alive = (id) => id === app.runId;
const L = () => app.lesson?.language || 'uz';
const P = (k) => phrase(L(), k);

// ───────────────────────── i18n / chrome ─────────────────────────
function applyTranslations() {
  document.querySelectorAll('[data-t]').forEach((el) => { el.textContent = t(el.dataset.t); });
  document.querySelectorAll('[data-lang-switch]').forEach((box) => {
    box.innerHTML = ['uz', 'ru', 'en'].map((l) => `<button type="button" class="${l === uiLang() ? 'on' : ''}" data-l="${l}">${l.toUpperCase()}</button>`).join('');
    box.querySelectorAll('button').forEach((b) => b.onclick = () => { setUiLang(b.dataset.l); applyTranslations(); });
  });
  if (app.snap) render();
}

function toast(msg, kind = '') {
  const el = document.createElement('div');
  el.className = `toast ${kind}`;
  el.textContent = msg;
  $('toasts').append(el);
  setTimeout(() => el.remove(), 5000);
}

function show(view) {
  $('login').hidden = view !== 'login';
  $('setup').hidden = view !== 'setup';
  $('app').hidden = view !== 'app';
}

// ───────────────────────── boot / auth ─────────────────────────
async function boot() {
  setUiLang(uiLang());
  applyTranslations();
  loadPrefs();
  if ((await apiMode()) === 'local') {
    $('modeBanner').hidden = false;
    $('modeBanner').textContent = 'Oflayn demo rejimi: server ishlamayapti, ma’lumotlar shu brauzerda saqlanadi';
  }
  try {
    const { user } = await get('me');
    app.user = user;
    await showSetup();
  } catch {
    show('login');
  }
}

$('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = new FormData(e.target);
  $('loginError').textContent = '';
  try {
    const { user } = await post('auth/login', { username: f.get('username'), password: f.get('password'), portal: 'classroom' });
    app.user = user;
    await showSetup();
  } catch (err) {
    $('loginError').textContent = err.message;
  }
});

async function logout() {
  stopEverything();
  try { await post('auth/logout'); } catch { /* ignore */ }
  location.reload();
}
$('logoutBtn').onclick = () => { if (!app.snap || app.snap.state === S.COMPLETED || confirm('Darsdan chiqasizmi? Dars holati saqlanadi.')) logout(); };
$('setupLogout').onclick = logout;

// ───────────────────────── setup ─────────────────────────
async function showSetup() {
  show('setup');
  $('whoami').textContent = `${app.user.fullName} · ${app.user.institutionName || 'Platforma'} · ${app.user.role}`;
  app.options = await get('classroom');
  const { institutions } = app.options;
  $('selInst').innerHTML = institutions.map((i) => `<option value="${i.id}">${esc(i.name)}</option>`).join('');
  $('selInst').closest('label').hidden = institutions.length < 2;
  $('selInst').onchange = onInstChange;
  $('selGroup').onchange = onGroupChange;
  $('selLesson').onchange = updateVoiceInfo;
  await onInstChange();
  runDeviceChecks();
}

async function onInstChange() {
  const instId = $('selInst').value;
  app.institution = app.options.institutions.find((i) => i.id === instId);
  const groups = app.options.groups.filter((g) => g.institutionId === instId);
  $('selGroup').innerHTML = groups.map((g) => `<option value="${g.id}">${esc(g.name)}</option>`).join('');
  document.body.classList.remove('mode-kindergarten', 'mode-school', 'mode-university');
  document.body.classList.add('mode-' + app.institution.type);
  onGroupChange();
  const { avatar } = await get('avatar?institutionId=' + instId);
  app.avatarConfig = avatar;
  if (app.setupAvatar) await app.setupAvatar.updateConfig(avatar);
  else {
    app.setupAvatar = new Avatar($('setupAvatar'), avatar);
    app.setupAvatar.ready.catch((e) => console.error(e));
  }
}

function onGroupChange() {
  const gid = $('selGroup').value;
  const lessons = app.options.lessons.filter((l) => l.groupIds.includes(gid));
  const active = app.options.activeSessions.filter((s) => s.groupId === gid);
  $('selLesson').innerHTML = lessons.map((l) => {
    const a = active.find((s) => s.lessonId === l.id);
    return `<option value="${l.id}">${esc(l.title)} · ${l.language.toUpperCase()} · ${l.sections} bo‘lim${a ? ' · ⟳ davom ettirish' : ''}</option>`;
  }).join('') || '<option value="">— bu guruhga dars biriktirilmagan —</option>';
  $('startBtn').disabled = !lessons.length;
  $('startBtn').textContent = active.length ? t('resumeLesson') : t('startLesson');
  updateVoiceInfo();
}

function updateVoiceInfo() {
  const l = app.options?.lessons.find((x) => x.id === $('selLesson').value);
  const lang = l?.language || 'uz';
  const d = app.voice.describe(lang, app.avatarConfig?.voiceGender);
  $('voiceInfo').innerHTML = `${t('voice')}: <b>${esc(d.name)}</b>${d.available && !d.native ? ' — tilga mos ovoz topilmadi, yaqin ovoz ishlatiladi (Microsoft Edge’da o‘zbekcha neyron ovozlar mavjud)' : ''}`;
}

async function runDeviceChecks() {
  const d = await checkDevices();
  const h = await get('health').catch(() => null);
  app.health = h ? { ok: true, ai: h.ai } : { ok: false, ai: 'down' };
  const item = (name, st, text) => `<span class="ind ${st}"><i></i>${name}: ${text}</span>`;
  const map = { available: ['ok', 'bor'], missing: ['bad', 'topilmadi'], unknown: ['warn', 'ruxsat kerak'] };
  $('checks').innerHTML = [
    item(t('camera'), ...map[d.camera]), item(t('mic'), ...map[d.microphone]),
    item(t('speaker'), ...(window.speechSynthesis ? ['ok', 'TTS bor'] : ['warn', 'subtitrlar'])),
    item(t('network'), navigator.onLine ? 'ok' : 'bad', navigator.onLine ? 'onlayn' : 'oflayn'),
    item(t('ai'), h ? 'ok' : 'bad', h ? (h.ai === 'llm' ? 'Claude' : 'oflayn baza') : 'mavjud emas'),
    item('STT', app.ears.supported ? 'ok' : 'warn', app.ears.supported ? 'bor' : 'matn orqali'),
  ].join('');
}

$('testVoice').onclick = async () => {
  const l = app.options.lessons.find((x) => x.id === $('selLesson').value);
  const lang = l?.language || 'uz';
  const text = lang === 'ru' ? 'Здравствуйте! Я ваш виртуальный преподаватель.' : lang === 'en' ? 'Hello! I am your virtual teacher.' : 'Assalomu alaykum! Men sizning virtual ustozingizman.';
  await speakWith(app.setupAvatar, text, lang);
};
$('testMic').onclick = async () => {
  try {
    const s = await navigator.mediaDevices.getUserMedia({ audio: true });
    s.getTracks().forEach((tr) => tr.stop());
    toast('Mikrofon ishlayapti ✓', 'ok');
  } catch (e) { toast('Mikrofonga ruxsat yo‘q: ' + e.message, 'bad'); }
  runDeviceChecks();
};
$('testCam').onclick = async () => {
  const v = $('camPreview');
  if (v.srcObject) { v.srcObject.getTracks().forEach((tr) => tr.stop()); v.srcObject = null; v.hidden = true; return; }
  try {
    v.srcObject = await navigator.mediaDevices.getUserMedia({ video: true });
    v.hidden = false;
    v.play();
    toast('Kamera faol (yozib olinmaydi). O‘chirish uchun tugmani qayta bosing.', 'ok');
  } catch (e) { toast('Kameraga ruxsat yo‘q: ' + e.message, 'bad'); }
  runDeviceChecks();
};

$('startBtn').onclick = async () => {
  $('setupError').textContent = '';
  const lessonId = $('selLesson').value;
  const groupId = $('selGroup').value;
  if (!lessonId) return;
  $('startBtn').disabled = true;
  try {
    const v = $('camPreview');
    if (v.srcObject) { v.srcObject.getTracks().forEach((tr) => tr.stop()); v.srcObject = null; v.hidden = true; }
    const { session, lesson, resumed } = await post('sessions/start', { lessonId, groupId });
    const [{ items: materials }, { items: students }, { item: group }] = await Promise.all([
      get('materials?pageSize=200'), get(`students?groupId=${groupId}&pageSize=200`), get('groups/' + groupId),
    ]);
    app.session = session;
    app.lesson = lesson;
    app.group = group;
    app.materials = Object.fromEntries(materials.map((m) => [m.id, m]));
    app.students = students.filter((s) => s.status !== 'inactive');
    app.startedAt = Date.parse(session.startedAt);
    await enterClassroom(resumed && session.snapshot ? session.snapshot : null);
  } catch (e) {
    $('setupError').textContent = e.message;
  } finally {
    $('startBtn').disabled = false;
  }
};

// ───────────────────────── classroom ─────────────────────────
async function enterClassroom(savedSnap) {
  show('app');
  app.setupAvatar?.destroy();
  app.setupAvatar = null;
  $('lessonTitle').textContent = app.lesson.title;
  $('lessonMeta').textContent = `${app.group.name} · ${app.institution.name}`;
  $('teacherName').textContent = app.avatarConfig?.name || 'AI Ustoz';
  $('teacherRole').textContent = `${app.lesson.title} · ${app.lesson.language.toUpperCase()}`;
  app.avatar = new Avatar($('teacherCanvas'), app.avatarConfig);
  await app.avatar.ready.catch((e) => console.error(e));
  app.history = [];
  app.announced = {};
  buildPlan();
  fillSamples();
  showSection(0);
  setInterval(tickTimer, 1000);
  setInterval(pingHealth, 15000);

  if (savedSnap && savedSnap.state !== S.READY && savedSnap.state !== S.COMPLETED) {
    // Page reload / crash: restore exactly where we were (spec §14 "Надёжность").
    app.snap = savedSnap;
    if (isActive(savedSnap.state)) dispatch('CONNECTION_LOST');
    else render();
    if (app.snap.state === S.PAUSED_BY_TEACHER) $('pauseOverlay').hidden = false;
    toast('Avvalgi dars holati tiklandi. Davom ettirish uchun tugmani bosing.', 'warn');
    for (let i = 0; i <= app.snap.position.section; i++) app.announced[i] = true;
    await loadAttendance();
    return;
  }
  app.snap = createSnapshot(app.lesson);
  dispatch('START');
}

function dispatch(ev) {
  const event = typeof ev === 'string' ? { type: ev } : ev;
  const prev = app.snap.state;
  const r = transition(app.snap, event);
  if (!r.changed) { console.debug('[lesson] ignored', event.type, '—', r.reason); return false; }
  app.snap = r.snapshot;
  scheduleSave();
  render();
  if (prev !== app.snap.state) onEnter(app.snap.state, prev, event);
  return true;
}

function scheduleSave() {
  clearTimeout(app.saveTimer);
  const snap = app.snap;
  app.saveTimer = setTimeout(async () => {
    if (snap.state === S.COMPLETED) return; // completion is saved by the complete call
    try { await put(`sessions/${app.session.id}/state`, { snapshot: snap }); } catch (e) {
      if (e.status === 0 && isActive(app.snap.state)) dispatch('CONNECTION_LOST');
    }
  }, 400);
}

function hidePanels() {
  for (const id of ['attendancePanel', 'questionPanel', 'followPanel', 'quizPanel', 'summaryPanel']) $(id).hidden = true;
}

async function onEnter(state, prev, event) {
  const id = ++app.runId;
  app.voice.cancel();
  app.ears.stop();
  stopWake();
  clearInterval(app.followTimer);
  $('pauseOverlay').hidden = state !== S.PAUSED_BY_TEACHER;
  $('recoveryOverlay').hidden = state !== S.RECOVERY;
  if (state !== S.PAUSED_BY_TEACHER && state !== S.RECOVERY) hidePanels();
  setStageMode(state === S.LISTENING_FOR_QUESTION || state === S.CHECKING_FOLLOW_UP ? 'listening' : 'idle');
  const back = prev === S.PAUSED_BY_TEACHER || prev === S.RECOVERY;

  switch (state) {
    case S.CHECKING_ATTENDANCE: {
      $('attendancePanel').hidden = false;
      await loadAttendance();
      renderAttendance();
      if (!back) {
        app.avatar.react('smile');
        await say(app.lesson.greeting, id);
        if (alive(id)) await say(P('attendance'), id);
      }
      break;
    }
    case S.TEACHING:
      if (back) await say(P('resumed'), id);
      else if (prev === S.CHECKING_FOLLOW_UP || prev === S.LISTENING_FOR_QUESTION) await say(P('resume'), id);
      if (alive(id)) runTeaching(id);
      break;
    case S.LISTENING_FOR_QUESTION:
      $('questionPanel').hidden = false;
      $('questionInput').value = '';
      $('interim').textContent = '…';
      app.avatar.setMood('listening');
      await say(P('listening'), id, 'listening');
      if (alive(id)) listenForQuestion(id);
      break;
    case S.ANSWERING:
      answerQuestion(id, app.snap.pendingQuestion);
      break;
    case S.CHECKING_FOLLOW_UP:
      $('followPanel').hidden = false;
      app.avatar.setMood('listening');
      await say(P('more'), id, 'listening');
      if (alive(id)) followUpCountdown(id);
      break;
    case S.KNOWLEDGE_CHECK:
      if (prev === S.TEACHING) { app.avatar.react('smile'); await say(P('quizIntro'), id); }
      else if (prev === S.CHECKING_FOLLOW_UP || prev === S.LISTENING_FOR_QUESTION) await say(P('resume'), id);
      if (alive(id)) showQuiz(id);
      break;
    case S.PAUSED_BY_TEACHER:
      app.avatar.setMood('idle');
      $('subtitle').textContent = '';
      break;
    case S.RECOVERY:
      app.avatar.setMood('thinking');
      recoveryLoop(id);
      break;
    case S.COMPLETED:
      completeLesson(id);
      break;
    default:
  }
}

// ───────────────────────── speaking ─────────────────────────
async function speakWith(avatar, text, lang, mood) {
  if (!avatar) return { completed: true };
  const stage = $('stage');
  const cps = 13 * app.voice.rate;
  avatar.speak(text, cps);
  stage?.classList.add('speaking');
  renderSubtitle(text);
  let raf;
  const follow = () => {
    const s = avatar.speech;
    if (s) {
      const el = (performance.now() - s.start) / 1000;
      const ct = s.visemes.charTime;
      let ci = 0;
      while (ci < ct.length - 1 && ct[ci + 1] <= el) ci++;
      highlightSubtitle(ci);
    }
    raf = requestAnimationFrame(follow);
  };
  raf = requestAnimationFrame(follow);
  const res = await app.voice.speak(text, {
    lang, gender: app.avatarConfig?.voiceGender,
    hooks: {
      onStart: () => { if (avatar.speech) avatar.speech.start = performance.now(); },
      onBoundary: (ci) => avatar.syncTo(ci),
    },
  });
  cancelAnimationFrame(raf);
  avatar.stopSpeaking();
  if (mood) avatar.setMood(mood);
  stage?.classList.remove('speaking');
  highlightSubtitle(Infinity);
  return res;
}

async function say(text, id, mood) {
  if (!alive(id)) return false;
  const { completed } = await speakWith(app.avatar, text, L(), mood);
  if (completed && alive(id)) await sleep(250);
  return completed && alive(id);
}

function renderSubtitle(text) {
  const host = $('subtitle');
  host.innerHTML = '';
  const box = document.createElement('p');
  box.className = 'line';
  host.append(box);
  let idx = 0;
  for (const part of text.split(/(\s+)/)) {
    if (/^\s+$/.test(part)) { box.append(part); idx += part.length; continue; }
    const span = document.createElement('span');
    span.className = 'w';
    span.dataset.i = idx;
    span.textContent = part;
    box.append(span);
    idx += part.length;
  }
}
function highlightSubtitle(ci) {
  for (const w of $('subtitle').querySelectorAll('.w')) w.classList.toggle('on', Number(w.dataset.i) <= ci);
}

function setStageMode(mode) {
  $('stage').classList.toggle('listening', mode === 'listening');
}

// ───────────────────────── teaching loop ─────────────────────────
async function runTeaching(id) {
  while (alive(id) && app.snap.state === S.TEACHING) {
    const pos = app.snap.position;
    const sec = app.lesson.sections[pos.section];
    showSection(pos.section);
    if (pos.sentence === 0 && !app.announced[pos.section]) {
      app.announced[pos.section] = true;
      app.avatar.react('brows');
      if (!(await say(`${pos.section === 0 ? '' : P('nextSection') + ' '}${sec.title}.`, id))) return;
    }
    if (pos.sentence >= sec.sentences.length) {
      dispatch('SECTION_DONE');
      continue;
    }
    const sentence = sec.sentences[pos.sentence];
    app.visual?.focus(sentence, pos.sentence);
    addTranscript('a', sentence);
    if (!(await say(sentence, id))) return;
    if (/!/.test(sentence)) app.avatar.react('smile');
    dispatch({ type: 'PROGRESS', sentence: pos.sentence + 1 });
    startWake();
  }
}

function showSection(i) {
  const sec = app.lesson.sections[i];
  if (!sec) return;
  if (app.visualSection !== i) {
    app.visual?.destroy();
    const mat = app.materials[sec.materialId];
    app.visual = mountVisual($('visual'), mat, sec);
    app.visualSection = i;
    $('materialBadge').textContent = mat ? `📚 ${mat.title}` : '';
  }
  $('sectionTitle').textContent = `${i + 1}. ${sec.title}`;
}

function buildPlan() {
  $('plan').innerHTML = app.lesson.sections.map((s, i) => `<div class="step" data-i="${i}"><small>${i + 1}-bo‘lim</small><b>${esc(s.title)}</b><i class="bar"></i></div>`).join('')
    + (app.lesson.quiz?.length ? `<div class="step" data-i="quiz"><small>Yakun</small><b>${esc(t('quiz'))}</b><i class="bar"></i></div>` : '');
}

function render() {
  const s = app.snap;
  if (!s) return;
  $('statePill').textContent = tState(s.state);
  $('statePill').dataset.s = s.state;
  document.querySelectorAll('#plan .step').forEach((el) => {
    const i = el.dataset.i;
    const isQuiz = i === 'quiz';
    const cur = isQuiz ? s.state === S.KNOWLEDGE_CHECK : Number(i) === s.position.section && s.state !== S.KNOWLEDGE_CHECK && s.state !== S.COMPLETED;
    const done = isQuiz ? s.state === S.COMPLETED : s.completedSections.includes(Number(i));
    el.classList.toggle('current', cur);
    el.classList.toggle('done', done);
    const n = isQuiz ? s.quizCount : app.lesson.sections[Number(i)].sentences.length;
    const p = isQuiz ? s.position.quiz : (done ? n : cur ? s.position.sentence : 0);
    el.querySelector('.bar').style.width = `${Math.round((100 * p) / Math.max(1, n))}%`;
  });
  const st = s.state;
  const can = {
    pause: isActive(st), resume: st === S.PAUSED_BY_TEACHER,
    ask: [S.TEACHING, S.KNOWLEDGE_CHECK, S.CHECKING_FOLLOW_UP].includes(st),
    repeat: st === S.TEACHING || st === S.KNOWLEDGE_CHECK, next: st === S.TEACHING,
    stopVoice: true, mic: true, end: st !== S.COMPLETED,
  };
  document.querySelectorAll('#controls .ctl').forEach((b) => { b.disabled = !can[b.dataset.act]; });
  document.querySelector('[data-act=resume]').hidden = st !== S.PAUSED_BY_TEACHER;
  document.querySelector('[data-act=pause]').hidden = st === S.PAUSED_BY_TEACHER;
  const sv = document.querySelector('[data-act=stopVoice]');
  sv.classList.toggle('off', app.voice.muted);
  sv.querySelector('b').textContent = app.voice.muted ? 'Ovozni yoqish' : t('stopVoice');
  const mic = document.querySelector('[data-act=mic]');
  mic.classList.toggle('off', app.micMuted);
  mic.querySelector('b').textContent = app.micMuted ? t('unmuteMic') : t('muteMic');
  renderIndicators();
}

function renderIndicators() {
  const listening = app.snap?.state === S.LISTENING_FOR_QUESTION && !app.micMuted && app.ears.supported;
  const voiceDesc = app.voice.describe(L(), app.avatarConfig?.voiceGender);
  const items = [
    ['📷', t('camera'), 'ok', 'tayyor'],
    ['🎙', t('mic'), app.micMuted ? 'bad' : listening ? 'live' : app.ears.supported ? 'ok' : 'warn', app.micMuted ? 'o‘chiq' : listening ? 'tinglayapti' : app.ears.supported ? 'tayyor' : 'matn'],
    ['🔊', t('speaker'), app.voice.muted ? 'warn' : voiceDesc.available ? 'ok' : 'warn', app.voice.muted ? 'ovozsiz' : voiceDesc.available ? 'TTS' : 'subtitr'],
    ['🌐', t('network'), navigator.onLine ? 'ok' : 'bad', navigator.onLine ? 'onlayn' : 'oflayn'],
    ['✦', t('ai'), app.health.ok ? 'ok' : 'bad', app.health.ok ? (app.health.ai === 'llm' ? 'Claude' : 'baza') : 'xato'],
  ];
  $('indicators').innerHTML = items.map(([ic, name, st, txt]) => `<span class="ind ${st}" title="${esc(name)}: ${esc(txt)}"><i></i>${ic} ${esc(txt)}</span>`).join('');
}

function tickTimer() {
  if (!app.startedAt || app.snap?.state === S.COMPLETED) return;
  const s = Math.floor((Date.now() - app.startedAt) / 1000);
  $('timer').textContent = `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

function addTranscript(kind, text) {
  const div = document.createElement('div');
  div.className = kind;
  div.textContent = (kind === 'q' ? '❓ ' : '') + text;
  $('transcript').append(div);
  $('transcript').scrollTop = 1e9;
}

// ───────────────────────── attendance ─────────────────────────
async function loadAttendance() {
  try {
    const { items } = await get(`attendance?sessionId=${app.session.id}&pageSize=200`);
    app.attendance = Object.fromEntries(items.map((a) => [a.studentId, a.status]));
  } catch { app.attendance = {}; }
}

function renderAttendance() {
  const labels = { present: t('present'), absent: t('absent'), late: t('late'), excused: t('excused') };
  $('attList').innerHTML = app.students.map((s) => `
    <div class="att" data-id="${s.id}"><span>${esc(s.fullName)}</span><div class="seg">
      ${Object.entries(labels).map(([v, l]) => `<button type="button" data-v="${v}" class="${app.attendance[s.id] === v ? 'on' : ''}">${esc(l)}</button>`).join('')}
    </div></div>`).join('');
  $('attList').querySelectorAll('.att').forEach((row) => row.querySelectorAll('button').forEach((b) => {
    b.onclick = () => { app.attendance[row.dataset.id] = b.dataset.v; renderAttendance(); };
  }));
  const marked = app.students.filter((s) => app.attendance[s.id]).length;
  const present = app.students.filter((s) => ['present', 'late'].includes(app.attendance[s.id])).length;
  $('attSummary').textContent = `Belgilangan: ${marked}/${app.students.length} · Darsda: ${present}`;
}
$('allPresent').onclick = () => { app.students.forEach((s) => { if (!app.attendance[s.id]) app.attendance[s.id] = 'present'; }); renderAttendance(); };
$('confirmAttendance').onclick = async () => {
  const unmarked = app.students.filter((s) => !app.attendance[s.id]);
  if (unmarked.length && !confirm(`${unmarked.length} nafar o‘quvchi belgilanmagan. Ular «yo‘q» deb belgilansinmi?`)) return;
  unmarked.forEach((s) => { app.attendance[s.id] = 'absent'; });
  try {
    await post(`sessions/${app.session.id}/attendance`, { records: app.students.map((s) => ({ studentId: s.id, status: app.attendance[s.id], method: 'manual' })) });
  } catch (e) { toast('Davomat saqlanmadi: ' + e.message, 'bad'); return; }
  dispatch('ATTENDANCE_CONFIRMED');
};

// ───────────────────────── questions ─────────────────────────
function fillSamples() {
  const qs = app.lesson.sampleQuestions || [];
  $('sampleQuestions').innerHTML = qs.map((q) => `<button type="button">${esc(q)}</button>`).join('');
  $('sampleQuestions').querySelectorAll('button').forEach((b) => b.onclick = () => submitQuestion(b.textContent));
}

async function listenForQuestion(id) {
  if (app.micMuted || !app.ears.supported) {
    $('micLive').classList.remove('on');
    $('interim').textContent = app.ears.supported ? 'Mikrofon o‘chirilgan — savolni yozing' : 'Brauzer ovozni tanimaydi — savolni yozing';
    $('questionInput').focus();
    return;
  }
  $('micLive').classList.add('on');
  renderIndicators();
  const r = await app.ears.listen({ lang: L(), onInterim: (txt) => { $('interim').textContent = txt; } });
  $('micLive').classList.remove('on');
  renderIndicators();
  if (!alive(id)) return;
  if (!r || !r.text) { $('interim').textContent = 'Eshitilmadi. Qayta urinib ko‘ring yoki yozing.'; return; }
  // Show what was recognised; ask for confirmation when recognition is unsure (spec §7).
  $('questionInput').value = r.text;
  if (r.confidence >= 0.7) submitQuestion(r.text);
  else $('interim').textContent = `«${r.text}» — to‘g‘ri bo‘lsa «${t('send')}» tugmasini bosing`;
}

function submitQuestion(text) {
  if (!text || !text.trim()) return;
  app.ears.stop();
  dispatch({ type: 'QUESTION_RECEIVED', text });
}
$('questionForm').addEventListener('submit', (e) => { e.preventDefault(); submitQuestion($('questionInput').value); });
$('cancelQuestion').onclick = () => { app.ears.stop(); dispatch('QUESTION_CANCELLED'); };
$('retryMic').onclick = () => listenForQuestion(app.runId);

async function answerQuestion(id, question) {
  addTranscript('q', question);
  renderSubtitle('❓ ' + question);
  $('thinking').hidden = false;
  app.avatar.setMood('thinking');
  const slow = setTimeout(() => { if (alive(id)) speakWith(app.avatar, P('thinking'), L(), 'thinking'); }, 2500);
  let res;
  try {
    res = await post('ai/answer', {
      lessonId: app.lesson.id, sectionIndex: app.snap.resume?.position.section ?? app.snap.position.section, question,
      history: app.history.slice(-4),
    });
  } catch (e) {
    res = { answer: L() === 'ru' ? 'Не удалось получить ответ. Я передам вопрос преподавателю.' : 'Javob olishda xatolik yuz berdi. Savolni o‘qituvchiga yo‘naltiraman.', escalated: true, confidence: 0, source: 'error' };
    app.health.ok = false;
    renderIndicators();
  }
  clearTimeout(slow);
  $('thinking').hidden = true;
  if (!alive(id)) return;
  app.voice.cancel();
  app.history.push({ q: question, a: res.answer });
  post(`sessions/${app.session.id}/questions`, { text: question, answer: res.answer, confidence: res.confidence, source: res.source, escalated: res.escalated, section: res.section }).catch(() => {});
  if (res.section !== undefined && res.section !== app.visualSection) showSection(res.section);
  app.avatar.setMood('speaking');
  addTranscript('a', res.answer);
  await say(res.answer, id);
  if (!alive(id)) return;
  if (res.escalated) toast(`${P('escalated')} «${question}»`, 'warn');
  showSection((app.snap.resume?.position ?? app.snap.position).section);
  dispatch('ANSWER_DONE');
}

function followUpCountdown(id) {
  const total = 10000;
  const start = Date.now();
  $('followBar').style.transform = 'scaleX(1)';
  app.followTimer = setInterval(() => {
    if (!alive(id)) return clearInterval(app.followTimer);
    const left = 1 - (Date.now() - start) / total;
    $('followBar').style.transform = `scaleX(${Math.max(0, left)})`;
    if (left <= 0) { clearInterval(app.followTimer); dispatch('FOLLOW_UP_TIMEOUT'); }
  }, 100);
  // voice answer: "ha" / "yo'q"
  if (!app.micMuted && app.ears.supported) {
    app.ears.listen({ lang: L(), timeoutMs: 8000 }).then((r) => {
      if (!alive(id) || !r?.text) return;
      const x = r.text.toLowerCase();
      if (/\b(yo['‘ʻ]?q|нет|no|davom)/.test(x)) dispatch('NO_MORE_QUESTIONS');
      else if (/\b(ha|bor|да|есть|yes)\b/.test(x)) dispatch('QUESTION_REQUESTED');
    });
  }
}
$('followYes').onclick = () => dispatch('QUESTION_REQUESTED');
$('followNo').onclick = () => dispatch('NO_MORE_QUESTIONS');

// Optional wake word while teaching ("Ustoz", "Учитель", "Teacher").
function startWake() {
  if (!$('wakeWord').checked || app.micMuted || !app.ears.supported || app.wake) return;
  const r = new app.ears.SR();
  r.lang = { uz: 'uz-UZ', ru: 'ru-RU', en: 'en-US' }[L()];
  r.continuous = true;
  r.interimResults = true;
  r.onresult = (e) => {
    const txt = [...e.results].map((x) => x[0].transcript).join(' ').toLowerCase();
    if (/ustoz|учитель|teacher|savolim bor|у меня вопрос/.test(txt)) { stopWake(); dispatch('QUESTION_REQUESTED'); }
  };
  r.onend = () => { app.wake = null; if (app.snap?.state === S.TEACHING) setTimeout(startWake, 300); };
  try { r.start(); app.wake = r; } catch { app.wake = null; }
}
function stopWake() { try { app.wake?.abort(); } catch { /* ignore */ } app.wake = null; }

// ───────────────────────── knowledge check ─────────────────────────
async function showQuiz(id) {
  const i = app.snap.position.quiz;
  const q = app.lesson.quiz[i];
  if (!q) return;
  $('quizPanel').hidden = false;
  $('quizCount').textContent = `${i + 1} / ${app.lesson.quiz.length}`;
  $('quizQ').textContent = q.q;
  $('quizFeedback').textContent = '';
  $('quizOptions').innerHTML = q.options.map((o, k) => `<button type="button" data-k="${k}"><i>${'ABCDEFG'[k]}</i>${esc(o)}</button>`).join('');
  let answered = false;
  $('quizOptions').querySelectorAll('button').forEach((b) => b.onclick = async () => {
    if (answered || !alive(id)) return;
    answered = true;
    const k = Number(b.dataset.k);
    const correct = k === q.answer;
    b.classList.add(correct ? 'right' : 'wrong');
    $('quizOptions').querySelector(`[data-k="${q.answer}"]`).classList.add('right');
    post(`sessions/${app.session.id}/results`, { quizIndex: i, question: q.q, answer: q.options[k], correct, checkType: 'class_quiz' }).catch(() => toast('Natija saqlanmadi', 'bad'));
    const fb = `${correct ? P('correct') : P('wrong')} ${q.explain || ''}`;
    $('quizFeedback').textContent = fb;
    if (correct) app.avatar.setMood('happy');
    await say(fb, id);
    app.avatar.setMood('idle');
    if (!alive(id)) return;
    dispatch('QUIZ_ANSWERED');
    if (app.snap.state === S.KNOWLEDGE_CHECK) showQuiz(id);
  });
  await say(q.q, id);
}

// ───────────────────────── completion / report ─────────────────────────
async function completeLesson(id) {
  stopWake();
  let rep;
  try { rep = await post(`sessions/${app.session.id}/complete`, { snapshot: app.snap }); } catch (e) { toast('Hisobot saqlanmadi: ' + e.message, 'bad'); return; }
  renderSummary(rep);
  app.avatar.setMood('happy');
  const scoreLine = rep.score != null ? ` ${P('summaryScore')} ${rep.score} ${P('percent')}.` : '';
  await say(P('bye') + scoreLine, id);
  app.avatar.setMood('idle');
}

function renderSummary(rep) {
  $('summaryPanel').hidden = false;
  const present = rep.attendance.filter((a) => a.status === 'present' || a.status === 'late').length;
  const done = rep.lesson.sections.filter((s) => s.done).length;
  const esq = rep.questions.filter((q) => q.escalated);
  const wrong = rep.results.filter((r) => !r.correct);
  const statusLabel = { present: '✅ bor', late: '⏰ kechikdi', absent: '❌ yo‘q', excused: '📄 sababli', unmarked: '— belgilanmagan' };
  $('summaryBody').innerHTML = `
    <p class="muted">${esc(rep.lesson.title)} · ${esc(rep.group.name)} · ${new Date(rep.session.startedAt).toLocaleString()} · O‘qituvchi: ${esc(rep.session.teacherName)}</p>
    <div class="summary-grid">
      <div class="stat"><b>${present}/${rep.attendance.length}</b><span>Davomat</span></div>
      <div class="stat"><b>${done}/${rep.lesson.sections.length}</b><span>O‘tilgan bo‘limlar</span></div>
      <div class="stat"><b>${rep.score ?? '—'}${rep.score != null ? '%' : ''}</b><span>Test natijasi</span></div>
      <div class="stat"><b>${rep.questions.length}</b><span>Savollar (${esq.length} o‘qituvchiga)</span></div>
    </div>
    <div class="summary-cols">
      <div><h4>Bo‘limlar</h4><ul>${rep.lesson.sections.map((s) => `<li>${s.done ? '✅' : '⬜'} ${esc(s.title)}</li>`).join('')}</ul>
        <h4>Tavsiya etilgan takrorlash</h4><ul>${wrong.length ? wrong.map((r) => `<li>${esc(r.question)}</li>`).join('') : '<li>Barcha savollarga to‘g‘ri javob berildi 🎉</li>'}</ul>
        ${esq.length ? `<h4>O‘qituvchi javob berishi kerak</h4><ul>${esq.map((q) => `<li>${esc(q.text)}</li>`).join('')}</ul>` : ''}</div>
      <div><h4>Davomat</h4><ul>${rep.attendance.map((a) => `<li>${esc(a.fullName)} — ${statusLabel[a.status] || a.status}</li>`).join('')}</ul></div>
    </div>`;
}
$('printReport').onclick = () => window.print();
$('newLesson').onclick = () => location.reload();

// ───────────────────────── teacher controls ─────────────────────────
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-act]');
  if (!b || b.disabled) return;
  const act = b.dataset.act;
  if (act === 'pause') dispatch('PAUSE');
  if (act === 'resume') dispatch('RESUME');
  if (act === 'ask') dispatch('QUESTION_REQUESTED');
  if (act === 'next') {
    app.runId++;
    app.voice.cancel();
    if (dispatch('NEXT_SECTION') && app.snap.state === S.TEACHING) runTeaching(app.runId);
  }
  if (act === 'repeat') {
    const st = app.snap.state;
    const id = ++app.runId;
    app.voice.cancel();
    if (st === S.TEACHING) runTeaching(id);
    if (st === S.KNOWLEDGE_CHECK) showQuiz(id);
  }
  if (act === 'stopVoice') {
    app.voice.muted = !app.voice.muted;
    if (app.voice.muted && app.voice.synth) app.voice.synth.cancel();
    toast(app.voice.muted ? 'Ovozsiz rejim: dars subtitrlar bilan davom etadi' : 'Ovoz yoqildi', 'ok');
    render();
  }
  if (act === 'mic') {
    app.micMuted = !app.micMuted;
    if (app.micMuted) { app.ears.stop(); stopWake(); }
    render();
  }
  if (act === 'end' && confirm('Darsni yakunlaysizmi?')) dispatch('END');
});

document.addEventListener('keydown', (e) => {
  if (e.target.matches('input, textarea, select') || $('app').hidden) return;
  if (e.code === 'Space') { e.preventDefault(); dispatch(app.snap.state === S.PAUSED_BY_TEACHER ? 'RESUME' : 'PAUSE'); }
  if (e.key === 'q' || e.key === 'Q') dispatch('QUESTION_REQUESTED');
  if (e.key === 'n' || e.key === 'N') document.querySelector('[data-act=next]').click();
});

// ───────────────────────── reliability ─────────────────────────
async function pingHealth() {
  try {
    const h = await get('health');
    app.health = { ok: true, ai: h.ai };
  } catch {
    app.health = { ok: false, ai: 'down' };
    if (app.snap && isActive(app.snap.state)) dispatch('CONNECTION_LOST');
  }
  renderIndicators();
}
window.addEventListener('offline', () => { renderIndicators(); if (app.snap && isActive(app.snap.state)) dispatch('CONNECTION_LOST'); });
window.addEventListener('online', renderIndicators);

async function recoveryLoop(id) {
  while (alive(id) && app.snap.state === S.RECOVERY) {
    const ok = navigator.onLine && (await get('health').then(() => true, () => false));
    $('forceRecover').disabled = !ok;
    $('forceRecover').textContent = ok ? t('resumeLesson') : 'Qayta urinish…';
    await sleep(2500);
  }
}
$('forceRecover').onclick = async () => {
  const ok = navigator.onLine && (await get('health').then(() => true, () => false));
  if (ok) { await put(`sessions/${app.session.id}/state`, { snapshot: app.snap }).catch(() => {}); dispatch('RECOVERED'); } else toast('Aloqa hali tiklanmadi', 'warn');
};

function stopEverything() {
  app.runId++;
  app.voice.cancel();
  app.ears.stop();
  stopWake();
}

// ───────────────────────── settings / accessibility ─────────────────────────
function loadPrefs() {
  let p = {};
  try { p = JSON.parse(localStorage.getItem('ait-classroom-prefs') || '{}'); } catch { /* ignore */ }
  if (p.volume != null) $('volume').value = p.volume;
  if (p.rate != null) $('rate').value = p.rate;
  if (p.textSize != null) $('textSize').value = p.textSize;
  if (p.subtitles != null) $('subtitlesOn').checked = p.subtitles;
  if (p.wake != null) $('wakeWord').checked = p.wake;
  app.voice.manual = p.voices || {};
  applyPrefs();
}
function applyPrefs() {
  app.voice.volume = Number($('volume').value);
  app.voice.rate = Number($('rate').value);
  document.documentElement.style.setProperty('--fs', $('textSize').value);
  document.body.classList.toggle('subtitles-off', !$('subtitlesOn').checked);
  try {
    localStorage.setItem('ait-classroom-prefs', JSON.stringify({
      volume: $('volume').value, rate: $('rate').value, textSize: $('textSize').value,
      subtitles: $('subtitlesOn').checked, wake: $('wakeWord').checked, voices: app.voice.manual,
    }));
  } catch { /* ignore */ }
}
for (const id of ['volume', 'rate', 'textSize', 'subtitlesOn', 'wakeWord']) $(id).addEventListener('input', applyPrefs);
$('wakeWord').addEventListener('change', () => { if ($('wakeWord').checked && app.snap?.state === S.TEACHING) startWake(); else stopWake(); });
$('settingsBtn').onclick = () => {
  const lang = L();
  const vs = app.voice.voices;
  const cur = app.voice.pick(lang, app.avatarConfig?.voiceGender);
  $('voiceSelect').innerHTML = `<option value="">Avtomatik</option>` + vs.map((v) => `<option value="${esc(v.voiceURI)}" ${cur && v.voiceURI === cur.voiceURI && app.voice.manual[lang] ? 'selected' : ''}>${esc(v.name)} (${esc(v.lang)})</option>`).join('');
  $('uiLang').value = uiLang();
  $('settingsDialog').showModal();
};
$('voiceSelect').onchange = () => { app.voice.manual[L()] = $('voiceSelect').value || undefined; applyPrefs(); renderIndicators(); };
$('uiLang').onchange = () => { setUiLang($('uiLang').value); applyTranslations(); };

boot();
