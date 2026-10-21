'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { Backpack, BookOpen, CalendarDays, ChartColumn, Circle, KeyRound, Landmark, LayoutDashboard, Library, LogOut, Menu, MonitorSmartphone, NotebookPen, PlayCircle, School, ScrollText, ShieldCheck, UserRoundCog, Users, X, type LucideIcon } from 'lucide-react';

const ICONS: Record<string, LucideIcon> = { Backpack, BookOpen, CalendarDays, ChartColumn, KeyRound, Landmark, LayoutDashboard, Library, MonitorSmartphone, NotebookPen, School, ScrollText, ShieldCheck, UserRoundCog, Users };
import type { SessionUser } from '@/lib/core/types';
import { ADMIN_NAV, ROLE_LABEL } from '@/lib/core/admin-nav';
import { post } from '@/lib/client/api';
import { Logo } from '@/components/ui/Logo';
import { ToastProvider } from '@/components/ui/Toast';
import { MeProvider } from './me';

export function AdminShell({ user, children }: { user: SessionUser; children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const items = ADMIN_NAV.filter((n) => n.roles.includes(user.role));
  const active = (id: string) => (id ? path === `/admin/${id}` || path.startsWith(`/admin/${id}/`) : path === '/admin');
  async function logout() {
    await post('auth/logout').catch(() => {});
    router.replace('/admin/login');
  }
  return (
    <MeProvider user={user}>
      <ToastProvider>
        <div className="min-h-dvh lg:grid lg:grid-cols-[260px_1fr]">
          <aside className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col gap-5 overflow-hidden border-r border-slate-200 bg-white px-4 py-5 transition-transform lg:sticky lg:top-0 lg:h-dvh lg:w-auto lg:translate-x-0 ${open ? 'translate-x-0 shadow-2xl' : '-translate-x-full'}`}>
            <div className="flex items-center justify-between px-2"><Logo subtitle="Admin panel" size={38} /><button className="btn btn-ghost btn-sm lg:hidden" onClick={() => setOpen(false)} aria-label="Yopish"><X size={18} /></button></div>
            <nav className="-mx-1 flex-1 overflow-y-auto px-1">
              {items.map((n, i) => {
                const Icon = ICONS[n.icon] ?? Circle;
                const header = n.group && n.group !== items[i - 1]?.group ? n.group : null;
                return (
                  <div key={n.id}>
                    {header && <div className="mt-4 mb-1 px-3 text-[11px] font-semibold tracking-wider text-slate-400 uppercase">{header}</div>}
                    <Link href={`/admin${n.id ? '/' + n.id : ''}`} onClick={() => setOpen(false)}
                      className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition ${active(n.id) ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}>
                      <Icon size={18} className={active(n.id) ? 'text-brand-600' : 'text-slate-400'} />{n.title}
                    </Link>
                  </div>
                );
              })}
            </nav>
            <div className="grid min-w-0 gap-2 border-t border-slate-100 pt-4">
              <div className="flex min-w-0 items-center gap-3 px-2">
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-slate-100 text-sm font-bold text-slate-600">{user.fullName.slice(0, 1)}</span>
                <div className="min-w-0 text-sm leading-tight"><b className="block truncate">{user.fullName}</b><span className="block truncate text-xs text-slate-500">{ROLE_LABEL[user.role]}{user.institutionName ? ` · ${user.institutionName}` : ''}</span></div>
              </div>
              {user.role !== 'technician' && <Link href="/classroom" className="btn"><PlayCircle size={16} />Classroom</Link>}
              <button className="btn btn-ghost" onClick={logout}><LogOut size={16} />Chiqish</button>
            </div>
          </aside>
          {open && <div className="fixed inset-0 z-40 bg-slate-900/40 lg:hidden" onClick={() => setOpen(false)} />}
          <div className="min-w-0">
            <div className="sticky top-0 z-30 flex items-center gap-3 border-b border-slate-200 bg-white/80 px-4 py-3 backdrop-blur lg:hidden">
              <button className="btn btn-ghost btn-sm" onClick={() => setOpen(true)} aria-label="Menyu"><Menu size={20} /></button><Logo size={30} />
            </div>
            <main className="mx-auto max-w-7xl px-4 py-6 sm:px-8">{children}</main>
          </div>
        </div>
      </ToastProvider>
    </MeProvider>
  );
}
