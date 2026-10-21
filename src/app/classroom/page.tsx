import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/server/auth';
import { ClassroomApp } from '@/components/classroom/ClassroomApp';
import './classroom.css';

export const metadata: Metadata = { title: 'Classroom' };

export default async function ClassroomPage() {
  const user = await currentUser();
  if (!user) redirect('/login?next=/classroom');
  if (user.role === 'technician' || user.role === 'student') redirect('/admin');
  return <ClassroomApp user={user} />;
}
