import type { ReactNode } from 'react';
import { Sparkles } from 'lucide-react';
import { cn } from '@marketpilot/ui';
import { ApprovalCard } from './hero-cards';
import { tileClass, type TileTone } from './tiles';

function Row({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-line bg-surface px-3 py-3 text-body', className)}>
      {children}
    </div>
  );
}

function SideCard({ children }: { children: ReactNode }) {
  return (
    <div className="flex w-full flex-col gap-2 rounded-lg border border-line bg-surface p-4 text-body md:w-aside md:shrink-0">
      {children}
    </div>
  );
}

function StatusPill({ live, children }: { live?: boolean; children: ReactNode }) {
  return (
    <span className={cn('rounded-full px-3 py-0.5 text-caption font-bold', live ? 'bg-highlight text-highlight-on' : 'bg-subtle text-ink-secondary')}>
      {children}
    </span>
  );
}

const plan = [
  { day: 'Mon', title: 'Fresh today', kind: 'Post' },
  { day: 'Wed', title: 'Wedding boxes from ₹499', kind: 'Post' },
  { day: 'Thu', title: 'Plum cake', kind: 'Reel' },
  { day: 'Sat', title: 'Saturday reel', kind: 'Reel' },
  { day: 'Sun', title: 'Sunday saver', kind: 'Post' },
];

export function PlanPanel() {
  return (
    <div className="flex flex-col gap-4 md:flex-row">
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        {plan.map((item) => (
          <Row key={item.day}>
            <span className="w-12 text-ink-tertiary">{item.day}</span>
            <span className="flex-1 font-semibold">{item.title}</span>
            <StatusPill>{item.kind}</StatusPill>
          </Row>
        ))}
      </div>
      <SideCard>
        <b>Coming up: Christmas</b>
        <span className="font-display text-stat text-accent">25 Dec</span>
        <span className="text-ink-secondary">Plum cake pre-orders start 18 Dec. Four posts are already planned around it.</span>
      </SideCard>
    </div>
  );
}

const drafts: { title: string; kind: string; tone: TileTone }[] = [
  { title: 'Kaju katli, made fresh at 6 am', kind: 'Reel', tone: 'ink' },
  { title: 'Wedding boxes for every guest list', kind: 'Post', tone: 'sky' },
  { title: 'Christmas plum cake is back', kind: 'Post', tone: 'navy' },
];

const memory = ['Warm, friendly tone', 'Hindi + English', 'Prices from your menu', 'No health claims'];

export function CreatePanel() {
  return (
    <div className="flex flex-col gap-4 md:flex-row">
      <div className="grid min-w-0 flex-1 grid-cols-3 gap-3">
        {drafts.map((draft) => (
          <div key={draft.title} className="overflow-hidden rounded-lg border border-line bg-surface">
            <div className={cn('flex aspect-square items-end p-3 font-display text-heading font-extrabold leading-tight', tileClass[draft.tone])}>
              {draft.title}
            </div>
            <div className="flex items-center justify-between gap-2 px-3 py-2 text-caption">
              <span className="font-semibold">{draft.kind}</span>
              <span className="rounded-sm bg-info-subtle px-2 py-0.5 font-semibold text-info">AI draft</span>
            </div>
          </div>
        ))}
      </div>
      <SideCard>
        <span className="flex items-center gap-2 font-bold">
          <Sparkles className="size-4 text-accent" strokeWidth={2} />
          Made from your brand memory
        </span>
        <div className="flex flex-wrap gap-2 text-caption">
          {memory.map((fact) => (
            <span key={fact} className="rounded-sm bg-subtle px-2 py-1">
              {fact}
            </span>
          ))}
        </div>
      </SideCard>
    </div>
  );
}

const queue = [
  { title: 'Saturday reel', when: 'Sat 6:30 pm', waiting: true },
  { title: 'Christmas plum cake', when: 'Sat 6:30 pm', waiting: true },
  { title: 'Sunday saver', when: 'Sun 11 am', waiting: true },
  { title: 'Wedding boxes from ₹499', when: 'Wed 6:30 pm', waiting: false },
];

export function ApprovePanel() {
  return (
    <div className="flex flex-col gap-4 md:flex-row">
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        {queue.map((item) => (
          <Row key={item.title}>
            <span className="flex-1 font-semibold">{item.title}</span>
            <span className="text-ink-tertiary">{item.when}</span>
            <StatusPill live={item.waiting}>{item.waiting ? 'Needs you' : 'Approved'}</StatusPill>
          </Row>
        ))}
      </div>
      <ApprovalCard className="w-full md:w-aside md:shrink-0" />
    </div>
  );
}

const published = [
  { time: '6:30 pm', title: 'Wedding boxes from ₹499', channel: 'Instagram', live: true },
  { time: '6:31 pm', title: 'Wedding boxes from ₹499', channel: 'Facebook', live: true },
  { time: '8:00 pm', title: 'Story reminder', channel: 'Instagram', live: false },
  { time: 'Sat 6:30 pm', title: 'Christmas plum cake', channel: 'Instagram', live: false },
  { time: 'Sun 11 am', title: 'Sunday saver', channel: 'Facebook', live: false },
];

export function PublishPanel() {
  return (
    <div className="flex flex-col gap-4 md:flex-row">
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        {published.map((item) => (
          <Row key={`${item.time}-${item.channel}`}>
            <span className="w-full font-semibold md:order-2 md:w-auto md:flex-1">{item.title}</span>
            <span className="text-ink-tertiary md:order-1 md:w-thumb">{item.time}</span>
            <span className="text-ink-tertiary md:order-3">{item.channel}</span>
            <span className="ml-auto md:order-4 md:ml-0">
              <StatusPill live={item.live}>{item.live ? 'Live' : 'Scheduled'}</StatusPill>
            </span>
          </Row>
        ))}
      </div>
      <SideCard>
        <b>Best time for your customers</b>
        <span className="font-display text-stat text-accent">6 to 8 pm</span>
        <span className="text-ink-secondary">Learnt from your last four weeks. Posts move to this window automatically.</span>
      </SideCard>
    </div>
  );
}

const results = [
  { label: 'People reached', value: '4,820', change: '18% more than last week' },
  { label: 'Saves', value: '312', change: '2 of every 3 from reels' },
  { label: 'WhatsApp messages', value: '46', change: 'Mostly about wedding boxes' },
];

export function LearnPanel() {
  return (
    <div className="flex flex-col gap-4 md:flex-row">
      <div className="grid min-w-0 flex-1 gap-2 md:grid-cols-3">
        {results.map((metric) => (
          <div key={metric.label} className="flex flex-col gap-1 rounded-lg border border-line bg-surface p-4">
            <span className="text-label text-ink-tertiary">{metric.label}</span>
            <b className="font-display text-metric">{metric.value}</b>
            <span className="text-caption text-ink-secondary">{metric.change}</span>
          </div>
        ))}
      </div>
      <SideCard>
        <b>Next week, it will</b>
        <span className="text-ink-secondary">Make two more reels with prices on them, and move the Sunday post to 6 pm.</span>
      </SideCard>
    </div>
  );
}
