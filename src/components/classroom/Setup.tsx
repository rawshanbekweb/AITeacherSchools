'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Camera, LogOut, Mic, Play, RotateCcw, Volume2 } from 'lucide-react';
import { get, post } from '@/lib/client/api';
import { useI18n, type UiLang } from '@/lib/client/i18n';
import { checkDevices, Voice } from '@/lib/client/speech';
import type { Avatar } from '@/lib/client/avatar';
import type { StartData } from '@/lib/client/lesson-controller';
import type { AvatarConfig, Lesson, Material, SessionUser } from '@/lib/core/types';
import { AvatarCanvas } from '@/components/AvatarCanvas';
import { useToast } from '@/components/ui/Toast';

interface Options {
  institutions: { id: string; name: string; type: string; languages: string[] }[];
  groups: { id: string; name: string; institutionId: string }[];
  lessons: { id: string; title: string; institutionId: string; language: string; sections: number; groupIds: string[] }[];
  activeSessions: { id: string; lessonId: string; groupId: string }[];
}
type Health = { ok: boolean; ai: string; tts: string };
const ROLE: Record<string, string> = { super_admin: 'Super Admin', inst_admin: 'Muassasa admini', director: 'Direktor', teacher: 'O‘qituvchi' };

export function Setup({ user, onStart }: { user: SessionUser; onStart: (d: StartData, h: Health, type: string) => void }) {
  const { t, lang, setLang } = useI18n();
  const toast = useToast();
  const router = useRouter();
  const [opts, setOpts] = useState<Options | null>(null);
  const [instId, setInstId] = useState('');
  const [groupId, setGroupId] = useState('');
  const [lessonId, setLessonId] = useState('');
  const [avatar, setAvatar] = useState<AvatarConfig | null>(null);
  const [health, setHealth] = useState<Health | null>(null);
  const [devices, setDevices] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [cam, setCam] = useState<MediaStream | null>(null);
  const preview = useRef<Avatar | null>(null);
  const voice = useMemo(() => new Voice(), []);
  const video = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    get<Options>('classroom').then((o) => { setOpts(o); setInstId(o.institutions[0]?.id ?? ''); }, (e) => setError(e.message));
    get<Health>('health').then((h) => { setHealth({ ...h, ok: true }); voice.serverTts = h.tts === 'neural'; }, () => setHealth({ ok: false, ai: 'down', tts: 'browser' }));
    checkDevices().then(setDevices);
  }, [voice]);

  useEffect(() => {
    if (!instId) return;
    get<{ avatar: AvatarConfig }>('avatar?institutionId=' + instId).then((r) => setAvatar(r.avatar), () => {});
  }, [instId]);

  const groups = useMemo(() => opts?.groups.filter((g) => g.institutionId === instId) ?? [], [opts, instId]);
  const effGroup = groups.some((g) => g.id === groupId) ? groupId : groups[0]?.id ?? '';
  const lessons = useMemo(() => opts?.lessons.filter((l) => l.groupIds.includes(effGroup)) ?? [], [opts, effGroup]);
  const effLesson = lessons.some((l) => l.id === lessonId) ? lessonId : lessons[0]?.id ?? '';
  const active = opts?.activeSessions.find((s) => s.groupId === effGroup);
  const lessonLang = lessons.find((l) => l.id === effLesson)?.language ?? 'uz';
  const inst = opts?.institutions.find((i) => i.id === instId);
  const voiceInfo = voice.describe(lessonLang, avatar?.voiceGender);

  const testVoice = useCallback(async () => {
    voice.unlock();
    const text = lessonLang === 'ru' ? 'Здравствуйте! Я ваш виртуальный преподаватель.' : lessonLang === 'en' ? 'Hello! I am your virtual teacher.' : 'Assalomu alaykum! Men sizning virtual ustozingizman.';
    const a = preview.current;
    a?.speak(text);
    await voice.speak(text, { lang: lessonLang, gender: avatar?.voiceGender, hooks: { onBoundary: (ci) => a?.syncTo(ci), onAudio: (el, an) => a?.speakAudio(text, el, an) } });
    a?.stopSpeaking();
  }, [voice, lessonLang, avatar]);

  async function testMic() {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: true });
      s.getTracks().forEach((tr) => tr.stop());
      toast('Mikrofon ishlayapti ✓', 'ok');
    } catch (e) { toast('Mikrofonga ruxsat yo‘q: ' + (e as Error).message, 'bad'); }
    setDevices(await checkDevices());
  }
  async function toggleCam() {
    if (cam) { cam.getTracks().forEach((tr) => tr.stop()); setCam(null); return; }
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: true });
      setCam(s);
      setTimeout(() => { if (video.current) { video.current.srcObject = s; void video.current.play(); } });
      toast('Kamera faol (yozib olinmaydi).', 'ok');
    } catch (e) { toast('Kameraga ruxsat yo‘q: ' + (e as Error).message, 'bad'); }
    setDevices(await checkDevices());
  }

  async function start() {
    if (!effLesson || !avatar) return;
    setBusy(true);
    setError('');
    voice.unlock();
    cam?.getTracks().forEach((tr) => tr.stop());
    try {
      const { session, lesson, resumed } = await post<{ session: StartData['session']; lesson: Lesson; resumed: boolean }>('sessions/start', { lessonId: effLesson, groupId: effGroup });
      const [{ items: students }, { items: materials }] = await Promise.all([
        get<{ items: { id: string; fullName: string; status: string }[] }>(`students?groupId=${effGroup}&pageSize=200`),
        get<{ items: Material[] }>(`materials?pageSize=200`),
      ]);
      onStart({ session, lesson, resumed, students: students.filter((s) => s.status === 'active'), materials, avatar }, health ?? { ok: true, ai: 'offline', tts: 'browser' }, inst?.type ?? 'school');
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  async function logout() {
    await post('auth/logout').catch(() => {});
    router.replace('/login');
  }

  const dev = (name: string, st: string | undefined, okText: string) => {
    const [cls, txt] = st === 'available' ? ['ok', okText] : st === 'missing' ? ['bad', 'topilmadi'] : ['warn', 'ruxsat kerak'];
    return <span className={`ind ${cls}`}><i />{name}: {txt}</span>;
  };

  return (
    <main className="grid min-h-dvh place-items-center bg-[radial-gradient(1200px_700px_at_15%_0%,#24336b_0,transparent_60%),radial-gradient(900px_600px_at_100%_100%,#3d2412_0,transparent_60%)] p-4">
      <div className="animate-fade-up grid w-full max-w-6xl overflow-hidden rounded-[28px] border border-white/10 bg-ink-800/75 shadow-2xl lg:grid-cols-[1fr_1.1fr]">
        <div className="relative flex h-[380px] items-end justify-center overflow-hidden bg-[radial-gradient(90%_70%_at_50%_10%,#3a4f99,#121a38_60%,#0a0f22)] lg:h-auto lg:min-h-[600px]">
          {avatar && <AvatarCanvas config={avatar} className="setup-avatar" onReady={(a) => { preview.current = a; }} />}
          {avatar && <div className="absolute bottom-5 left-5 rounded-md border-l-4 border-brand-400 bg-ink-950/70 px-3 py-2"><b className="block text-white">{avatar.name}</b><span className="text-xs text-slate-400">{inst?.name}</span></div>}
        </div>
        <div className="grid content-start gap-4 p-6 sm:p-8">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-3xl font-bold text-white">{t('chooseLesson')}</h1>
              <p className="mt-1 text-sm text-slate-400">{user.fullName} · {user.institutionName ?? 'Platforma'} · {ROLE[user.role] ?? user.role}</p>
            </div>
            <div className="flex items-center gap-2">
              <select aria-label="Interfeys tili" className="input !min-h-9 !w-auto !py-0" value={lang} onChange={(e) => setLang(e.target.value as UiLang)}>
                <option value="uz">UZ</option><option value="ru">RU</option><option value="en">EN</option>
              </select>
              <button className="btn btn-ghost" onClick={logout} title={t('logout')}><LogOut size={18} /></button>
            </div>
          </div>
          {(opts?.institutions.length ?? 0) > 1 && (
            <label className="label">{t('institution')}
              <select className="input" value={instId} onChange={(e) => setInstId(e.target.value)}>{opts!.institutions.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}</select>
            </label>
          )}
          <label className="label">{t('group')}
            <select className="input" value={effGroup} onChange={(e) => setGroupId(e.target.value)}>{groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</select>
          </label>
          <label className="label">{t('lesson')}
            <select className="input" value={effLesson} onChange={(e) => setLessonId(e.target.value)}>
              {lessons.length ? lessons.map((l) => <option key={l.id} value={l.id}>{l.title} · {l.language.toUpperCase()} · {l.sections} bo‘lim{active?.lessonId === l.id ? ' · ⟳ davom ettirish' : ''}</option>) : <option value="">— bu guruhga dars biriktirilmagan —</option>}
            </select>
          </label>
          <section className="grid gap-3 rounded-2xl border border-white/10 p-4">
            <h2 className="font-semibold text-white">{t('deviceCheck')}</h2>
            <div className="flex flex-wrap gap-1.5">
              {dev(t('camera'), devices.camera, 'bor')}
              {dev(t('mic'), devices.microphone, 'bor')}
              <span className={`ind ${voiceInfo.available ? 'ok' : 'warn'}`}><i />{t('speaker')}: {health?.tts === 'neural' ? 'neyron ovoz' : voiceInfo.available ? 'TTS' : 'subtitrlar'}</span>
              <span className={`ind ${health?.ok ? 'ok' : 'bad'}`}><i />{t('network')}: {health?.ok ? 'onlayn' : 'xato'}</span>
              <span className={`ind ${health?.ok ? 'ok' : 'bad'}`}><i />{t('ai')}: {health?.ai === 'llm' ? 'Claude' : health?.ok ? 'oflayn baza' : '—'}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <button className="btn" onClick={testVoice}><Volume2 size={16} />{t('testVoice')}</button>
              <button className="btn" onClick={testMic}><Mic size={16} />{t('mic')}</button>
              <button className="btn" onClick={toggleCam}><Camera size={16} />{t('camera')}</button>
            </div>
            <p className="text-sm text-slate-400">{t('voice')}: <b className="text-slate-200">{voiceInfo.name}</b>{voiceInfo.available && !voiceInfo.native ? ' — tilga mos ovoz topilmadi, yaqin ovoz ishlatiladi (Microsoft Edge’da o‘zbekcha neyron ovozlar bor)' : ''}</p>
            {cam && <video ref={video} muted playsInline className="w-56 rounded-xl border-2 border-red-500" />}
          </section>
          {error && <p role="alert" className="rounded-xl border border-red-500/30 bg-red-950/50 px-3 py-2 text-sm text-red-200">{error}</p>}
          <button className="btn btn-primary btn-lg w-full" disabled={!effLesson || !avatar || busy} onClick={start}>
            {active ? <RotateCcw size={20} /> : <Play size={20} />} {active ? t('resumeLesson') : t('startLesson')}
          </button>
        </div>
      </div>
    </main>
  );
}
