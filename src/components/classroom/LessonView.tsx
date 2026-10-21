'use client';
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { Hand, LogOut, Mic, MicOff, Pause, Play, Printer, RotateCcw, Settings, SkipForward, Square, Volume2, VolumeX } from 'lucide-react';
import { LessonController, type AttendanceStatus, type StartData, type UiState } from '@/lib/client/lesson-controller';
import { isActive, S } from '@/lib/core/lessonMachine';
import { useI18n, type UiLang } from '@/lib/client/i18n';
import { AvatarCanvas } from '@/components/AvatarCanvas';
import { useToast } from '@/components/ui/Toast';

type Health = UiState['health'];

export function LessonView({ data, health, institutionType, onExit }: { data: StartData; health: Health; institutionType: string; onExit: () => void }) {
  const toast = useToast();
  const ctl = useMemo(() => new LessonController(), []);
  const s = useSyncExternalStore(ctl.subscribe, ctl.getState, ctl.getState);
  const { t, tState } = useI18n();
  const visualRef = useRef<HTMLDivElement>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    ctl.setToast(toast);
    ctl.load(data, health);
    ctl.attachVisual(visualRef.current);
    return () => ctl.destroy();
  }, [ctl, data, health, toast]);

  const snap = s.snap;
  const st = snap?.state ?? S.READY;
  const lesson = data.lesson;

  return (
    <div className="classroom-app">
      <TopBar ctl={ctl} s={s} health={s.health} onSettings={() => setSettingsOpen(true)} onExit={onExit} stateLabel={tState(st)} />
      <main className="layout">
        <section className={`stage ${s.speaking ? 'speaking' : ''} ${s.listening ? 'listening' : ''}`} aria-label="Virtual o‘qituvchi">
          <div className="stage-bg"><i /><i /><i /><i /><i /></div>
          <div className="spotlight" />
          <div className="teacher-wrap">
            <AvatarCanvas config={data.avatar} className="teacher" onReady={(a) => ctl.attachAvatar(a)} />
            <div className="floor-shadow" />
          </div>
          <div className="listen-ring"><span /><span /><span /></div>
          <div className="lower-third"><b>{data.avatar.name}</b><span>{lesson.title} · {lesson.language.toUpperCase()}</span></div>
          <Subtitle text={s.subtitle} char={s.subtitleChar} />
          {s.thinking && <div className="thinking"><i /><i /><i /></div>}
        </section>

        <section className="board">
          <Plan ctl={ctl} s={s} />
          <div className="board-head">
            <h2>{s.visualSection >= 0 ? `${s.visualSection + 1}. ${lesson.sections[s.visualSection]?.title}` : lesson.title}</h2>
            {ctl.materialFor(s.visualSection) && <span className="badge bg-white/5 text-slate-400">📚 {ctl.materialFor(s.visualSection)!.title}</span>}
          </div>
          <div className="visual" ref={visualRef} />
          <div className="transcript">
            {s.transcript.slice(-6).map((x, i) => <div key={i} className={x.kind}>{x.kind === 'q' ? '❓ ' : ''}{x.text}</div>)}
          </div>
          {s.panel === 'attendance' && <AttendancePanel ctl={ctl} s={s} />}
          {s.panel === 'question' && <QuestionPanel ctl={ctl} s={s} samples={lesson.sampleQuestions} />}
          {s.panel === 'follow' && (
            <div className="panel compact">
              <h3>{t('moreQuestions')}</h3>
              <div className="countdown"><i style={{ transform: `scaleX(${s.followProgress})` }} /></div>
              <div className="row flex gap-3">
                <button className="btn btn-lg" onClick={() => ctl.dispatch('QUESTION_REQUESTED')}>{t('yes')}</button>
                <button className="btn btn-primary btn-lg" onClick={() => ctl.dispatch('NO_MORE_QUESTIONS')}>{t('no')}</button>
              </div>
            </div>
          )}
          {s.panel === 'quiz' && snap && <QuizPanel ctl={ctl} s={s} />}
          {s.panel === 'summary' && s.report && <SummaryPanel report={s.report} onNew={onExit} />}
        </section>
      </main>
      <Controls ctl={ctl} s={s} kids={institutionType === 'kindergarten'} />

      {st === S.PAUSED_BY_TEACHER && (
        <div className="overlay"><div><h2 className="text-2xl font-bold">{t('paused')}</h2><button className="btn btn-primary btn-lg" onClick={() => ctl.control('resume')}><Play size={20} />{t('resume')}</button></div></div>
      )}
      {st === S.RECOVERY && (
        <div className="overlay"><div><div className="spinner" /><h2 className="text-2xl font-bold">{t('recovery')}</h2><p className="muted">{t('recoveryHint')}</p><button className="btn btn-primary btn-lg" disabled={!s.recoveryReady} onClick={() => ctl.recover()}>{s.recoveryReady ? t('resumeLesson') : 'Qayta urinish…'}</button></div></div>
      )}
      <SettingsDialog ctl={ctl} s={s} open={settingsOpen} onClose={() => setSettingsOpen(false)} lessonLang={lesson.language} />
      {isActive(st) && <KeyboardShortcuts ctl={ctl} />}
    </div>
  );
}

