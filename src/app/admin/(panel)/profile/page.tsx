import { pageCtx } from '@/lib/server/auth';
import { ProfileClient } from '@/components/admin/ProfileClient';

export const metadata = { title: 'Profil va xavfsizlik' };

export default async function ProfilePage({ searchParams }: PageProps<'/admin/profile'>) {
  const { user } = await pageCtx({ allowMfaSetup: true });
  const { mfa } = await searchParams;
  return <ProfileClient user={user} mustEnroll={mfa === 'required' || user.mfaRequired} />;
}
