'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Ear, ImageUp, MessageCircle, RotateCcw, Save, Smile, Sparkles } from 'lucide-react';
import { get, put } from '@/lib/client/api';
import type { Avatar } from '@/lib/client/avatar';
import type { AvatarConfig, Landmarks } from '@/lib/core/types';
import { DEFAULT_AVATAR } from '@/lib/core/avatar-default';
import { AvatarCanvas } from '@/components/AvatarCanvas';
import { useToast } from '@/components/ui/Toast';
import { PageHeader } from './PageHeader';
import { useMe } from './me';

type PointKey = 'eyeL' | 'eyeR' | 'mouthL' | 'mouthC' | 'mouthR' | 'chin' | 'neck';
const POINTS: [PointKey, string, string][] = [
  ['eyeL', 'Ko‘z 1', 'Chap ko‘z markazi'], ['eyeR', 'Ko‘z 2', 'O‘ng ko‘z markazi'], ['mouthL', 'Og‘iz 1', 'Og‘iz chap burchagi'], ['mouthC', 'Lab', 'Lablar tutashgan joy (o‘rtasi)'],
  ['mouthR', 'Og‘iz 2', 'Og‘iz o‘ng burchagi'], ['chin', 'Iyak', 'Iyak pasti'], ['neck', 'Bo‘yin', 'Bo‘yin (bosh aylanish nuqtasi)'],
];
const src = (s: string) => (s.startsWith('data:') || s.startsWith('/') ? s : '/' + s);

// Downscale large photos and keep transparency (WebP), so classroom PCs stay fast.
async function prepareImage(file: File) {
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
  return { dataUrl: c.toDataURL('image/webp', 0.9), w: c.width, h: c.height };
}