function KeyboardShortcuts({ ctl }: { ctl: LessonController }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).matches('input, textarea, select')) return;
      if (e.code === 'Space') { e.preventDefault(); ctl.control(ctl.state.snap?.state === S.PAUSED_BY_TEACHER ? 'resume' : 'pause'); }
      if (e.key.toLowerCase() === 'q') ctl.control('ask');
      if (e.key.toLowerCase() === 'n') ctl.control('next');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [ctl]);
  return null;
}

function TopBar({ ctl, s, health, onSettings, onExit, stateLabel }: { ctl: LessonController; s: UiState; health: Health; onSettings: () => void; onExit: () => void; stateLabel: string }) {
  const { t } = useI18n();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(id); }, []);
  const secs = Math.max(0, Math.floor((now - ctl.startedAt) / 1000));
  const st = s.snap?.state;
  const listening = st === S.LISTENING_FOR_QUESTION && !s.micMuted && ctl.ears.supported;
  const v = ctl.voice.describe(ctl.lesson?.language ?? 'uz', ctl.avatarConfig?.voiceGender);
  const items: [string, string, string][] = [
    [t('mic'), s.micMuted ? 'bad' : listening ? 'live' : ctl.ears.supported ? 'ok' : 'warn', s.micMuted ? 'o‘chiq' : listening ? 'tinglayapti' : ctl.ears.supported ? 'tayyor' : 'matn'],
    [t('speaker'), s.voiceMuted ? 'warn' : v.available ? 'ok' : 'warn', s.voiceMuted ? 'ovozsiz' : health.tts === 'neural' && ctl.voice.serverTts ? 'neyron' : v.available ? 'TTS' : 'subtitr'],
    [t('network'), health.ok ? 'ok' : 'bad', health.ok ? 'onlayn' : 'oflayn'],
    [t('ai'), health.ok ? 'ok' : 'bad', health.ai === 'llm' ? 'Claude' : 'baza'],
  ];
  return (
    <header className="topbar">
      <div className="brand flex min-w-0 flex-1 items-center gap-3">
        <span className="grid size-9 place-items-center rounded-lg text-sm font-extrabold text-ink-950" style={{ background: 'conic-gradient(from 210deg,#ffb547,#ff6b6b,#6c8cff,#3ddc97,#ffb547)' }}>AI</span>
        <div className="min-w-0"><b className="block truncate">{ctl.lesson?.title}</b><small className="text-xs text-slate-400">{st === S.COMPLETED ? '' : ''}</small></div>
      </div>
      <div className="state-pill" data-s={st}>{stateLabel}</div>
      <div className="indicators">{items.map(([n, c, txt]) => <span key={n} className={`ind ${c}`} title={`${n}: ${txt}`}><i />{n}: {txt}</span>)}</div>
      <div className="top-actions">
        <span className="timer">{String(Math.floor(secs / 60)).padStart(2, '0')}:{String(secs % 60).padStart(2, '0')}</span>
        <button className="icon-btn grid place-items-center" onClick={onSettings} title="Sozlamalar" aria-label="Sozlamalar"><Settings size={18} /></button>
        <button className="icon-btn grid place-items-center" onClick={() => { if (!st || st === S.COMPLETED || confirm('Darsdan chiqasizmi? Dars holati saqlanadi.')) onExit(); }} title={t('logout')} aria-label="Chiqish"><LogOut size={18} /></button>
      </div>
    </header>
  );
}

function Subtitle({ text, char }: { text: string; char: number }) {
  const words = useMemo(() => {
    const out: { w: string; i: number }[] = [];
    let idx = 0;
    for (const part of text.split(/(\s+)/)) { if (!/^\s*$/.test(part)) out.push({ w: part, i: idx }); idx += part.length; }
    return out;
  }, [text]);
  if (!text) return <div className="subtitle" aria-live="polite" />;
  return (
    <div className="subtitle" aria-live="polite">
      <p className="line">{words.map((x, k) => <span key={k}><span className={`w ${x.i <= char ? 'on' : ''}`}>{x.w}</span> </span>)}</p>
    </div>
  );
}

