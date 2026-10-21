'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Clapperboard, Eraser, ImagePlus, Loader2, MessageCircle, Pipette, RotateCcw, Save, ScanFace, Sparkles, Trash2, Video } from 'lucide-react';
import { get, put } from '@/lib/client/api';
import { basePose, type Avatar } from '@/lib/client/avatar';
import type { AvatarConfig, AvatarPose, GestureKind, Landmarks } from '@/lib/core/types';
import { GESTURE_KINDS } from '@/lib/core/types';
import { DEFAULT_AVATAR } from '@/lib/core/avatar-default';
import { AvatarCanvas } from '@/components/AvatarCanvas';
import { useToast } from '@/components/ui/Toast';
import { PageHeader } from './PageHeader';
import { useMe } from './me';

export const KIND_LABEL: Record<GestureKind, string> = {
  idle: 'Tinch holat', welcome: 'Salomlashish', explain: 'Tushuntirish (qo‘llar)', point: 'Doskaga ko‘rsatish', think: 'O‘ylash', praise: 'Maqtash', listen: 'Tinglash',
};
type PointKey = 'eyeL' | 'eyeR' | 'mouthL' | 'mouthC' | 'mouthR' | 'chin' | 'neck';
const POINTS: [PointKey, string, string][] = [
  ['eyeL', 'Ko‘z 1', 'Chap ko‘z markazi'], ['eyeR', 'Ko‘z 2', 'O‘ng ko‘z markazi'], ['mouthL', 'Og‘iz 1', 'Og‘iz chap burchagi'], ['mouthC', 'Lab', 'Lablar tutashgan joy (o‘rtasi)'],
  ['mouthR', 'Og‘iz 2', 'Og‘iz o‘ng burchagi'], ['chin', 'Iyak', 'Iyak pasti'], ['neck', 'Bo‘yin', 'Bo‘yin (bosh aylanish nuqtasi)'],
];
const src = (s: string) => (s.startsWith('data:') || s.startsWith('/') ? s : '/' + s);
const uid = () => Math.random().toString(36).slice(2, 10);

/** Raw binary upload: photos and video clips are stored as files, not inside the database. */
async function uploadMedia(blob: Blob): Promise<string> {
  const r = await fetch('/api/avatar/media', { method: 'POST', headers: { 'Content-Type': blob.type }, body: blob, credentials: 'same-origin' });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || r.statusText);
  return j.url as string;
}

// Downscale large photos, keeping transparency (WebP), so classroom PCs stay fast.
async function prepareImage(file: Blob): Promise<Blob> {
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.src = url;
  await img.decode();
  const scale = Math.min(1, 2000 / img.naturalHeight);
  const c = document.createElement('canvas');
  c.width = Math.round(img.naturalWidth * scale);
  c.height = Math.round(img.naturalHeight * scale);
  c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
  URL.revokeObjectURL(url);
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('encode'))), 'image/webp', 0.92));
}

function scaledDefault(w: number, h: number): Landmarks {
  const fx = w / 1269;
  const fy = h / 2000;
  const d = DEFAULT_AVATAR.landmarks;
  const sc = (p: [number, number]): [number, number] => [Math.round(p[0] * fx), Math.round(p[1] * fy)];
  return { eyeL: sc(d.eyeL), eyeR: sc(d.eyeR), mouthL: sc(d.mouthL), mouthC: sc(d.mouthC), mouthR: sc(d.mouthR), chin: sc(d.chin), neck: sc(d.neck), eyeW: Math.round(d.eyeW * fx), eyeH: Math.round(d.eyeH * fy) };
}

async function loadEl(url: string, video: boolean): Promise<HTMLImageElement | HTMLVideoElement> {
  if (!video) {
    const img = new Image();
    img.src = src(url);
    await img.decode();
    return img;
  }
  const v = document.createElement('video');
  v.muted = true;
  v.playsInline = true;
  v.preload = 'auto';
  v.src = src(url);
  await new Promise<void>((res, rej) => { v.onloadeddata = () => res(); v.onerror = () => rej(new Error('video')); });
  return v;
}

