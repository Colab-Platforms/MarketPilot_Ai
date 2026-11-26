import { Check } from 'lucide-react';
import { cn } from '@marketpilot/ui';

// Sample cards for the sign-in product tour. They stay light in both themes, like printed cards.
const card = 'rounded-xl bg-tile-white text-tile-ink shadow-window';

// Day of month -> what is planned. 'f' is the festival.
const planned: Record<number, 'post' | 'f'> = {
  2: 'post', 4: 'post', 6: 'post', 9: 'post', 11: 'post', 13: 'post', 16: 'post',
  18: 'post', 19: 'post', 23: 'post', 25: 'f', 27: 'post',
};

const weekdays = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

function dayClass(day: number) {
  const kind = planned[day];
  if (kind === 'f') return 'bg-highlight text-highlight-on';
  if (kind === 'post') return 'bg-tile-navy text-tile-white';
  return 'bg-tile-mist text-tile-mute';
}

export function PlanCard({ compact }: { compact?: boolean }) {
  const days = compact ? Array.from({ length: 14 }, (_, i) => i + 14) : Array.from({ length: 27 }, (_, i) => i + 1);
  return (
    <div className={cn(card, compact ? 'w-full p-3' : 'w-full max-w-form p-6')}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className={cn('font-semibold', compact ? 'text-caption' : 'text-heading')}>December plan</span>
        <span className="rounded-full bg-highlight px-3 py-1 text-caption font-bold text-highlight-on">Christmas · 25 Dec</span>
      </div>
      <div className="mb-1 grid grid-cols-7 gap-1 text-center text-caption font-bold text-tile-mute">
        {weekdays.map((d, i) => (
          <span key={i}>{d}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {compact ? null : <span />}
        {days.map((day) => (
          <span
            key={day}
            className={cn(
              'flex items-center justify-center rounded-md text-caption font-bold',
              compact ? 'h-6 rounded-sm' : 'aspect-square',
              dayClass(day),
            )}
          >
            {day}
          </span>
        ))}
      </div>
      {compact ? null : (
        <div className="mt-3 flex gap-3 text-caption text-tile-mute">
          <span className="flex items-center gap-2">
            <span className="size-3 rounded-sm bg-tile-navy" />
            Post
          </span>
          <span className="flex items-center gap-2">
            <span className="size-3 rounded-sm bg-highlight" />
            Festival
          </span>
          <span className="ml-auto">Best time · 6 pm</span>
        </div>
      )}
    </div>
  );
}

export function CreateCard({ compact }: { compact?: boolean }) {
  if (compact) {
    return (
      <div className={cn(card, 'flex w-full gap-3 p-3')}>
        <span className="flex h-thumb w-24 shrink-0 items-end rounded-lg bg-tile-ink p-3 text-body font-semibold leading-tight text-highlight">
          Wedding boxes from ₹499
        </span>
        <span className="flex flex-col gap-2 text-caption text-tile-mute">
          <b className="text-tile-ink">sharmasweets</b>
          Shaadi season is here! Fresh kaju katli boxes, packed the same morning.
        </span>
      </div>
    );
  }
  return (
    <div className={cn(card, 'flex w-full max-w-sm flex-col gap-3 p-4')}>
      <div className="flex items-center gap-3">
        <span className="flex size-8 items-center justify-center rounded-full bg-tile-ink text-caption font-bold text-highlight">SS</span>
        <b className="text-body">sharmasweets</b>
        <span className="ml-auto rounded-full bg-tile-mist px-2 py-1 text-caption font-bold">Hindi · EN</span>
      </div>
      <div className="flex h-tile flex-col justify-end gap-2 rounded-xl bg-tile-ink p-4 text-tile-white">
        <span className="font-display text-title font-bold leading-tight text-highlight">Wedding boxes from ₹499</span>
        <span className="text-body opacity-80">Order on WhatsApp</span>
      </div>
      <span className="text-body text-tile-mute">
        Shaadi season is here! Fresh kaju katli boxes for your guests, packed the same morning.
      </span>
    </div>
  );
}

export function ApproveCard({ compact }: { compact?: boolean }) {
  return (
    <div className={cn(card, 'flex w-full flex-col', compact ? 'gap-2 p-3' : 'max-w-sm gap-3 p-4')}>
      <div className="flex items-center justify-between">
        <b className={compact ? 'text-caption' : 'text-body'}>Saturday reel</b>
        <span className="rounded-full bg-highlight px-2 py-1 text-caption font-bold text-highlight-on">Needs you</span>
      </div>
      {compact ? null : (
        <div className="flex h-thumb items-end rounded-lg bg-tile-ink p-4 font-display text-title font-bold leading-none text-highlight">
          Wedding boxes from ₹499
        </div>
      )}
      <span className="flex items-center gap-1 text-caption font-semibold text-success">
        <Check className="size-4" strokeWidth={2.4} aria-hidden="true" />
        Price matches your menu
      </span>
      <div className="flex gap-2">
        <span className="flex-1 rounded-md bg-tile-navy py-2 text-center text-label font-bold text-tile-white">Approve</span>
        <span className="rounded-md border border-tile-mist px-4 py-2 text-label font-semibold">Edit</span>
      </div>
    </div>
  );
}

// Bar heights for Monday to Sunday; Saturday (index 5) is the highlighted best day.
const barHeight = ['h-1/3', 'h-1/2', 'h-2/5', 'h-3/5', 'h-3/5', 'h-full', 'h-3/4'];

export function ResultsCard({ compact }: { compact?: boolean }) {
  return (
    <div className={cn(card, 'flex w-full flex-col', compact ? 'gap-2 p-3' : 'max-w-sm gap-4 p-6')}>
      {compact ? null : <b className="text-title font-semibold">Your week, in plain words</b>}
      <div className={cn('flex items-end gap-2', compact ? 'h-16' : 'h-chart-sm')}>
        {barHeight.map((height, i) => (
          <div key={i} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
            <div className={cn('w-full rounded-sm', height, i === 5 ? 'bg-highlight' : 'bg-tile-mist')} />
            {compact ? null : <span className="text-caption text-tile-mute">{'MTWTFSS'[i]}</span>}
          </div>
        ))}
      </div>
      <span className={cn('rounded-lg bg-tile-mist', compact ? 'px-2 py-1 text-caption' : 'px-4 py-3 text-body')}>
        Saturday&apos;s reel brought <b>41 profile visits</b>, your best this month.
      </span>
    </div>
  );
}
