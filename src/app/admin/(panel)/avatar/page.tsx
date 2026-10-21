import { asc, eq } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import { pageCtx } from '@/lib/server/auth';
import { navAllowed } from '@/lib/core/admin-nav';
import { institutions } from '@/db/schema';
import { AvatarStudio } from '@/components/admin/AvatarStudio';

export const metadata = { title: 'Avatar studiyasi' };

export default async function AvatarPage() {
  const { db, user } = await pageCtx();
  if (!navAllowed('avatar', user.role)) notFound();
  const list = await db.select({ id: institutions.id, name: institutions.name }).from(institutions)
    .where(user.role === 'super_admin' ? undefined : eq(institutions.id, user.institutionId ?? '-')).orderBy(asc(institutions.name));
  return <AvatarStudio institutions={list} />;
}
