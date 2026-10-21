'use client';
import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

export function Modal({ open, onClose, title, children, wide = false }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      className={`m-auto max-h-[calc(100vh-2rem)] w-[calc(100vw-2rem)] ${wide ? 'max-w-4xl' : 'max-w-2xl'} rounded-2xl border border-slate-200 bg-white p-0 text-slate-900 shadow-2xl`}
    >
      {open && (
        <div className="flex max-h-[calc(100vh-2rem)] flex-col">
          <header className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
            <h2 className="text-lg font-bold">{title}</h2>
            <button className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Yopish"><X size={18} /></button>
          </header>
          <div className="overflow-y-auto px-6 py-5">{children}</div>
        </div>
      )}
    </dialog>
  );
}
