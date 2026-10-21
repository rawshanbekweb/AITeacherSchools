import { notFound } from 'next/navigation';
import { pageCtx } from '@/lib/server/auth';
import { report } from '@/lib/server/classroom';
import { navAllowed } from '@/lib/core/admin-nav';
import { PageHeader } from '@/components/admin/PageHeader';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { ReportActions } from '@/components/admin/ReportActions';

export const metadata = { title: 'Dars hisoboti' };
const LBL: Record<string, string> = { present: '✅ bor', late: '⏰ kechikdi', absent: '❌ yo‘q', excused: '📄 sababli', unmarked: '— belgilanmagan' };

export default async function ReportPage({ params }: PageProps<'/admin/reports/[id]'>) {
  const ctx = await pageCtx();
  if (!navAllowed('reports', ctx.user.role)) notFound();
  const r = await report(ctx, (await params).id).catch(() => null);
  if (!r) notFound();
  const present = r.attendance.filter((a) => ['present', 'late'].includes(a.status)).length;
  const stat = (v: React.ReactNode, l: string) => <div className="card p-5"><div className="text-sm text-slate-500">{l}</div><div className="mt-1 text-3xl font-bold tabular-nums">{v}</div></div>;
  return (
    <>
      <PageHeader title={`${r.lesson.title} · ${r.group.name}`} description={`${new Date(r.session.startedAt).toLocaleString('uz-UZ')} · ${r.session.teacherName ?? ''}`} actions={<><StatusBadge value={r.session.status} /><ReportActions report={r} /></>} />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stat(`${present}/${r.attendance.length}`, 'Davomat')}
        {stat(`${r.lesson.sections.filter((s) => s.done).length}/${r.lesson.sections.length}`, 'O‘tilgan bo‘limlar')}
        {stat(r.score != null ? `${r.score}%` : '—', 'Test natijasi')}
        {stat(r.questions.length, 'Savollar')}
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="card overflow-hidden">
          <h2 className="px-5 pt-5 font-semibold">Davomat</h2>
          <table className="mt-3 w-full text-sm"><tbody className="divide-y divide-slate-100">
            {r.attendance.map((a) => <tr key={a.studentId}><td className="px-5 py-2">{a.fullName}</td><td className="px-5 py-2">{LBL[a.status] ?? a.status}</td><td className="px-5 py-2 text-xs text-slate-400">{a.method ?? ''} {a.changedBy ?? ''}</td></tr>)}
          </tbody></table>
        </section>
        <div className="grid content-start gap-6">
          <section className="card p-5"><h2 className="font-semibold">Bo‘limlar</h2><ul className="mt-2 grid gap-1 text-sm">{r.lesson.sections.map((s) => <li key={s.title}>{s.done ? '✅' : '⬜'} {s.title}</li>)}</ul></section>
          <section className="card p-5"><h2 className="font-semibold">Test natijalari</h2><ul className="mt-2 grid gap-1 text-sm">{r.results.length ? r.results.map((x) => <li key={x.id}>{x.correct ? '✅' : '❌'} {x.question} — <i>{x.answer}</i></li>) : <li className="text-slate-400">—</li>}</ul></section>
          <section className="card p-5"><h2 className="font-semibold">Savol-javoblar</h2>
            <ul className="mt-2 grid gap-3 text-sm">{r.questions.length ? r.questions.map((q) => (
              <li key={q.id}><b>{q.text}</b> {q.escalated && <span className="badge bg-amber-50 text-amber-700">o‘qituvchiga</span>} <span className="badge bg-slate-100 text-slate-600">{q.source}</span><p className="mt-1 text-slate-500">{q.answer}</p></li>
            )) : <li className="text-slate-400">—</li>}</ul>
          </section>
        </div>
      </div>
    </>
  );
}
