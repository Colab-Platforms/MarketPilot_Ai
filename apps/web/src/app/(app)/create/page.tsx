import type { Metadata } from 'next';
import { PageHeader } from '@/components/page-header';

export const metadata: Metadata = { title: 'Create' };

export default function CreatePage() {
  return <PageHeader title="Create" description="Generate posts, images and reels in your brand style." />;
}
