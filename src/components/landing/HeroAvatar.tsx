'use client';
import { useEffect, useRef, useState } from 'react';
import { AvatarCanvas } from '@/components/AvatarCanvas';
import type { Avatar } from '@/lib/client/avatar';
import { DEFAULT_AVATAR } from '@/lib/core/avatar-default';

const LINES = ['Assalomu alaykum! Men sizning AI ustozingizman 👋', 'Bugun koinotga sayohat qilamiz 🚀', 'Savolingiz bo‘lsa — qo‘l ko‘taring ✋', 'Darsdan keyin hisobot tayyor bo‘ladi 📊'];

export function HeroAvatar() {
  const avatar = useRef<Avatar | null>(null);
  const [i, setI] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setI((x) => (x + 1) % LINES.length), 5200);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    const a = avatar.current;
    if (!a) return;
    const d = a.speak(LINES[i].replace(/[^\p{L}\s,.!?‘’]/gu, ''), 13);
    const t = setTimeout(() => a.stopSpeaking(), d * 1000);
    return () => clearTimeout(t);
  }, [i]);
  return (
    <div className="relative flex h-[min(78vh,760px)] items-end justify-center">
      <div className="absolute inset-x-[6%] top-[8%] bottom-0 rounded-t-full bg-[radial-gradient(closest-side,rgba(255,210,150,.22),transparent)]" />
      <AvatarCanvas config={DEFAULT_AVATAR} onReady={(a) => { avatar.current = a; }} className="relative h-full w-auto drop-shadow-[0_24px_48px_rgba(0,0,0,.55)]" />
      <div key={i} className="animate-fade-up absolute top-[4%] left-0 max-w-64 rounded-2xl rounded-bl-sm border border-white/10 bg-ink-700/95 px-4 py-3 text-sm text-slate-100 shadow-2xl lg:-left-10">
        {LINES[i]}
      </div>
    </div>
  );
}
