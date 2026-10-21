'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { KeyRound, ShieldAlert, ShieldCheck, Smartphone } from 'lucide-react';
import { post } from '@/lib/client/api';
import type { SessionUser } from '@/lib/core/types';
import { ROLE_LABEL } from '@/lib/core/admin-nav';
import { useToast } from '@/components/ui/Toast';
import { PageHeader } from './PageHeader';

export function ProfileClient({ user, mustEnroll }: { user: SessionUser; mustEnroll: boolean }) {
  const toast = useToast();
  const router = useRouter();
  const [pw, setPw] = useState({ current: '', next: '', repeat: '' });
  const [pwErr, setPwErr] = useState('');
  const [setup, setSetup] = useState<{ qr: string; secret: string } | null>(null);
  const [code, setCode] = useState('');
  const [mfaErr, setMfaErr] = useState('');
  const [disablePw, setDisablePw] = useState('');
  const [busy, setBusy] = useState(false);

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwErr('');
    if (pw.next !== pw.repeat) { setPwErr('Yangi parollar mos emas'); return; }
    setBusy(true);
    try {
      await post('me/password', { current: pw.current, next: pw.next });
      setPw({ current: '', next: '', repeat: '' });
      toast('Parol almashtirildi. Boshqa qurilmalardagi seanslar yopildi.', 'ok');
    } catch (err) { setPwErr((err as Error).message); }
    setBusy(false);
  }

  async function mfa(action: 'setup' | 'enable' | 'disable') {
    setMfaErr('');
    setBusy(true);
    try {
      if (action === 'setup') setSetup(await post<{ qr: string; secret: string }>('me/mfa', { action }));
      if (action === 'enable') {
        await post('me/mfa', { action, code });
        toast('Ikki bosqichli kirish yoqildi', 'ok');
        setSetup(null);
        setCode('');
        router.refresh();
        if (mustEnroll) router.replace('/admin');
      }
      if (action === 'disable') {
        await post('me/mfa', { action, password: disablePw });
        toast('Ikki bosqichli kirish o‘chirildi', 'warn');
        setDisablePw('');
        router.refresh();
      }
    } catch (err) { setMfaErr((err as Error).message); }
    setBusy(false);
  }

  return (
    <>
      <PageHeader title="Profil va xavfsizlik" description={`${user.fullName} · ${ROLE_LABEL[user.role]}${user.institutionName ? ' · ' + user.institutionName : ''}`} />
      {mustEnroll && !user.mfaEnabled && (
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <ShieldAlert size={18} className="mt-0.5 shrink-0 text-amber-600" />
          <span><b>Administratorlar uchun ikki bosqichli kirish majburiy.</b> Davom etish uchun quyida MFA’ni yoqing.</span>
        </div>
      )}
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card p-6">
          <h2 className="flex items-center gap-2 font-semibold"><Smartphone size={18} className="text-brand-600" />Ikki bosqichli kirish (MFA)</h2>
          <p className="mt-1 text-sm text-slate-500">Kirishda paroldan tashqari telefoningizdagi autentifikator ilovasi (Google Authenticator, Microsoft Authenticator, Aegis) bergan 6 xonali kod so‘raladi.</p>
          {user.mfaEnabled ? (
            <div className="mt-5 grid gap-3">
              <p className="flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800"><ShieldCheck size={16} />MFA yoqilgan</p>
              <label className="label">O‘chirish uchun parolingizni kiriting<input className="input" type="password" value={disablePw} onChange={(e) => setDisablePw(e.target.value)} autoComplete="current-password" /></label>
              <button className="btn btn-danger w-fit" disabled={busy || !disablePw} onClick={() => mfa('disable')}>MFA’ni o‘chirish</button>
            </div>
          ) : !setup ? (
            <button className="btn btn-primary mt-5" disabled={busy} onClick={() => mfa('setup')}><ShieldCheck size={16} />MFA’ni yoqish</button>
          ) : (
            <div className="mt-5 grid gap-4 sm:grid-cols-[auto_1fr]">
              {/* eslint-disable-next-line @next/next/no-img-element -- generated QR data URL */}
              <img src={setup.qr} alt="MFA QR-kod" width={180} height={180} className="rounded-xl border border-slate-200" />
              <div className="grid content-start gap-3 text-sm">
                <ol className="list-decimal space-y-1 pl-4 text-slate-600">
                  <li>Ilovada «Hisob qo‘shish» → QR-kodni skanerlang.</li>
                  <li>Skanerlash imkoni bo‘lmasa, kalitni qo‘lda kiriting:</li>
                </ol>
                <code className="rounded-lg bg-slate-100 px-2 py-1 text-xs break-all">{setup.secret.replace(/(.{4})/g, '$1 ')}</code>
                <label className="label">Ilovadagi 6 xonali kod
                  <input className="input font-mono tracking-[.3em]" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} />
                </label>
                <button className="btn btn-primary w-fit" disabled={busy || code.length !== 6} onClick={() => mfa('enable')}>Tasdiqlash va yoqish</button>
              </div>
            </div>
          )}
          {mfaErr && <p role="alert" className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{mfaErr}</p>}
        </section>

        <section className="card p-6">
          <h2 className="flex items-center gap-2 font-semibold"><KeyRound size={18} className="text-brand-600" />Parolni almashtirish</h2>
          <form onSubmit={changePassword} className="mt-4 grid gap-3">
            <label className="label">Joriy parol<input className="input" type="password" autoComplete="current-password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} required /></label>
            <label className="label">Yangi parol (kamida 8 belgi)<input className="input" type="password" autoComplete="new-password" minLength={8} value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} required /></label>
            <label className="label">Yangi parolni takrorlang<input className="input" type="password" autoComplete="new-password" minLength={8} value={pw.repeat} onChange={(e) => setPw({ ...pw, repeat: e.target.value })} required /></label>
            {pwErr && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{pwErr}</p>}
            <button className="btn btn-primary w-fit" disabled={busy}>Saqlash</button>
          </form>
        </section>
      </div>
    </>
  );
}
