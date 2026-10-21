import type { Metadata } from 'next';
import { LoginForm } from '@/components/LoginForm';

export const metadata: Metadata = { title: 'Admin — kirish' };

export default async function AdminLoginPage({ searchParams }: PageProps<'/admin/login'>) {
  const { next } = await searchParams;
  return <LoginForm portal="admin" next={typeof next === 'string' ? next : undefined} />;
}
