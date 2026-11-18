import type { Metadata } from 'next';
import { ProfilePage } from '@/features/profile/profile-page';

export const metadata: Metadata = { title: 'Brand profile' };

export default function BrandPage() {
  return <ProfilePage />;
}