function Plan({ ctl, s }: { ctl: LessonController; s: UiState }) {
  const { t } = useI18n();
  const snap = s.snap;
  if (!snap) return <div className="plan" />;
  const steps = ctl.lesson.sections.map((sec, i) => {
    const cur = i === snap.position.section && snap.state !== S.KNOWLEDGE_CHECK && snap.state !== S.COMPLETED;
    const done = snap.completedSections.includes(i);
    const n = sec.sentences.length;
    const p = done ? n : cur ? snap.position.sentence : 0;
    return { key: String(i), small: `${i + 1}-bo‘lim`, title: sec.title, cur, done, pct: (100 * p) / Math.max(1, n) };
  });
  if (ctl.lesson.quiz.length) {
    steps.push({ key: 'quiz', small: 'Yakun', title: t('quiz'), cur: snap.state === S.KNOWLEDGE_CHECK, done: snap.state === S.COMPLETED, pct: (100 * snap.position.quiz) / ctl.lesson.quiz.length });
  }
  return (
    <div className="plan">
      {steps.map((x) => (
        <div key={x.key} className={`step ${x.cur ? 'current' : ''} ${x.done ? 'done' : ''}`}>
          <small>{x.small}</small><b>{x.title}</b><i className="bar" style={{ width: `${x.pct}%` }} />
        </div>
      ))}
    </div>
  );
}

