import type { Metadata } from 'next';
import { ReelProjectPage } from '@/features/reels/reel-project-page';

export const metadata: Metadata = { title: 'Reel' };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ReelProjectPage id={id} />;
}
