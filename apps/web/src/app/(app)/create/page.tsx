import type { Metadata } from 'next';
import { CreatePage } from '@/features/studio/create-page';

export const metadata: Metadata = { title: 'Create' };

export default function Page() {
  return <CreatePage />;
}
