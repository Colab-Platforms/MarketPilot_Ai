import { BarChart3, CalendarDays, Check, Instagram } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Badge } from '@marketpilot/ui';

type BadgeTone = 'neutral' | 'accent' | 'info' | 'success';

const entries: { icon: LucideIcon; time: string; text: string; tone: BadgeTone; status: string }[] = [
  { icon: CalendarDays, time: '7:00 am', text: 'Your plan for the week is ready', tone: 'neutral', status: 'Planned' },
  { icon: Check, time: '9:10 am', text: 'You approved 3 posts', tone: 'accent', status: 'Approved' },
  { icon: Instagram, time: '6:30 pm', text: 'Reel went live on Instagram', tone: 'success', status: 'Published' },
  { icon: BarChart3, time: '9:00 pm', text: 'Today’s results are in', tone: 'info', status: 'Report ready' },
];

export function FlightLog() {
  return (
    <figure className="m-0">
      <div className="rounded-lg border border-line bg-surface p-6 shadow-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-heading">Today’s flight log</p>
          <Badge>Sample day</Badge>
        </div>
        <ol className="relative ml-4 mt-6 list-none border-l border-line p-0">
          {entries.map(({ icon: Icon, time, text, tone, status }) => (
            <li key={text} className="relative pb-6 pl-6 last:pb-0">
              <span className="absolute -left-4 top-0 flex size-8 items-center justify-center rounded-full border border-line bg-subtle text-accent">
                <Icon className="size-4" strokeWidth={1.5} aria-hidden="true" />
              </span>
              <p className="text-caption text-ink-tertiary">{time}</p>
              <p className="mt-0.5 text-label text-ink">{text}</p>
              <Badge tone={tone} className="mt-2">
                {status}
              </Badge>
            </li>
          ))}
        </ol>
      </div>
      <figcaption className="mt-3 text-caption text-ink-tertiary">
        An example of what a day looks like once MarketPilot is running.
      </figcaption>
    </figure>
  );
}
