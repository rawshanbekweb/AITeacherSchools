import { notFound } from 'next/navigation';
import { pageCtx } from '@/lib/server/auth';
import { getEntity } from '@/lib/server/crud';
import { navAllowed } from '@/lib/core/admin-nav';
import type { Lesson } from '@/lib/core/types';
import { LessonEditor } from '@/components/admin/LessonEditor';

export const metadata = { title: 'Dars muharriri' };

export default async function LessonPage({ params }: PageProps<'/admin/lessons/[id]'>) {
  const { id } = await params;
  const ctx = await pageCtx();
  if (!navAllowed('lessons', ctx.user.role)) notFound();
  const canWrite = ['super_admin', 'inst_admin', 'teacher'].includes(ctx.user.role);
  if (id === 'new') {
    if (!canWrite) notFound();
    return <LessonEditor lesson={null} readOnly={false} />;
  }
  const lesson = (await getEntity(ctx, 'lessons', id).catch(() => null)) as Lesson | null;
  if (!lesson) notFound();
  return <LessonEditor lesson={JSON.parse(JSON.stringify(lesson))} readOnly={!canWrite} />;
}
