'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { Button, SegmentedControl } from '@marketpilot/ui';
import { useAuthStore } from '@/lib/auth-store';
import { ApprovalsCard } from './approvals-card';
import { BestDaysCard } from './best-days-card';
import { ChannelsCard } from './channels-card';
import type { DashboardRange } from './dashboard-types';
import { greetingFor } from './format';
import { KpiTiles } from './kpi-tiles';
import { ProfileCompletionBanner } from './profile-completion-banner';
import { ReachCard } from './reach-card';
import { SampleNotice } from './sample-notice';
import { TopPostsCard } from './top-posts-card';
import { UpNextCard } from './up-next-card';
import { useDashboard } from './use-dashboard';

const RANGES = [
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
  { value: '90d', label: '90 days' },
] as const;

const today = new Intl.DateTimeFormat('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });

export function HomeDashboard() {
  const [range, setRange] = useState<DashboardRange>('30d');
  const data = useDashboard(range);
  const firstName = useAuthStore((state) => state.context?.user.name.split(' ')[0]);
  const now = new Date();

  return (
    <div className="mx-auto flex w-full max-w-page flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-caption text-ink-tertiary">{today.format(now)}</p>
          <h1 className="mt-1 text-title">
            {greetingFor(now)}
            {firstName ? `, ${firstName}` : ''}
          </h1>
          <p className="mt-1 text-body text-ink-secondary">What goes out next, what needs your approval, and how you are doing.</p>
        </div>
        <Button asChild>
          <Link href="/create">
            <Plus className="size-4" strokeWidth={1.5} aria-hidden="true" />
            Create post
          </Link>
        </Button>
      </header>

      <ProfileCompletionBanner />
      {data.isSample ? <SampleNotice /> : null}

      <section aria-labelledby="performance-heading" className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="performance-heading" className="text-heading">
            Performance
          </h2>
          <SegmentedControl options={RANGES} value={range} onChange={setRange} label="Time range" />
        </div>
        <KpiTiles kpis={data.kpis} />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <ReachCard data={data.reach} sample={data.isSample} />
          <ChannelsCard channels={data.channels} sample={data.isSample} />
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ApprovalsCard approvals={data.approvals} sample={data.isSample} />
        <UpNextCard posts={data.upNext} sample={data.isSample} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <TopPostsCard posts={data.topPosts} sample={data.isSample} />
        <BestDaysCard data={data.bestDays} sample={data.isSample} />
      </div>
    </div>
  );
}
