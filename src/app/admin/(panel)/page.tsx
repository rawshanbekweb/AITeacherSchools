import Link from 'next/link';
import { AlertTriangle, ArrowRight, CircleHelp, MonitorX } from 'lucide-react';
import { pageCtx } from '@/lib/server/auth';
import { dashboard } from '@/lib/server/classroom';
import { PageHeader } from '@/components/admin/PageHeader';
import { StatusBadge } from '@/components/ui/StatusBadge';

export const metadata = { title: 'Boshqaruv paneli' };

function Stat({ value, label, hint }: { value: string | number | null; label: string; hint?: string }) {
  return (
    <div className="card p-5">
      <div className="text-sm font-medium text-slate-500">{label}</div>
      <div className="mt-1 text-3xl font-bold tracking-tight text-slate-900 tabular-nums">{value ?? '—'}</div>
      {hint && <div className="mt-1 text-xs text-slate-400">{hint}</div>}
    </div>
  );
}

function lastDays(weekly: { day: string; n: number }[], count = 14) {
  const now = Date.now();
  return Array.from({ length: count }, (_, i) => {
    const dt = new Date(now - (count - 1 - i) * 86400_000);
    const key = dt.toISOString().slice(0, 10);
    return { key, label: dt.toLocaleDateString('uz-UZ', { day: '2-digit', month: '2-digit' }), n: weekly.find((w) => w.day === key)?.n ?? 0 };
  });
}

export default async function DashboardPage() {
  const ctx = await pageCtx();
  const d = await dashboard(ctx);
  const days = lastDays(d.weekly);
  const max = Math.max(1, ...days.map((x) => x.n));
  const edu = ctx.user.role !== 'technician';
  return (
    <>
      <PageHeader title={`Xush kelibsiz, ${ctx.user.fullName.split(' ')[0]}!`} description={ctx.user.institutionName ?? 'Platforma bo‘yicha umumiy ko‘rsatkichlar'}
        actions={edu ? <Link href="/classroom" className="btn btn-primary">Darsni boshlash <ArrowRight size={16} /></Link> : undefined} />

      {(d.pendingMaterials > 0 || d.offlineDevices > 0 || d.escalatedQuestions > 0) && (
        <div className="mb-6 grid gap-2">
          {d.pendingMaterials > 0 && <Link href="/admin/materials?status=pending" className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"><AlertTriangle size={18} className="text-amber-600" /><b>Ogohlantirish:</b> {d.pendingMaterials} ta material moderatsiyani kutmoqda</Link>}
          {d.offlineDevices > 0 && <Link href="/admin/devices?status=offline" className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900"><MonitorX size={18} className="text-red-600" /><b>Muhim:</b> {d.offlineDevices} ta qurilma oflayn</Link>}
          {d.escalatedQuestions > 0 && <Link href="/admin/reports" className="flex items-center gap-3 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900"><CircleHelp size={18} className="text-sky-600" /><b>Ma’lumot:</b> AI {d.escalatedQuestions} ta savolni o‘qituvchiga yo‘naltirdi</Link>}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {ctx.user.role === 'super_admin' && <Stat value={d.counts.institutions} label="Muassasalar" />}
        {edu && <Stat value={d.counts.groups} label="Sinf / guruhlar" />}
        {edu && <Stat value={d.counts.students} label="O‘quvchilar" />}
        {edu && <Stat value={d.counts.lessons} label="Darslar" />}
        {edu && <Stat value={d.sessions.total} label="O‘tkazilgan darslar" hint={`${d.sessions.active} ta davom etmoqda`} />}
        {edu && <Stat value={d.attendanceRate != null ? `${d.attendanceRate}%` : null} label="Davomat" hint="bor + kechikkan" />}
        {edu && <Stat value={d.quizAccuracy != null ? `${d.quizAccuracy}%` : null} label="Test aniqligi" />}
        <Stat value={d.counts.devices} label="Qurilmalar" hint={`${d.offlineDevices} ta oflayn`} />
      </div>

      {edu && (
        <div className="mt-6 grid gap-6 lg:grid-cols-[1.2fr_1fr]">
          <section className="card p-5">
            <h2 className="font-semibold text-slate-900">Darslar soni — so‘nggi 14 kun</h2>
            <div className="mt-6 flex h-40 items-end gap-1.5" role="img" aria-label="Kunlik darslar soni">
              {days.map((x) => (
                <div key={x.key} className="group relative flex h-full flex-1 flex-col items-center justify-end">
                  <span className="pointer-events-none absolute -top-7 hidden rounded-md bg-slate-900 px-2 py-0.5 text-xs whitespace-nowrap text-white group-hover:block">{x.label}: {x.n} ta</span>
                  <div className="w-full max-w-7 rounded-t-[4px] bg-brand-500 transition group-hover:bg-brand-600" style={{ height: `${x.n ? Math.max(4, (x.n / max) * 100) : 0}%` }} />
                  <div className="h-px w-full bg-slate-200" />
                </div>
              ))}
            </div>
            <div className="mt-2 flex justify-between text-xs text-slate-400"><span>{days[0].label}</span><span>bugun</span></div>
            <details className="mt-3 text-sm text-slate-500"><summary className="cursor-pointer">Jadval ko‘rinishi</summary>
              <table className="mt-2 w-full text-left text-xs"><tbody>{days.map((x) => <tr key={x.key} className="border-b border-slate-100"><td className="py-1">{x.key}</td><td className="text-right tabular-nums">{x.n}</td></tr>)}</tbody></table>
            </details>
          </section>
          <section className="card overflow-hidden">
            <h2 className="px-5 pt-5 font-semibold text-slate-900">So‘nggi darslar</h2>
            {d.recentSessions.length ? (
              <ul className="mt-3 divide-y divide-slate-100">
                {d.recentSessions.map((s) => (
                  <li key={s.id}><Link href={`/admin/reports/${s.id}`} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-slate-50">
                    <div className="min-w-0"><b className="block truncate text-sm">{s.lesson}</b><span className="text-xs text-slate-500">{s.group} · {s.teacher} · {new Date(s.startedAt).toLocaleString('uz-UZ')}</span></div>
                    <StatusBadge value={s.status} />
                  </Link></li>
                ))}
              </ul>
            ) : <p className="px-5 py-8 text-sm text-slate-500">Hali dars o‘tkazilmagan. Classroom orqali birinchi darsni boshlang.</p>}
          </section>
        </div>
      )}
    </>
  );
}
