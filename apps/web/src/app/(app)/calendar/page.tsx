import type { Metadata } from 'next';
import { PageHeader } from '@/components/page-header';

export const metadata: Metadata = { title: 'Calendar' };

export default function CalendarPage() {
  return <PageHeader title="Calendar" description="Plan, schedule and approve everything that goes out." />;
}
