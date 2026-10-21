import Link from 'next/link';
import { desc, eq } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import { pageCtx } from '@/lib/server/auth';
import { navAllowed } from '@/lib/core/admin-nav';
import * as t from '@/db/schema';
import { PageHeader } from '@/components/admin/PageHeader';
import { StatusBadge } from '@/components/ui/StatusBadge';

export const metadata = { title: 'Hisobotlar' };

export default async function ReportsPage() {
  const { db, user } = await pageCtx();
  if (!navAllowed('reports', user.role)) notFound();
  const rows = await db
    .select({ id: t.lessonSessions.id, status: t.lessonSessions.status, startedAt: t.lessonSessions.startedAt, teacher: t.lessonSessions.teacherName, state: t.lessonSessions.snapshot, lesson: t.lessons.title, group: t.groups.name, inst: t.institutions.name })
    .from(t.lessonSessions)
    .innerJoin(t.lessons, eq(t.lessons.id, t.lessonSessions.lessonId))
    .innerJoin(t.groups, eq(t.groups.id, t.lessonSessions.groupId))
    .innerJoin(t.institutions, eq(t.institutions.id, t.lessonSessions.institutionId))
    .where(user.role === 'super_admin' ? undefined : eq(t.lessonSessions.institutionId, user.institutionId ?? '-'))
    .orderBy(desc(t.lessonSessions.startedAt))
    .limit(200);
  return (
    <>
      <PageHeader title="Hisobotlar" description="Har bir o‘tkazilgan dars: davomat, o‘tilgan bo‘limlar, test natijalari va savol-javoblar." />
      <div className="card overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs font-semibold tracking-wide text-slate-500 uppercase"><tr><th className="px-4 py-3">Sana</th><th className="px-4 py-3">Dars</th><th className="px-4 py-3">Guruh</th>{user.role === 'super_admin' && <th className="px-4 py-3">Muassasa</th>}<th className="px-4 py-3">O‘qituvchi</th><th className="px-4 py-3">Holat</th><th /></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 && <tr><td colSpan={7} className="px-4 py-10 text-center text-slate-400">Hali darslar o‘tkazilmagan</td></tr>}
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-slate-50/70">
                <td className="px-4 py-3 whitespace-nowrap">{r.startedAt.toLocaleString('uz-UZ')}</td>
                <td className="px-4 py-3 font-medium">{r.lesson}</td>
                <td className="px-4 py-3">{r.group}</td>
                {user.role === 'super_admin' && <td className="px-4 py-3">{r.inst}</td>}
                <td className="px-4 py-3">{r.teacher}</td>
                <td className="px-4 py-3"><StatusBadge value={r.status} />{r.status === 'active' && r.state?.state && <span className="ml-1 text-xs text-slate-400">{r.state.state}</span>}</td>
                <td className="px-4 py-3 text-right"><Link href={`/admin/reports/${r.id}`} className="btn btn-sm">Hisobot</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