export function AvatarStudio({ institutions }: { institutions: { id: string; name: string }[] }) {
  const me = useMe();
  const toast = useToast();
  const [instId, setInstId] = useState(me.institutionId ?? institutions[0]?.id ?? '');
  const [cfg, setCfg] = useState<AvatarConfig | null>(null);
  const [saved, setSaved] = useState<AvatarConfig | null>(null);
  const [busy, setBusy] = useState(false);
  const preview = useRef<Avatar | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [k, setK] = useState(0); // displayed px per natural px

  useEffect(() => {
    if (!instId) return;
    get<{ avatar: AvatarConfig | null }>(`avatar?institutionId=${instId}`).then(({ avatar }) => {
      const a = avatar ?? DEFAULT_AVATAR;
      setCfg(structuredClone(a));
      setSaved(structuredClone(a));
    }, (e) => toast(e.message, 'bad'));
  }, [instId, toast]);

  const measure = useCallback(() => { const im = imgRef.current; if (im?.naturalWidth) setK(im.clientWidth / im.naturalWidth); }, []);
  useEffect(() => {
    const im = imgRef.current;
    if (!im) return;
    const ro = new ResizeObserver(measure);
    ro.observe(im);
    return () => ro.disconnect();
  }, [measure, cfg?.image]);

  if (!cfg) return <PageHeader title="Avatar studiyasi" description="Yuklanmoqda…" />;
  const L = cfg.landmarks;
  const setLm = (patch: Partial<Landmarks>) => setCfg((c) => (c ? { ...c, landmarks: { ...c.landmarks, ...patch } } : c));

  function drag(key: PointKey) {
    return (e: React.PointerEvent<HTMLDivElement>) => {
      const el = e.currentTarget;
      el.setPointerCapture(e.pointerId);
      const im = imgRef.current!;
      const move = (ev: PointerEvent) => {
        const r = im.getBoundingClientRect();
        const kk = im.clientWidth / im.naturalWidth;
        const nx = Math.round(Math.max(0, Math.min(im.naturalWidth, (ev.clientX - r.left) / kk)));
        const ny = Math.round(Math.max(0, Math.min(im.naturalHeight, (ev.clientY - r.top) / kk)));
        setLm({ [key]: [nx, ny] } as Partial<Landmarks>);
      };
      const upFn = () => { el.removeEventListener('pointermove', move); el.removeEventListener('pointerup', upFn); };
      el.addEventListener('pointermove', move);
      el.addEventListener('pointerup', upFn);
    };
  }

  async function upload(file: File) {
    const { dataUrl, w, h } = await prepareImage(file);
    // start from proportional default landmarks; the admin fine-tunes them
    const fx = w / 1269;
    const fy = h / 2000;
    const d = DEFAULT_AVATAR.landmarks;
    const sc = (p: [number, number]): [number, number] => [Math.round(p[0] * fx), Math.round(p[1] * fy)];
    setCfg((c) => c && { ...c, image: dataUrl, landmarks: { eyeL: sc(d.eyeL), eyeR: sc(d.eyeR), mouthL: sc(d.mouthL), mouthC: sc(d.mouthC), mouthR: sc(d.mouthR), chin: sc(d.chin), neck: sc(d.neck), eyeW: Math.round(d.eyeW * fx), eyeH: Math.round(d.eyeH * fy) } });
    toast('Rasm yuklandi. Endi nuqtalarni ko‘z, og‘iz va iyakka moslang.', 'ok');
  }

  async function save() {
    setBusy(true);
    try {
      const { avatar } = await put<{ avatar: AvatarConfig }>('avatar', { institutionId: instId, avatar: cfg });
      setSaved(structuredClone(avatar));
      toast('Avatar saqlandi — Classroom’da ishlatiladi', 'ok');
    } catch (e) { toast((e as Error).message, 'bad'); }
    setBusy(false);
  }

  const talk = () => {
    const a = preview.current;
    if (!a) return;
    const d = a.speak('Assalomu alaykum, aziz o‘quvchilar! Bugun juda qiziqarli mavzuni o‘rganamiz.', 13);
    setTimeout(() => a.stopSpeaking(), d * 1000);
  };
  const mood = (m: Parameters<Avatar['setMood']>[0], ms: number) => { preview.current?.setMood(m); setTimeout(() => preview.current?.setMood('idle'), ms); };

  return (
    <>
      <PageHeader title="Avatar studiyasi" description="O‘qituvchi qiyofasi: portret rasmi, yuz nuqtalari, ovoz va xarizma. O‘zgarishlar shu muassasaning barcha darslarida qo‘llanadi."
        actions={<>
          {institutions.length > 1 && <select className="input !w-auto" value={instId} onChange={(e) => setInstId(e.target.value)}>{institutions.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}</select>}
          <button className="btn" onClick={() => saved && setCfg(structuredClone(saved))}><RotateCcw size={16} />Bekor qilish</button>
          <button className="btn btn-primary" onClick={save} disabled={busy}><Save size={16} />Saqlash</button>
        </>} />
      <div className="grid gap-6 lg:grid-cols-[1.15fr_.85fr]">
        <section className="card p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><h2 className="font-semibold">1. Rasm va yuz nuqtalari</h2><p className="mt-1 text-sm text-slate-500">Nuqtalarni surib, rasmdagi joyiga qo‘ying. Eng yaxshi natija: yuz to‘g‘riga qaragan, og‘iz yopiq, fon shaffof (PNG/WebP).</p></div>
            <label className="btn cursor-pointer"><ImageUp size={16} />Yangi rasm<input type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} /></label>
          </div>
          <div className="mt-4 max-h-[70vh] overflow-auto rounded-2xl border border-slate-200 bg-[repeating-conic-gradient(#eef2f7_0_25%,#ffffff_0_50%)] bg-[length:24px_24px]">
            <div className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element -- calibration needs the raw image pixels */}
              <img ref={imgRef} src={src(cfg.image)} alt="Avatar rasmi" className="block w-full select-none" draggable={false} onLoad={measure} />
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
            <label className="label">Ko‘z kengligi: {L.eyeW}<input type="range" min={6} max={160} value={L.eyeW} onChange={(e) => setLm({ eyeW: Number(e.target.value) })} /></label>
            <label className="label">Ko‘z balandligi: {L.eyeH}<input type="range" min={4} max={80} value={L.eyeH} onChange={(e) => setLm({ eyeH: Number(e.target.value) })} /></label>
          </div>
        </section>
        <div className="grid content-start gap-6">
          <section className="card overflow-hidden">
            <div className="flex h-[440px] items-end justify-center bg-[radial-gradient(90%_70%_at_50%_10%,#3a4f99,#121a38_60%,#0a0f22)]">
              <AvatarCanvas config={cfg} className="h-full w-auto" onReady={(a) => { preview.current = a; }} />
            </div>
            <div className="flex flex-wrap gap-2 p-4">
              <button className="btn btn-sm" onClick={talk}><MessageCircle size={14} />Gapirtirish</button>
              <button className="btn btn-sm" onClick={() => mood('happy', 2500)}><Smile size={14} />Tabassum</button>
              <button className="btn btn-sm" onClick={() => mood('listening', 3000)}><Ear size={14} />Tinglash</button>
              <button className="btn btn-sm" onClick={() => preview.current?.react('brows')}><Sparkles size={14} />Qosh</button>
            </div>
          </section>
          <section className="card grid gap-4 p-5">
            <h2 className="font-semibold">2. Xarakter</h2>
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
