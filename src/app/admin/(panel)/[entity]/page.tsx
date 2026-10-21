import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { pageCtx } from '@/lib/server/auth';
import { navAllowed } from '@/lib/core/admin-nav';
import { EntityTable } from '@/components/admin/EntityTable';

const ENTITIES = ['institutions', 'departments', 'groups', 'students', 'users', 'subjects', 'lessons', 'materials', 'schedule', 'devices', 'audit'];

export default async function EntityPage({ params }: PageProps<'/admin/[entity]'>) {
  const { entity } = await params;
  const { user } = await pageCtx();
  if (!ENTITIES.includes(entity) || !navAllowed(entity, user.role)) notFound();
  return <Suspense><EntityTable entity={entity} /></Suspense>;
}