export function AvatarStudio({ institutions }: { institutions: { id: string; name: string }[] }) {
  const me = useMe();
  const toast = useToast();
  const [instId, setInstId] = useState(me.institutionId ?? institutions[0]?.id ?? '');
  const [cfg, setCfg] = useState<AvatarConfig | null>(null);
  const [saved, setSaved] = useState<AvatarConfig | null>(null);
  const [sel, setSel] = useState('base');
  const [busy, setBusy] = useState('');
  const [progress, setProgress] = useState(0);
  const preview = useRef<Avatar | null>(null);
  const [active, setActive] = useState('');

  useEffect(() => {
    if (!instId) return;
    get<{ avatar: AvatarConfig | null }>(`avatar?institutionId=${instId}`).then(({ avatar }) => {
      const a = structuredClone(avatar ?? DEFAULT_AVATAR);
      a.poses ??= [];
      setCfg(a);
      setSaved(structuredClone(a));
      setSel('base');
    }, (e) => toast(e.message, 'bad'));
  }, [instId, toast]);

  if (!cfg) return <PageHeader title="Avatar studiyasi" description="Yuklanmoqda…" />;
  const poses = cfg.poses ?? [];
  const current: AvatarPose = sel === 'base' ? basePose(cfg) : poses.find((p) => p.id === sel) ?? basePose(cfg);
  const dirty = JSON.stringify(cfg) !== JSON.stringify(saved);

  function updatePose(patch: Partial<AvatarPose>) {
    setCfg((c) => {
      if (!c) return c;
      if (sel === 'base') return { ...c, ...(patch.src ? { image: patch.src } : {}), ...(patch.landmarks ? { landmarks: patch.landmarks } : {}) };
      return { ...c, poses: (c.poses ?? []).map((p) => (p.id === sel ? { ...p, ...patch } : p)) };
    });
  }

  async function run(label: string, fn: () => Promise<void>) {
    setBusy(label);
    setProgress(0);
    try { await fn(); } catch (e) { toast((e as Error).message || 'Xatolik', 'bad'); }
    setBusy('');
  }

  async function autoDetect(el?: HTMLImageElement | HTMLVideoElement) {
    const { detectLandmarks } = await import('@/lib/client/vision');
    const target = el ?? (await loadEl(current.src, current.media === 'video'));
    const lm = await detectLandmarks(target);
    if (!lm) throw new Error('Rasmda yuz topilmadi — nuqtalarni qo‘lda qo‘ying');
    return lm;
  }

  async function addMedia(file: File, asBase = false) {
    await run('Yuklanmoqda…', async () => {
      const video = file.type.startsWith('video/');
      if (asBase && video) throw new Error('Asosiy rasm uchun surat tanlang');
      const blob = video ? file : await prepareImage(file);
      const url = await uploadMedia(blob);
      const el = await loadEl(url, video);
      const w = el instanceof HTMLVideoElement ? el.videoWidth : el.naturalWidth;
      const h = el instanceof HTMLVideoElement ? el.videoHeight : el.naturalHeight;
      let lm = scaledDefault(w, h);
      try { lm = await autoDetect(el); } catch { toast('Yuz avtomatik topilmadi — nuqtalarni qo‘lda moslang', 'warn'); }
      if (asBase) {
        setCfg((c) => c && { ...c, image: url, landmarks: lm });
        setSel('base');
      } else {
        const pose: AvatarPose = { id: uid(), name: file.name.replace(/\.[^.]+$/, '').slice(0, 60) || 'Poza', kind: video ? 'explain' : 'explain', media: video ? 'video' : 'image', src: url, landmarks: lm, chroma: null };
        setCfg((c) => c && { ...c, poses: [...(c.poses ?? []), pose] });
        setSel(pose.id);
      }
      toast(video ? 'Klip yuklandi. Endi «Kadrlarni kuzatish» tugmasini bosing.' : 'Rasm yuklandi va yuz nuqtalari aniqlandi.', 'ok');
    });
  }

  async function save() {
    await run('Saqlanmoqda…', async () => {
      const { avatar } = await put<{ avatar: AvatarConfig }>('avatar', { institutionId: instId, avatar: cfg });
      setSaved(structuredClone(avatar));
      setCfg(structuredClone(avatar));
      toast('Avatar saqlandi — Classroom’da ishlatiladi', 'ok');
    });
  }

  const talk = () => {
    const a = preview.current;
    if (!a) return;
    const d = a.speak('Assalomu alaykum, aziz o‘quvchilar! Bugun juda qiziqarli mavzuni o‘rganamiz.', 13);
    setTimeout(() => a.stopSpeaking(), d * 1000);
  };
  const kinds = [...new Set(poses.map((p) => p.kind))];

  return (
    <>
      <PageHeader title="Avatar studiyasi" description="O‘qituvchi qiyofasi: asosiy rasm va qo‘l harakatlari (ishoralar) kutubxonasi. Har bir poza yuz bo‘yicha avtomatik moslashtiriladi va darsda mavzuga qarab ishlatiladi."
        actions={<>
          {institutions.length > 1 && <select className="input !w-auto" value={instId} onChange={(e) => setInstId(e.target.value)}>{institutions.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}</select>}
          <button className="btn" disabled={!dirty || !!busy} onClick={() => saved && setCfg(structuredClone(saved))}><RotateCcw size={16} />Bekor qilish</button>
          <button className="btn btn-primary" onClick={save} disabled={!dirty || !!busy}><Save size={16} />Saqlash</button>
        </>} />
      {busy && (
        <div className="mb-4 flex items-center gap-3 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-800">
          <Loader2 size={16} className="animate-spin" />{busy}
          {progress > 0 && <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white"><div className="h-full bg-brand-500" style={{ width: `${progress * 100}%` }} /></div>}
        </div>
      )}
      <div className="grid gap-6 xl:grid-cols-[230px_1fr_380px]">
        {/* pose library */}
        <aside className="grid content-start gap-2">
          <h2 className="text-sm font-semibold text-slate-500">Pozalar kutubxonasi</h2>
          {[basePose(cfg), ...poses].map((p) => (
            <button key={p.id} onClick={() => setSel(p.id)} className={`flex items-center gap-3 rounded-xl border p-2 text-left transition ${sel === p.id ? 'border-brand-400 bg-brand-50' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
              <span className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-lg bg-slate-100">
                {p.media === 'video' ? <Video size={18} className="text-slate-500" /> : (
                  // eslint-disable-next-line @next/next/no-img-element -- thumbnails of private media
                  <img src={src(p.src)} alt="" className="h-full w-full object-cover object-top" />
                )}
              </span>
              <span className="min-w-0">
                <b className="block truncate text-sm">{p.name}</b>
                <span className="text-xs text-slate-500">{KIND_LABEL[p.kind]}{p.media === 'video' ? (p.track ? ' · kuzatilgan' : ' · kuzatilmagan') : ''}</span>
              </span>
            </button>
          ))}
          <label className="btn mt-1 cursor-pointer"><ImagePlus size={16} />Rasm yoki video qo‘shish
            <input type="file" accept="image/png,image/jpeg,image/webp,video/mp4,video/webm,video/quicktime" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void addMedia(f); }} />
          </label>
          <details className="mt-2 rounded-xl border border-slate-200 bg-white p-3 text-xs leading-relaxed text-slate-600">
            <summary className="cursor-pointer font-semibold text-slate-700">Qanday suratga olish kerak?</summary>
            <ul className="mt-2 list-disc space-y-1 pl-4">
              <li>Kamera shtativda, kadr va yorug‘lik barcha pozalarda bir xil.</li>
              <li>Bel yoki tizzagacha, qo‘llar kadrga to‘liq sig‘sin.</li>
              <li>Og‘iz yopiq — gapirishni avatar o‘zi qiladi.</li>
              <li>Video klip 2–5 soniya: tinch holatdan boshlanib, ishora qilib, yana tinch holatga qaytsin.</li>
              <li>Fon: bir xil rangli (yashil/ko‘k) devor — xromakey bilan olib tashlanadi.</li>
              <li>Kerakli to‘plam: tinch holat (video), salomlashish, tushuntirish (2–3 xil), doskaga ko‘rsatish, o‘ylash, maqtash.</li>
            </ul>
          </details>
        </aside>

        {/* editor */}
        <PoseEditor key={current.id + current.src} pose={current} isBase={sel === 'base'} busy={!!busy}
          onChange={updatePose}
          onDelete={() => { setCfg((c) => c && { ...c, poses: (c.poses ?? []).filter((p) => p.id !== sel) }); setSel('base'); }}
          onReplaceBase={(f) => void addMedia(f, true)}
          onAuto={(el) => run('Yuz nuqtalari aniqlanmoqda…', async () => { updatePose({ landmarks: await autoDetect(el) }); toast('Nuqtalar aniqlandi', 'ok'); })}
          onTrack={(el) => run('Videodagi yuz kadrma-kadr kuzatilmoqda…', async () => {
            const { trackVideo } = await import('@/lib/client/vision');
            const track = await trackVideo(el, 15, setProgress);
            updatePose({ track, landmarks: track.frames[0] });
            toast(`${track.frames.length} kadr kuzatildi`, 'ok');
          })}
          onRemoveBg={(img) => run('Fon olib tashlanmoqda…', async () => {
            const { removeBackground } = await import('@/lib/client/vision');
            const url = await uploadMedia(await removeBackground(img));
            updatePose({ src: url });
            toast('Fon olib tashlandi', 'ok');
          })}
        />

        {/* live preview */}
        <div className="grid content-start gap-4">
          <section className="card overflow-hidden">
            <div className="flex h-[460px] items-end justify-center bg-[radial-gradient(90%_70%_at_50%_10%,#3a4f99,#121a38_60%,#0a0f22)]">
              <AvatarCanvas config={cfg} className="h-full w-auto" onReady={(a) => { preview.current = a; if (a) a.onGesture = (_k, name) => setActive(name); }} />
            </div>
            <div className="grid gap-2 p-4">
              <div className="text-xs text-slate-500">Hozir: <b className="text-slate-700">{active || 'Asosiy rasm'}</b></div>
              <div className="flex flex-wrap gap-2">
                <button className="btn btn-sm" onClick={talk}><MessageCircle size={14} />Gapirtirish</button>
                {kinds.map((k) => <button key={k} className="btn btn-sm" onClick={() => preview.current?.gesture(k, 3.5)}><Sparkles size={14} />{KIND_LABEL[k]}</button>)}
              </div>
              {!kinds.length && <p className="text-xs text-slate-500">Qo‘l harakatlari uchun chap tomondan rasm yoki video klip qo‘shing. Hozircha avatar faqat yuz, bosh va tana harakatlaridan foydalanadi.</p>}
            </div>
          </section>
          <section className="card grid gap-4 p-5">
            <h2 className="font-semibold">Xarakter</h2>
            <label className="label">Ism (ekranda ko‘rinadi)<input className="input" value={cfg.name} onChange={(e) => setCfg({ ...cfg, name: e.target.value })} /></label>
            <label className="label">Xarizma / ekspressivlik: {cfg.charisma.toFixed(2)}<input type="range" min={0} max={1} step={0.05} value={cfg.charisma} onChange={(e) => setCfg({ ...cfg, charisma: Number(e.target.value) })} /></label>
            <label className="label">Ovoz<select className="input" value={cfg.voiceGender} onChange={(e) => setCfg({ ...cfg, voiceGender: e.target.value as AvatarConfig['voiceGender'] })}><option value="male">Erkak</option><option value="female">Ayol</option></select></label>
            <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">Mashhur shaxs yuzidan foydalanish uchun uning yozma roziligi kerak. O‘z rasmingiz yoki litsenziyalangan rasmdan foydalaning.</p>
          </section>
        </div>
      </div>
    </>
  );
}

function PoseEditor({ pose, isBase, busy, onChange, onDelete, onReplaceBase, onAuto, onTrack, onRemoveBg }: {
  pose: AvatarPose; isBase: boolean; busy: boolean;
  onChange: (p: Partial<AvatarPose>) => void; onDelete: () => void; onReplaceBase: (f: File) => void;
  onAuto: (el: HTMLImageElement | HTMLVideoElement) => void; onTrack: (v: HTMLVideoElement) => void; onRemoveBg: (img: HTMLImageElement) => void;
}) {
  const imgRef = useRef<HTMLImageElement>(null);
  const vidRef = useRef<HTMLVideoElement>(null);
  const [k, setK] = useState(0);
  const [nat, setNat] = useState<[number, number]>([0, 0]);
  const video = pose.media === 'video';
  const L = pose.landmarks;

  const measure = useCallback(() => {
    const el = video ? vidRef.current : imgRef.current;
    if (!el) return;
    const w = el instanceof HTMLVideoElement ? el.videoWidth : el.naturalWidth;
    const h = el instanceof HTMLVideoElement ? el.videoHeight : el.naturalHeight;
    if (w) { setK(el.clientWidth / w); setNat([w, h]); }
  }, [video]);
  useEffect(() => {
    const el = video ? vidRef.current : imgRef.current;
    if (!el) return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [measure, video]);

  const setLm = (patch: Partial<Landmarks>) => onChange({ landmarks: { ...L, ...patch } });
  function drag(key: PointKey) {
    return (e: React.PointerEvent<HTMLDivElement>) => {
      const el = e.currentTarget;
      el.setPointerCapture(e.pointerId);
      const box = (video ? vidRef.current : imgRef.current)!;
      const move = (ev: PointerEvent) => {
        const r = box.getBoundingClientRect();
        const kk = box.clientWidth / nat[0];
        const nx = Math.round(Math.max(0, Math.min(nat[0], (ev.clientX - r.left) / kk)));
        const ny = Math.round(Math.max(0, Math.min(nat[1], (ev.clientY - r.top) / kk)));
        setLm({ [key]: [nx, ny] } as Partial<Landmarks>);
      };
      const upFn = () => { el.removeEventListener('pointermove', move); el.removeEventListener('pointerup', upFn); };
      el.addEventListener('pointermove', move);
      el.addEventListener('pointerup', upFn);
    };
  }

  function pickKey() {
    const v = vidRef.current ?? imgRef.current;
    if (!v) return;
    const c = document.createElement('canvas');
    c.width = 4;
    c.height = 4;
    const ctx = c.getContext('2d')!;
    // sample a corner: the backdrop is what surrounds the person
    ctx.drawImage(v, 0, 0, 16, 16, 0, 0, 4, 4);
    const d = ctx.getImageData(1, 1, 1, 1).data;
    onChange({ chroma: { color: [d[0], d[1], d[2]], tolerance: pose.chroma?.tolerance ?? 0.18 } });
  }
  const hex = (c: [number, number, number]) => '#' + c.map((x) => x.toString(16).padStart(2, '0')).join('');

  return (
    <section className="card p-5">
      <div className="flex flex-wrap items-end gap-3">
        <label className="label min-w-48 flex-1">Nomi<input className="input" value={pose.name} disabled={isBase} onChange={(e) => onChange({ name: e.target.value })} /></label>
        <label className="label">Vazifasi<select className="input !w-auto" value={pose.kind} disabled={isBase} onChange={(e) => onChange({ kind: e.target.value as GestureKind })}>{GESTURE_KINDS.map((g) => <option key={g} value={g}>{KIND_LABEL[g]}</option>)}</select></label>
        {isBase
          ? <label className="btn cursor-pointer"><ImagePlus size={16} />Asosiy rasmni almashtirish<input type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) onReplaceBase(f); }} /></label>
          : <button className="btn btn-danger" onClick={() => confirm('Poza o‘chirilsinmi?') && onDelete()}><Trash2 size={16} />O‘chirish</button>}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <button className="btn btn-sm" disabled={busy} onClick={() => { const el = video ? vidRef.current : imgRef.current; if (el) onAuto(el); }}><ScanFace size={14} />Yuz nuqtalarini avtomatik aniqlash</button>
        {video && <button className="btn btn-sm btn-primary" disabled={busy} onClick={() => vidRef.current && onTrack(vidRef.current)}><Clapperboard size={14} />Kadrlarni kuzatish{pose.track ? ' (qayta)' : ''}</button>}
        {!video && <button className="btn btn-sm" disabled={busy} onClick={() => imgRef.current && onRemoveBg(imgRef.current)}><Eraser size={14} />Fonni olib tashlash</button>}
      </div>
      {video && !pose.track && <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">Bu klip hali kuzatilmagan: lab sinxronizatsiyasi aniq ishlashi uchun «Kadrlarni kuzatish» tugmasini bosing.</p>}
      <div className="mt-4 max-h-[68vh] overflow-auto rounded-2xl border border-slate-200 bg-[repeating-conic-gradient(#eef2f7_0_25%,#ffffff_0_50%)] bg-[length:24px_24px]">
        <div className="relative">
          {video
            ? <video ref={vidRef} src={src(pose.src)} muted playsInline controls className="block w-full" onLoadedData={measure} />
            : (
              // eslint-disable-next-line @next/next/no-img-element -- calibration needs the raw image pixels
              <img ref={imgRef} src={src(pose.src)} alt={pose.name} className="block w-full select-none" draggable={false} onLoad={measure} />
            )}
          {k > 0 && (['eyeL', 'eyeR'] as const).map((e) => (
            <div key={e} className="pointer-events-none absolute rounded-[50%] border border-dashed border-brand-600/80"
              style={{ left: L[e][0] * k - L.eyeW * 1.3 * k, top: L[e][1] * k - L.eyeH * k, width: 2.6 * L.eyeW * k, height: 2 * L.eyeH * k }} />
          ))}
          {k > 0 && POINTS.map(([key, name, hint]) => (
            <div key={key} title={hint} onPointerDown={drag(key)}
              className="absolute -mt-2.5 -ml-2.5 size-5 cursor-grab touch-none rounded-full border-2 border-white bg-brand-500 shadow-[0_0_0_3px_rgba(0,0,0,.35)]"
              style={{ left: L[key][0] * k, top: L[key][1] * k }}>
              <span className={`absolute top-[-3px] rounded-md bg-slate-900/80 px-1.5 text-[11px] whitespace-nowrap text-white ${key === 'eyeL' || key === 'mouthL' ? 'right-6' : 'left-6'}`}>{name}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="label">Ko‘z kengligi: {L.eyeW}<input type="range" min={4} max={200} value={L.eyeW} onChange={(e) => setLm({ eyeW: Number(e.target.value) })} /></label>
        <label className="label">Ko‘z balandligi: {L.eyeH}<input type="range" min={3} max={100} value={L.eyeH} onChange={(e) => setLm({ eyeH: Number(e.target.value) })} /></label>
      </div>
      {!isBase && (
        <div className="mt-4 grid gap-3 rounded-xl border border-slate-200 p-4">
          <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" checked={!!pose.chroma} onChange={(e) => (e.target.checked ? pickKey() : onChange({ chroma: null }))} />Xromakey (bir xil rangli fonni olib tashlash)</label>
          {pose.chroma && (
            <div className="flex flex-wrap items-center gap-3">
              <input type="color" value={hex(pose.chroma.color)} onChange={(e) => { const v = e.target.value; onChange({ chroma: { color: [parseInt(v.slice(1, 3), 16), parseInt(v.slice(3, 5), 16), parseInt(v.slice(5, 7), 16)], tolerance: pose.chroma!.tolerance } }); }} />
              <button className="btn btn-sm" onClick={pickKey}><Pipette size={14} />Fon rangini olish</button>
              <label className="label flex-1">Sezgirlik: {pose.chroma.tolerance.toFixed(2)}<input type="range" min={0.02} max={0.6} step={0.01} value={pose.chroma.tolerance} onChange={(e) => onChange({ chroma: { ...pose.chroma!, tolerance: Number(e.target.value) } })} /></label>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
