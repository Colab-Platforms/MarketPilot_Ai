import type { Metadata } from 'next';
import { ReelsPage } from '@/features/reels/reels-page';

export const metadata: Metadata = { title: 'Reels' };

export default function Page() {
  return <ReelsPage />;
}