function AttendancePanel({ ctl, s }: { ctl: LessonController; s: UiState }) {
  const { t } = useI18n();
  const labels: Record<AttendanceStatus, string> = { present: t('present'), absent: t('absent'), late: t('late'), excused: t('excused') };
  const marked = ctl.students.filter((x) => s.attendance[x.id]).length;
  const present = ctl.students.filter((x) => ['present', 'late'].includes(s.attendance[x.id] ?? '')).length;
  const confirmAll = () => {
    const unmarked = ctl.students.length - marked;
    if (unmarked && !confirm(`${unmarked} nafar o‘quvchi belgilanmagan. Ular «yo‘q» deb belgilansinmi?`)) return;
    void ctl.confirmAttendance();
  };
  return (
    <div className="panel">
      <div className="panel-head"><h3>{t('attendance')}</h3><button className="btn btn-ghost" onClick={() => ctl.markAllPresent()}>{t('allPresent')}</button></div>
      <p className="hint">Qo‘lda belgilash (MVP). Yuzni avtomatik aniqlash ishlatilmaydi — kamera faqat yordamchi vosita.</p>
      <div className="att-list">
        {ctl.students.map((st) => (
          <div key={st.id} className="att">
            <span>{st.fullName}</span>
            <div className="seg">
              {(Object.keys(labels) as AttendanceStatus[]).map((v) => (
                <button key={v} type="button" data-v={v} className={s.attendance[st.id] === v ? 'on' : ''} onClick={() => ctl.mark(st.id, v)}>{labels[v]}</button>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="panel-foot"><span className="muted">Belgilangan: {marked}/{ctl.students.length} · Darsda: {present}</span><button className="btn btn-primary btn-lg" onClick={confirmAll}>{t('confirmAttendance')}</button></div>
    </div>
  );
}

function QuestionPanel({ ctl, s, samples }: { ctl: LessonController; s: UiState; samples: string[] }) {
  const { t } = useI18n();
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { if (!s.micLive) input.current?.focus(); }, [s.micLive]);
  return (
    <div className="panel">
      <h3>{t('questionPrompt')}</h3>
      <div className={`mic-live ${s.micLive ? 'on' : ''}`}><span className="dot" /><span>{s.interim || '…'}</span></div>
      <form className="q-form" onSubmit={(e) => { e.preventDefault(); ctl.submitQuestion(s.questionDraft); }}>
        <input ref={input} className="input" value={s.questionDraft} onChange={(e) => ctl.setDraft(e.target.value)} placeholder="Savolingiz…" autoComplete="off" />
        <button className="btn btn-primary">{t('send')}</button>
      </form>
      <div className="chips">{samples.map((q) => <button key={q} type="button" onClick={() => ctl.submitQuestion(q)}>{q}</button>)}</div>
      <div className="panel-foot">
        <button className="btn btn-ghost" onClick={() => ctl.cancelQuestion()}>{t('cancel')}</button>
        {ctl.ears.supported && <button className="btn" onClick={() => ctl.retryMic()}><Mic size={16} />Qayta tinglash</button>}
      </div>
    </div>
  );
}

function QuizPanel({ ctl, s }: { ctl: LessonController; s: UiState }) {
  const { t } = useI18n();
  const i = s.snap!.position.quiz;
  const q = ctl.lesson.quiz[i];
  if (!q) return null;
  return (
    <div className="panel">
      <div className="panel-head"><h3>{t('quiz')}</h3><span className="badge bg-white/5 text-slate-400">{i + 1} / {ctl.lesson.quiz.length}</span></div>
      <p className="quiz-q">{q.q}</p>
      <div className="quiz-options">
        {q.options.map((o, k) => {
          const cls = s.quiz.picked === null ? '' : k === q.answer ? 'right' : k === s.quiz.picked ? 'wrong' : '';
          return <button key={k} type="button" className={cls} onClick={() => ctl.answerQuiz(k)}><i>{'ABCDEFG'[k]}</i>{o}</button>;
        })}
      </div>
      <p className="quiz-feedback" aria-live="polite">{s.quiz.feedback}</p>
    </div>
  );
}

function SummaryPanel({ report: r, onNew }: { report: NonNullable<UiState['report']>; onNew: () => void }) {
  const { t } = useI18n();
  const present = r.attendance.filter((a) => a.status === 'present' || a.status === 'late').length;
  const esq = r.questions.filter((q) => q.escalated);
  const wrong = r.results.filter((x) => !x.correct);
  const lbl: Record<string, string> = { present: '✅ bor', late: '⏰ kechikdi', absent: '❌ yo‘q', excused: '📄 sababli', unmarked: '— belgilanmagan' };
  return (
    <div className="panel">
      <h3>{t('summary')}</h3>
      <p className="muted">{r.lesson.title} · {r.group.name} · {new Date(r.session.startedAt).toLocaleString()} · O‘qituvchi: {r.session.teacherName}</p>
      <div className="summary-grid">
        <div className="stat"><b>{present}/{r.attendance.length}</b><span>Davomat</span></div>
        <div className="stat"><b>{r.lesson.sections.filter((x) => x.done).length}/{r.lesson.sections.length}</b><span>O‘tilgan bo‘limlar</span></div>
        <div className="stat"><b>{r.score ?? '—'}{r.score != null ? '%' : ''}</b><span>Test natijasi</span></div>
        <div className="stat"><b>{r.questions.length}</b><span>Savollar ({esq.length} o‘qituvchiga)</span></div>
      </div>
      <div className="summary-cols">
        <div>
          <h4 className="font-semibold">Bo‘limlar</h4>
          <ul>{r.lesson.sections.map((x) => <li key={x.title}>{x.done ? '✅' : '⬜'} {x.title}</li>)}</ul>
          <h4 className="font-semibold">Tavsiya etilgan takrorlash</h4>
          <ul>{wrong.length ? wrong.map((x) => <li key={x.id}>{x.question}</li>) : <li>Barcha savollarga to‘g‘ri javob berildi 🎉</li>}</ul>
          {esq.length > 0 && <><h4 className="font-semibold">O‘qituvchi javob berishi kerak</h4><ul>{esq.map((q) => <li key={q.id}>{q.text}</li>)}</ul></>}
        </div>
        <div><h4 className="font-semibold">Davomat</h4><ul>{r.attendance.map((a) => <li key={a.studentId}>{a.fullName} — {lbl[a.status] ?? a.status}</li>)}</ul></div>
      </div>
      <div className="panel-foot"><button className="btn" onClick={() => window.print()}><Printer size={16} />Hisobotni chop etish</button><button className="btn btn-primary" onClick={onNew}>{t('newLesson')}</button></div>
    </div>
  );
}

function Controls({ ctl, s, kids }: { ctl: LessonController; s: UiState; kids: boolean }) {
  const { t } = useI18n();
  const st = s.snap?.state ?? S.READY;
  const paused = st === S.PAUSED_BY_TEACHER;
  const can = {
    pause: isActive(st), resume: paused, ask: ([S.TEACHING, S.KNOWLEDGE_CHECK, S.CHECKING_FOLLOW_UP] as string[]).includes(st),
    repeat: st === S.TEACHING || st === S.KNOWLEDGE_CHECK, next: st === S.TEACHING, end: st !== S.COMPLETED,
  };
  const sz = kids ? 26 : 22;
  return (
    <footer className="controls">
      {paused ? <Ctl ctl={ctl} act="resume" icon={<Play size={sz} />} label={t('resume')} /> : <Ctl ctl={ctl} act="pause" icon={<Pause size={sz} />} label={t('pause')} disabled={!can.pause} />}
      <Ctl ctl={ctl} act="ask" icon={<Hand size={sz} />} label={t('ask')} cls="accent" disabled={!can.ask} />
      <Ctl ctl={ctl} act="repeat" icon={<RotateCcw size={sz} />} label={t('repeat')} disabled={!can.repeat} />
      <Ctl ctl={ctl} act="next" icon={<SkipForward size={sz} />} label={t('next')} disabled={!can.next} />
      <Ctl ctl={ctl} act="voice" icon={s.voiceMuted ? <VolumeX size={sz} /> : <Volume2 size={sz} />} label={s.voiceMuted ? 'Ovozni yoqish' : t('stopVoice')} cls={s.voiceMuted ? 'off' : ''} />
      <Ctl ctl={ctl} act="mic" icon={s.micMuted ? <MicOff size={sz} /> : <Mic size={sz} />} label={s.micMuted ? t('unmuteMic') : t('muteMic')} cls={s.micMuted ? 'off' : ''} />
      <Ctl ctl={ctl} act="end" icon={<Square size={sz} />} label={t('end')} cls="danger" disabled={!can.end} />
    </footer>
  );
}

function Ctl({ ctl, act, icon, label, cls = '', disabled = false }: { ctl: LessonController; act: Parameters<LessonController['control']>[0]; icon: React.ReactNode; label: string; cls?: string; disabled?: boolean }) {
  return (
    <button className={`ctl ${cls}`} disabled={disabled} onClick={() => { if (act === 'end' && !confirm('Darsni yakunlaysizmi?')) return; ctl.control(act); }}>
      <span>{icon}</span><b>{label}</b>
    </button>
  );
}

function SettingsDialog({ ctl, s, open, onClose, lessonLang }: { ctl: LessonController; s: UiState; open: boolean; onClose: () => void; lessonLang: string }) {
  const { t, lang, setLang } = useI18n();
  const ref = useRef<HTMLDialogElement>(null);
  const [textSize, setTextSize] = useState(1);
  const [subs, setSubs] = useState(true);
  useEffect(() => { const d = ref.current; if (open && d && !d.open) d.showModal(); if (!open && d?.open) d.close(); }, [open]);
  useEffect(() => {
    document.documentElement.style.setProperty('--fs', String(textSize));
    document.querySelector('.classroom-root')?.setAttribute('style', `--fs:${textSize}`);
    document.querySelector('.classroom-app')?.classList.toggle('subtitles-off', !subs);
  }, [textSize, subs]);
  const voices = ctl.voice.voices;
  return (
    <dialog ref={ref} onClose={onClose} className="settings-dialog m-auto">
      <form method="dialog" className="grid gap-4">
        <h3 className="text-lg font-bold">Sozlamalar</h3>
        <label className="label">{t('voice')}
          <select className="input" value={ctl.voice.manual[lessonLang] ?? ''} onChange={(e) => ctl.setVoicePref({ lang: lessonLang, voiceURI: e.target.value })}>
            <option value="">Avtomatik{ctl.voice.serverTts ? ' (neyron server ovozi)' : ''}</option>
            {voices.map((v) => <option key={v.voiceURI} value={v.voiceURI}>{v.name} ({v.lang})</option>)}
          </select>
        </label>
        <label className="label">{t('volume')}<input type="range" min={0} max={1} step={0.05} defaultValue={ctl.voice.volume} onChange={(e) => ctl.setVoicePref({ volume: Number(e.target.value) })} /></label>
        <label className="label">Nutq tezligi<input type="range" min={0.7} max={1.3} step={0.05} defaultValue={ctl.voice.rate} onChange={(e) => ctl.setVoicePref({ rate: Number(e.target.value) })} /></label>
        <label className="label">{t('textSize')}<input type="range" min={0.8} max={1.6} step={0.1} value={textSize} onChange={(e) => setTextSize(Number(e.target.value))} /></label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={subs} onChange={(e) => setSubs(e.target.checked)} />{t('subtitles')}</label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={s.wakeWord} onChange={(e) => ctl.setWakeWord(e.target.checked)} />{t('wakeWord')}</label>
        <label className="label">Interfeys tili
          <select className="input" value={lang} onChange={(e) => setLang(e.target.value as UiLang)}><option value="uz">O‘zbekcha</option><option value="ru">Русский</option><option value="en">English</option></select>
        </label>
        <div className="flex justify-end"><button className="btn btn-primary">OK</button></div>
      </form>
    </dialog>
  );
}
