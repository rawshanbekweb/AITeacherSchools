'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { post } from '@/lib/client/api';
import { Logo } from '@/components/ui/Logo';

const DEMO = {
  classroom: [['teacher', 'Teacher#2026', 'Maktab o‘qituvchisi'], ['bogcha', 'Teacher#2026', 'Bog‘cha tarbiyachisi'], ['professor', 'Teacher#2026', 'Universitet']],
  admin: [['superadmin', 'Admin#2026', 'Super Admin'], ['maktab.admin', 'Admin#2026', 'Muassasa admini'], ['director', 'Director#2026', 'Direktor'], ['teacher', 'Teacher#2026', 'O‘qituvchi'], ['tech', 'Tech#2026', 'Texnik xodim']],
};

export function LoginForm({ portal, next }: { portal: 'admin' | 'classroom'; next?: string }) {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const target = next && next.startsWith('/') && !next.startsWith('//') ? next : portal === 'admin' ? '/admin' : '/classroom';

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await post('auth/login', { username, password, portal });
      router.replace(target);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <main className="dark-surface grid min-h-screen place-items-center bg-[radial-gradient(1200px_600px_at_20%_10%,#24336b_0,transparent_60%),radial-gradient(900px_500px_at_90%_90%,#4a2a17_0,transparent_60%)] p-4">
      <form onSubmit={submit} className="animate-fade-up grid w-full max-w-md gap-5 rounded-3xl border border-white/10 bg-ink-800/80 p-8 shadow-2xl backdrop-blur">
        <Logo dark subtitle={portal === 'admin' ? 'Admin panel' : 'Classroom'} />
        <div>
          <h1 className="text-2xl font-bold text-white">{portal === 'admin' ? 'Boshqaruv paneliga kirish' : 'Darsni boshlash uchun kiring'}</h1>
          <p className="mt-1 text-sm text-slate-400">Login va parolingizni kiriting</p>
        </div>
        <label className="label">Login<input className="input" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} required /></label>
        <label className="label">Parol<input className="input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required /></label>
        {error && <p role="alert" className="rounded-xl border border-red-500/30 bg-red-950/50 px-3 py-2 text-sm text-red-200">{error}</p>}
        <button className="btn btn-primary btn-lg" disabled={busy}>{busy && <Loader2 className="animate-spin" size={18} />}Kirish</button>
        <details className="text-sm text-slate-400">
          <summary className="cursor-pointer select-none">Demo hisoblar</summary>
          <div className="mt-3 grid gap-1">
            {DEMO[portal].map(([u, p, r]) => (
              <button type="button" key={u} onClick={() => { setUsername(u); setPassword(p); }} className="flex items-center justify-between rounded-lg px-2 py-1.5 text-left hover:bg-white/5">
                <span className="font-mono text-slate-200">{u}</span><span className="text-xs">{r}</span>
              </button>
            ))}
          </div>
        </details>
      </form>
    </main>
  );
}
