// Runs a lesson in the classroom: drives the explicit state machine (spec §5–6), the avatar,
// voice I/O, lesson visuals and persistence. React renders `state` via subscribe/getState.
import { createSnapshot, isActive, S, transition, type LessonEvent } from '@/lib/core/lessonMachine';
import type { AnswerResult, AvatarConfig, Lesson, LessonSnapshot, Material, SessionReport } from '@/lib/core/types';
import type { Avatar } from './avatar';
import { mountVisual, type VisualHandle } from './visuals';
import { Ears, Voice } from './speech';
import { get, post } from './api';
import { phrase } from './phrases';

export type Panel = 'attendance' | 'question' | 'follow' | 'quiz' | 'summary' | null;
export type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused';

export interface UiState {
  snap: LessonSnapshot | null;
  panel: Panel;
  subtitle: string;
  subtitleChar: number;
  speaking: boolean;
  listening: boolean;
  thinking: boolean;
  transcript: { kind: 'q' | 'a'; text: string }[];
  attendance: Record<string, AttendanceStatus>;
  interim: string;
  micLive: boolean;
  questionDraft: string;
  followProgress: number;
  quiz: { picked: number | null; feedback: string };
  report: SessionReport | null;
  health: { ok: boolean; ai: string; tts: string };
  micMuted: boolean;
  voiceMuted: boolean;
  visualSection: number;
  recoveryReady: boolean;
  wakeWord: boolean;
}

