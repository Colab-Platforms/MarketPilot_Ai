import { cn } from '@marketpilot/ui';
import { AppWindow } from './app-window';
import { ApprovalCard, SafetyCard } from './hero-cards';
import { tileClass, type TileTone } from './tiles';

interface WeekPost {
  title: string;
  meta: string;
  tone: TileTone;
  needsYou?: boolean;
}

const week: { day: string; posts: WeekPost[] }[] = [
  { day: 'Mon 30', posts: [{ title: 'Fresh today', meta: 'Post · 6 pm', tone: 'ink' }] },
  { day: 'Tue 1', posts: [{ title: 'Meet the team', meta: 'Reel', tone: 'sky' }] },
  {
    day: 'Wed 2',
    posts: [
      { title: 'Wedding boxes', meta: 'Post', tone: 'navy' },
      { title: 'Offer story', meta: 'Story', tone: 'ink' },
    ],
  },
  { day: 'Thu 3', posts: [{ title: 'Plum cake', meta: 'Reel', tone: 'sky' }] },
  { day: 'Fri 4', posts: [{ title: 'Gift packs', meta: 'Post', tone: 'navy' }] },
  { day: 'Sat 5', posts: [{ title: 'Saturday reel', meta: 'Needs you', tone: 'ink', needsYou: true }] },
  { day: 'Sun 6', posts: [{ title: 'Sunday saver', meta: 'Post', tone: 'sky' }] },
];

const stats = [
  { label: 'Planned this month', value: '30 posts' },
  { label: 'Languages', value: 'Hindi + English' },
  { label: 'Your time this week', value: 'About 10 min' },
];

const nav = ['Home', 'Plan', 'Studio', 'Approvals', 'Results', 'Brand memory'];

function CreditsMeter() {
  return (
    <div className="flex flex-col gap-1 rounded-md bg-subtle p-3">
      <span className="text-caption text-ink-tertiary">Credits this month</span>
      <b className="text-label">214 of 300</b>
      <span className="h-1 overflow-hidden rounded-full bg-muted">
        <span className="block h-full w-3/4 bg-highlight" />
      </span>
    </div>
  );
}

function WeekGrid() {
  return (
    <div className="grid grid-cols-7 content-start gap-2">
      {week.map(({ day, posts }) => {
        const isToday = posts.some((p) => p.needsYou);
        return (
          <div key={day} className="flex min-w-0 flex-col gap-2">
            <span
              className={cn(
                'whitespace-nowrap border-b-2 px-0.5 pb-1 text-caption font-bold text-ink-tertiary',
                isToday ? 'border-highlight' : 'border-line',
              )}
            >
              {day}
            </span>
            {posts.map((post) => (
              <div
                key={post.title}
                className={cn(
                  'overflow-hidden rounded-md bg-surface ring-line',
                  post.needsYou ? 'ring-2 ring-highlight' : 'ring-1',
                )}
              >
                <div className={cn('h-control', tileClass[post.tone])} />
                <div className="flex flex-col gap-0.5 px-2 pb-2 pt-1">
                  <span className="break-words text-caption font-bold leading-tight">{post.title}</span>
                  <span className={cn('break-words text-caption font-semibold leading-tight', post.needsYou ? 'text-accent' : 'text-ink-tertiary')}>
                    {post.meta}
                  </span>
                </div>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

export function HeroDashboard({ className }: { className?: string }) {
  return (
    <AppWindow
      url="app.marketpilot.in"
      nav={nav}
      activeNav="Home"
      navBadge={{ item: 'Approvals', count: 3 }}
      sidebarFooter={<CreditsMeter />}
      className={className}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <span className="font-display text-title font-extrabold tracking-tight">Good evening, Sharma Sweets</span>
          <span className="text-caption text-ink-tertiary">This week · 30 Nov to 6 Dec</span>
        </div>
        <span className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-caption font-semibold">
          <span className="size-2 rounded-full bg-highlight" />
          Ready for your yes
        </span>
      </div>
      <div className="flex gap-4">
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <WeekGrid />
          <div className="flex items-center justify-between gap-3 rounded-lg bg-highlight-subtle px-3 py-3 text-caption text-highlight-text">
            <span>
              <b>Coming up: Christmas, 25 Dec.</b> Plum cake pre-orders start 18 Dec.
            </span>
            <b className="whitespace-nowrap">4 posts planned</b>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {stats.map((stat) => (
              <div key={stat.label} className="flex flex-col gap-0.5 rounded-lg border border-line bg-surface p-3">
                <span className="text-caption text-ink-tertiary">{stat.label}</span>
                <b className="text-heading">{stat.value}</b>
              </div>
            ))}
          </div>
        </div>
        <div className="hidden w-aside shrink-0 flex-col gap-2 lg:flex">
          <ApprovalCard />
          <SafetyCard />
        </div>
      </div>
    </AppWindow>
  );
}
