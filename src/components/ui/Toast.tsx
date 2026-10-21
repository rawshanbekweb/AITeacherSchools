'use client';
import { createContext, useCallback, useContext, useState } from 'react';

type Kind = 'ok' | 'warn' | 'bad' | 'info';
interface T { id: number; msg: string; kind: Kind }
const Ctx = createContext<(msg: string, kind?: Kind) => void>(() => {});

export function ToastProvider({ children, dark = false }: { children: React.ReactNode; dark?: boolean }) {
  const [items, setItems] = useState<T[]>([]);
  const push = useCallback((msg: string, kind: Kind = 'info') => {
    const id = Date.now() + Math.random();
    setItems((x) => [...x, { id, msg, kind }]);
    setTimeout(() => setItems((x) => x.filter((i) => i.id !== id)), 5000);
  }, []);
  const color = { ok: 'border-l-emerald-500', warn: 'border-l-amber-400', bad: 'border-l-red-500', info: 'border-l-indigo-400' };
  return (
    <Ctx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed right-4 bottom-28 z-[100] grid w-[min(380px,calc(100vw-2rem))] gap-2" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className={`animate-fade-up rounded-xl border border-l-4 px-4 py-3 text-sm shadow-xl ${color[t.kind]} ${dark ? 'border-white/10 bg-ink-700 text-slate-100' : 'border-slate-200 bg-white text-slate-800'}`}>
            {t.msg}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export const useToast = () => useContext(Ctx);