export interface StartData {
  session: { id: string; startedAt: string; snapshot: LessonSnapshot | null };
  lesson: Lesson;
  resumed: boolean;
  students: { id: string; fullName: string }[];
  materials: Material[];
  avatar: AvatarConfig;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class LessonController {
  state: UiState = {
    snap: null, panel: null, subtitle: '', subtitleChar: -1, speaking: false, listening: false, thinking: false, transcript: [], attendance: {},
    interim: '', micLive: false, questionDraft: '', followProgress: 1, quiz: { picked: null, feedback: '' }, report: null,
    health: { ok: true, ai: 'offline', tts: 'browser' }, micMuted: false, voiceMuted: false, visualSection: -1, recoveryReady: false, wakeWord: false,
  };
  readonly voice = new Voice();
  readonly ears = new Ears();
  lesson!: Lesson;
  sessionId = '';
  startedAt = 0;
  students: StartData['students'] = [];
  avatarConfig!: AvatarConfig;
  private materials: Record<string, Material & { fileUrl?: string }> = {};
  private avatar: Avatar | null = null;
  private visualEl: HTMLElement | null = null;
  private visual: VisualHandle | null = null;
  private listeners = new Set<() => void>();
  private runId = 0;
  private announced: Record<number, boolean> = {};
  private history: { q: string; a: string }[] = [];
  private saveTimer: ReturnType<typeof setTimeout> | undefined;
  private followTimer: ReturnType<typeof setInterval> | undefined;
  private healthTimer: ReturnType<typeof setInterval> | undefined;
  private wake: ReturnType<Ears['create']> | null = null;
  private pendingStart: LessonSnapshot | null | undefined;
  private onToast: (msg: string, kind?: 'ok' | 'warn' | 'bad' | 'info') => void = () => {};
  setToast(fn: (msg: string, kind?: 'ok' | 'warn' | 'bad' | 'info') => void) { this.onToast = fn; }
  setVoicePref(p: { voiceURI?: string; lang?: string; volume?: number; rate?: number }) {
    if (p.lang !== undefined) this.voice.manual[p.lang] = p.voiceURI || undefined;
    if (p.volume !== undefined) this.voice.volume = p.volume;
    if (p.rate !== undefined) this.voice.rate = p.rate;
    this.set({});
  }

  // ── store plumbing for useSyncExternalStore ──
  subscribe = (fn: () => void) => { this.listeners.add(fn); return () => this.listeners.delete(fn); };
  getState = () => this.state;
  private set(patch: Partial<UiState>) {
    this.state = { ...this.state, ...patch };
    for (const l of this.listeners) l();
  }

  private get L() { return this.lesson?.language || 'uz'; }
  private P(k: Parameters<typeof phrase>[1]) { return phrase(this.L, k); }
  private alive(id: number) { return id === this.runId; }

  // ── lifecycle ──
  load(d: StartData, health: UiState['health']) {
    this.lesson = d.lesson;
    this.sessionId = d.session.id;
    this.startedAt = Date.parse(d.session.startedAt);
    this.students = d.students;
    this.avatarConfig = d.avatar;
    this.materials = Object.fromEntries(d.materials.map((m) => [m.id, { ...m, fileUrl: m.hasFile ? `/api/files/${m.id}` : undefined }]));
    this.voice.serverTts = health.tts === 'neural';
    this.set({ health });
    this.pendingStart = d.resumed ? d.session.snapshot : null;
    this.healthTimer = setInterval(() => void this.pingHealth(), 15000);
    window.addEventListener('offline', this.onOffline);
  }

  attachAvatar(a: Avatar | null) {
    this.avatar = a;
    if (a && this.pendingStart !== undefined) {
      const saved = this.pendingStart;
      this.pendingStart = undefined;
      void this.begin(saved);
    }
  }

  attachVisual(el: HTMLElement | null) {
    this.visualEl = el;
    if (el && this.lesson) { this.state.visualSection = -1; this.showSection(this.state.snap?.position.section ?? 0); }
  }

  destroy() {
    this.runId++;
    this.voice.cancel();
    this.ears.stop();
    this.stopWake();
    clearInterval(this.followTimer);
    clearInterval(this.healthTimer);
    clearTimeout(this.saveTimer);
    this.visual?.destroy();
    window.removeEventListener('offline', this.onOffline);
  }

  private async begin(saved: LessonSnapshot | null) {
    if (saved && saved.state !== S.READY && saved.state !== S.COMPLETED) {
      // Page reload or crash: restore exactly where we were (spec §14).
      this.set({ snap: saved });
      for (let i = 0; i <= saved.position.section; i++) this.announced[i] = true;
      await this.loadAttendance();
      this.showSection(saved.position.section);
      if (isActive(saved.state)) this.dispatch('CONNECTION_LOST');
      this.onToast('Avvalgi dars holati tiklandi. Davom ettirish uchun tugmani bosing.', 'warn');
      return;
    }
    this.set({ snap: createSnapshot(this.lesson) });
    this.showSection(0);
    this.dispatch('START');
  }

  dispatch(ev: LessonEvent | LessonEvent['type']) {
    const snap = this.state.snap;
    if (!snap) return false;
    const event = (typeof ev === 'string' ? { type: ev } : ev) as LessonEvent;
    const r = transition(snap, event as Parameters<typeof transition>[1]);
    if (!r.changed) { console.debug('[lesson] ignored', event.type, '—', r.reason); return false; }
    const prev = snap.state;
    this.set({ snap: r.snapshot });
    this.scheduleSave();
    if (prev !== r.snapshot.state) void this.onEnter(r.snapshot.state, prev);
    return true;
  }

  private scheduleSave() {
    clearTimeout(this.saveTimer);
    const snap = this.state.snap!;
    this.saveTimer = setTimeout(async () => {
      if (snap.state === S.COMPLETED) return; // completion is saved by the complete call
      try { await post(`sessions/${this.sessionId}/state`, { snapshot: snap }); } catch (e) {
        if ((e as { status?: number }).status === 0 && isActive(this.state.snap!.state)) this.dispatch('CONNECTION_LOST');
      }
    }, 400);
  }

  private async onEnter(state: LessonSnapshot['state'], prev: LessonSnapshot['state']) {
    const id = ++this.runId;
    this.voice.cancel();
    this.ears.stop();
    this.stopWake();
    clearInterval(this.followTimer);
    const keepPanel = state === S.PAUSED_BY_TEACHER || state === S.RECOVERY;
    this.set({
      panel: keepPanel ? this.state.panel : null, thinking: false,
      listening: state === S.LISTENING_FOR_QUESTION || state === S.CHECKING_FOLLOW_UP,
    });
    const back = prev === S.PAUSED_BY_TEACHER || prev === S.RECOVERY;
    const fromQuestion = prev === S.CHECKING_FOLLOW_UP || prev === S.LISTENING_FOR_QUESTION;

    switch (state) {
      case S.CHECKING_ATTENDANCE:
        await this.loadAttendance();
        this.set({ panel: 'attendance' });
        if (!back) {
          this.avatar?.react('smile');
          if (await this.say(this.lesson.greeting, id)) await this.say(this.P('attendance'), id);
        }
        break;
      case S.TEACHING:
        if (back) await this.say(this.P('resumed'), id);
        else if (fromQuestion) await this.say(this.P('resume'), id);
        if (this.alive(id)) void this.runTeaching(id);
        break;
      case S.LISTENING_FOR_QUESTION:
        this.set({ panel: 'question', questionDraft: '', interim: '' });
        this.avatar?.setMood('listening');
        if (await this.say(this.P('listening'), id, 'listening')) void this.listenForQuestion(id);
        break;
      case S.ANSWERING:
        void this.answer(id, this.state.snap!.pendingQuestion ?? '');
        break;
      case S.CHECKING_FOLLOW_UP:
        this.set({ panel: 'follow', followProgress: 1 });
        this.avatar?.setMood('listening');
        if (await this.say(this.P('more'), id, 'listening')) this.followUpCountdown(id);
        break;
      case S.KNOWLEDGE_CHECK:
        if (prev === S.TEACHING) { this.avatar?.react('smile'); await this.say(this.P('quizIntro'), id); }
        else if (fromQuestion || back) await this.say(this.P('resume'), id);
        if (this.alive(id)) void this.showQuiz(id);
        break;
      case S.PAUSED_BY_TEACHER:
        this.avatar?.setMood('idle');
        this.set({ subtitle: '' });
        break;
      case S.RECOVERY:
        this.avatar?.setMood('thinking');
        void this.recoveryLoop(id);
        break;
      case S.COMPLETED:
        void this.complete(id);
        break;
      default:
    }
  }

  // ── speaking ──
  async speak(text: string, mood?: Parameters<Avatar['setMood']>[0]) {
    const a = this.avatar;
    this.set({ subtitle: text, subtitleChar: -1, speaking: true });
    a?.speak(text, 13 * this.voice.rate);
    let raf = 0;
    let lastChar = -1;
    const follow = () => {
      if (a?.speech) {
        const el = a.speechTime();
        const ct = a.speech.visemes.charTime;
        let ci = 0;
        while (ci < ct.length - 1 && ct[ci + 1] <= el) ci++;
        if (ci !== lastChar) { lastChar = ci; this.set({ subtitleChar: ci }); }
      }
      raf = requestAnimationFrame(follow);
    };
    raf = requestAnimationFrame(follow);
    const res = await this.voice.speak(text, {
      lang: this.L, gender: this.avatarConfig?.voiceGender,
      hooks: {
        onStart: () => { if (a?.speech && !a.speech.audio) a.speech.start = performance.now(); },
        onBoundary: (ci) => a?.syncTo(ci),
        onAudio: (el, analyser) => a?.speakAudio(text, el, analyser),
      },
    });
    cancelAnimationFrame(raf);
    a?.stopSpeaking();
    if (mood) a?.setMood(mood);
    this.set({ speaking: false, subtitleChar: Infinity });
    return res;
  }

  private async say(text: string, id: number, mood?: Parameters<Avatar['setMood']>[0]) {
    if (!this.alive(id) || !text) return this.alive(id);
    const { completed } = await this.speak(text, mood);
    if (completed && this.alive(id)) await sleep(250);
    return completed && this.alive(id);
  }

  private addTranscript(kind: 'q' | 'a', text: string) {
    this.set({ transcript: [...this.state.transcript.slice(-40), { kind, text }] });
  }

  // ── teaching ──
  private async runTeaching(id: number) {
    while (this.alive(id) && this.state.snap!.state === S.TEACHING) {
      const pos = this.state.snap!.position;
      const sec = this.lesson.sections[pos.section];
      this.showSection(pos.section);
      if (pos.sentence === 0 && !this.announced[pos.section]) {
        this.announced[pos.section] = true;
        this.avatar?.react('brows');
        if (!(await this.say(`${pos.section === 0 ? '' : this.P('nextSection') + ' '}${sec.title}.`, id))) return;
      }
      if (pos.sentence >= sec.sentences.length) { this.dispatch('SECTION_DONE'); continue; }
      const sentence = sec.sentences[pos.sentence];
      this.visual?.focus(sentence, pos.sentence);
      this.addTranscript('a', sentence);
      if (!(await this.say(sentence, id))) return;
      if (/!/.test(sentence)) this.avatar?.react('smile');
      this.dispatch({ type: 'PROGRESS', sentence: pos.sentence + 1 });
      this.startWake();
    }
  }

  private showSection(i: number) {
    const sec = this.lesson?.sections[i];
    if (!sec || !this.visualEl) return;
    if (this.state.visualSection !== i) {
      this.visual?.destroy();
      this.visual = mountVisual(this.visualEl, sec.materialId ? this.materials[sec.materialId] : undefined, sec);
      this.set({ visualSection: i });
    }
  }
  materialFor(i: number) {
    const id = this.lesson?.sections[i]?.materialId;
    return id ? this.materials[id] : undefined;
  }

  // ── attendance ──
  private async loadAttendance() {
    try {
      const { items } = await get<{ items: { studentId: string; status: AttendanceStatus }[] }>(`attendance?sessionId=${this.sessionId}&pageSize=200`);
      this.set({ attendance: Object.fromEntries(items.map((a) => [a.studentId, a.status])) });
    } catch { /* keep local marks */ }
  }
  mark(studentId: string, status: AttendanceStatus) { this.set({ attendance: { ...this.state.attendance, [studentId]: status } }); }
  markAllPresent() {
    const a = { ...this.state.attendance };
    for (const s of this.students) a[s.id] ??= 'present';
    this.set({ attendance: a });
  }
  async confirmAttendance() {
    const a = { ...this.state.attendance };
    for (const s of this.students) a[s.id] ??= 'absent';
    try {
      await post(`sessions/${this.sessionId}/attendance`, { records: this.students.map((s) => ({ studentId: s.id, status: a[s.id], method: 'manual' })) });
    } catch (e) { this.onToast('Davomat saqlanmadi: ' + (e as Error).message, 'bad'); return; }
    this.set({ attendance: a });
    this.voice.unlock();
    this.dispatch('ATTENDANCE_CONFIRMED');
  }

  // ── questions ──
  private async listenForQuestion(id: number) {
    if (this.state.micMuted || !this.ears.supported) {
      this.set({ micLive: false, interim: this.ears.supported ? 'Mikrofon o‘chirilgan — savolni yozing' : 'Brauzer ovozni tanimaydi — savolni yozing' });
      return;
    }
    this.set({ micLive: true, interim: '…' });
    const r = await this.ears.listen({ lang: this.L, onInterim: (txt) => this.set({ interim: txt }) });
    this.set({ micLive: false });
    if (!this.alive(id)) return;
    if (!r || !r.text) { this.set({ interim: 'Eshitilmadi. Qayta urinib ko‘ring yoki yozing.' }); return; }
    // Show what was recognised; ask for confirmation when recognition is unsure (spec §7).
    this.set({ questionDraft: r.text });
    if (r.confidence >= 0.7) this.submitQuestion(r.text);
    else this.set({ interim: `«${r.text}» — to‘g‘ri bo‘lsa «Yuborish» tugmasini bosing` });
  }
  retryMic() { void this.listenForQuestion(this.runId); }
  setDraft(v: string) { this.set({ questionDraft: v }); }
  submitQuestion(text: string) {
    if (!text.trim()) return;
    this.ears.stop();
    this.dispatch({ type: 'QUESTION_RECEIVED', text });
  }
  cancelQuestion() { this.ears.stop(); this.dispatch('QUESTION_CANCELLED'); }

  private async answer(id: number, question: string) {
    this.addTranscript('q', question);
    this.set({ subtitle: '❓ ' + question, subtitleChar: Infinity, thinking: true });
    this.avatar?.setMood('thinking');
    const slow = setTimeout(() => { if (this.alive(id)) void this.speak(this.P('thinking'), 'thinking'); }, 2500);
    const snap = this.state.snap!;
    let res: AnswerResult;
    try {
      res = await post<AnswerResult>('ai/answer', { lessonId: this.lesson.id, sectionIndex: snap.resume?.position.section ?? snap.position.section, question, history: this.history.slice(-4) });
    } catch {
      res = { answer: this.P('answerError'), escalated: true, confidence: 0, source: 'error' };
      this.set({ health: { ...this.state.health, ok: false } });
    }
    clearTimeout(slow);
    this.set({ thinking: false });
    if (!this.alive(id)) return;
    this.voice.cancel();
    this.history.push({ q: question, a: res.answer });
    post(`sessions/${this.sessionId}/questions`, { text: question, answer: res.answer, confidence: res.confidence, source: res.source, escalated: res.escalated, section: res.section ?? null }).catch(() => {});
    if (res.section !== undefined) this.showSection(res.section);
    this.avatar?.setMood('speaking');
    this.addTranscript('a', res.answer);
    await this.say(res.answer, id);
    if (!this.alive(id)) return;
    if (res.escalated) this.onToast(`${this.P('escalated')} «${question}»`, 'warn');
    this.showSection((this.state.snap!.resume?.position ?? this.state.snap!.position).section);
    this.dispatch('ANSWER_DONE');
  }

  private followUpCountdown(id: number) {
    const total = 10000;
    const start = Date.now();
    this.followTimer = setInterval(() => {
      if (!this.alive(id)) return clearInterval(this.followTimer);
      const left = 1 - (Date.now() - start) / total;
      this.set({ followProgress: Math.max(0, left) });
      if (left <= 0) { clearInterval(this.followTimer); this.dispatch('FOLLOW_UP_TIMEOUT'); }
    }, 100);
    if (!this.state.micMuted && this.ears.supported) {
      void this.ears.listen({ lang: this.L, timeoutMs: 8000 }).then((r) => {
        if (!this.alive(id) || !r?.text) return;
        const x = r.text.toLowerCase();
        if (/(yo['‘ʻ]?q|нет|\bno\b|davom)/.test(x)) this.dispatch('NO_MORE_QUESTIONS');
        else if (/(\bha\b|\bbor\b|да|есть|yes)/.test(x)) this.dispatch('QUESTION_REQUESTED');
      });
    }
  }

  // Optional wake word while teaching ("Ustoz", "Учитель", "Teacher").
  setWakeWord(on: boolean) { this.set({ wakeWord: on }); if (on) this.startWake(); else this.stopWake(); }
  private startWake() {
    if (!this.state.wakeWord || this.state.micMuted || !this.ears.supported || this.wake || this.state.snap?.state !== S.TEACHING) return;
    const r = this.ears.create(this.L);
    r.continuous = true;
    r.interimResults = true;
    r.onresult = (e) => {
      const txt = Array.from(e.results).map((x) => x[0].transcript).join(' ').toLowerCase();
      if (/ustoz|учитель|teacher|savolim bor|у меня вопрос/.test(txt)) { this.stopWake(); this.dispatch('QUESTION_REQUESTED'); }
    };
    r.onend = () => { this.wake = null; if (this.state.snap?.state === S.TEACHING) setTimeout(() => this.startWake(), 300); };
    try { r.start(); this.wake = r; } catch { this.wake = null; }
  }
  private stopWake() { try { this.wake?.abort(); } catch { /* ignore */ } this.wake = null; }

  // ── knowledge check ──
  private async showQuiz(id: number) {
    const q = this.lesson.quiz[this.state.snap!.position.quiz];
    if (!q) return;
    this.set({ panel: 'quiz', quiz: { picked: null, feedback: '' } });
    await this.say(q.q, id);
  }
  async answerQuiz(k: number) {
    const snap = this.state.snap!;
    const i = snap.position.quiz;
    const q = this.lesson.quiz[i];
    if (snap.state !== S.KNOWLEDGE_CHECK || this.state.quiz.picked !== null || !q) return;
    const id = ++this.runId;
    this.voice.cancel();
    const correct = k === q.answer;
    const feedback = `${correct ? this.P('correct') : this.P('wrong')} ${q.explain || ''}`.trim();
    this.set({ quiz: { picked: k, feedback } });
    post(`sessions/${this.sessionId}/results`, { quizIndex: i, question: q.q, answer: q.options[k], correct, checkType: 'class_quiz' }).catch(() => this.onToast('Natija saqlanmadi', 'bad'));
    if (correct) this.avatar?.setMood('happy');
    await this.say(feedback, id);
    this.avatar?.setMood('idle');
    if (!this.alive(id)) return;
    this.dispatch('QUIZ_ANSWERED');
    if (this.state.snap!.state === S.KNOWLEDGE_CHECK) void this.showQuiz(id);
  }

  // ── completion ──
  private async complete(id: number) {
    this.stopWake();
    let rep: SessionReport;
    try { rep = await post<SessionReport>(`sessions/${this.sessionId}/complete`, { snapshot: this.state.snap }); } catch (e) { this.onToast('Hisobot saqlanmadi: ' + (e as Error).message, 'bad'); return; }
    this.set({ report: rep, panel: 'summary' });
    this.avatar?.setMood('happy');
    const scoreLine = rep.score != null ? ` ${this.P('summaryScore')} ${rep.score} ${this.P('percent')}.` : '';
    await this.say(this.P('bye') + scoreLine, id);
    this.avatar?.setMood('idle');
  }

  // ── teacher controls ──
  control(act: 'pause' | 'resume' | 'ask' | 'next' | 'repeat' | 'voice' | 'mic' | 'end') {
    this.voice.unlock();
    const st = this.state.snap?.state;
    if (act === 'pause') this.dispatch('PAUSE');
    if (act === 'resume') this.dispatch('RESUME');
    if (act === 'ask') this.dispatch('QUESTION_REQUESTED');
    if (act === 'end') this.dispatch('END');
    if (act === 'next') {
      this.runId++;
      this.voice.cancel();
      if (this.dispatch('NEXT_SECTION') && this.state.snap!.state === S.TEACHING) void this.runTeaching(this.runId);
    }
    if (act === 'repeat') {
      const id = ++this.runId;
      this.voice.cancel();
      if (st === S.TEACHING) void this.runTeaching(id);
      if (st === S.KNOWLEDGE_CHECK && this.state.quiz.picked === null) void this.showQuiz(id);
    }
    if (act === 'voice') {
      this.voice.muted = !this.voice.muted;
      if (this.voice.muted) this.voice.synth?.cancel();
      this.onToast(this.voice.muted ? 'Ovozsiz rejim: dars subtitrlar bilan davom etadi' : 'Ovoz yoqildi', 'ok');
      this.set({ voiceMuted: this.voice.muted });
    }
    if (act === 'mic') {
      const micMuted = !this.state.micMuted;
      if (micMuted) { this.ears.stop(); this.stopWake(); }
      this.set({ micMuted });
    }
  }

  // ── reliability ──
  private onOffline = () => { if (this.state.snap && isActive(this.state.snap.state)) this.dispatch('CONNECTION_LOST'); };
  private async pingHealth() {
    try {
      const h = await get<{ ai: string; tts: string }>('health');
      this.set({ health: { ok: true, ai: h.ai, tts: h.tts } });
    } catch {
      this.set({ health: { ...this.state.health, ok: false } });
      if (this.state.snap && isActive(this.state.snap.state)) this.dispatch('CONNECTION_LOST');
    }
  }
  private async recoveryLoop(id: number) {
    while (this.alive(id) && this.state.snap?.state === S.RECOVERY) {
      const ok = navigator.onLine && (await get('health').then(() => true, () => false));
      this.set({ recoveryReady: ok });
      await sleep(2500);
    }
  }
  async recover() {
    const ok = navigator.onLine && (await get('health').then(() => true, () => false));
    if (!ok) { this.onToast('Aloqa hali tiklanmadi', 'warn'); return; }
    this.voice.unlock();
    await post(`sessions/${this.sessionId}/state`, { snapshot: this.state.snap }).catch(() => {});
    this.dispatch('RECOVERED');
  }
}
