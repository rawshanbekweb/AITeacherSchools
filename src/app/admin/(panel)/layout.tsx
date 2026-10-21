import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/server/auth';
import { AdminShell } from '@/components/admin/AdminShell';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  if (!user) redirect('/admin/login');
  if (user.role === 'student') redirect('/');
  return <AdminShell user={user}>{children}</AdminShell>;
}
