import { cn } from '@marketpilot/ui';
import { tileClass, type TileTone } from './tiles';

const grid: { label: string; tone: TileTone }[] = [
  { label: 'Fresh today', tone: 'ink' },
  { label: 'Wedding boxes', tone: 'sky' },
  { label: 'Plum cake', tone: 'navy' },
  { label: 'Meet the team', tone: 'ink' },
  { label: 'Sunday saver', tone: 'sky' },
  { label: 'New in', tone: 'navy' },
  { label: 'Open late', tone: 'ink' },
  { label: 'Gift packs', tone: 'sky' },
  { label: 'Thank you!', tone: 'navy' },
  { label: 'Diwali recap', tone: 'ink' },
  { label: 'Our kitchen', tone: 'sky' },
  { label: 'Kaju katli', tone: 'navy' },
];

// The sample shop's Instagram profile, the way customers will see it.
export function HeroPhone({ className }: { className?: string }) {
  return (
    <div className={cn('w-phone rounded-2xl bg-tile-ink p-2 shadow-window', className)}>
      <div className="flex flex-col overflow-hidden rounded-xl bg-tile-white text-tile-ink">
        <div className="flex h-6 items-center justify-center">
          <span className="h-3 w-16 rounded-full bg-tile-ink" />
        </div>
        <div className="px-3 pb-2 text-label font-bold">@sharmasweets</div>
        <div className="flex items-center gap-3 px-3 pb-3">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-full border-2 border-highlight bg-tile-ink text-label font-extrabold text-highlight">
            SS
          </span>
          <div className="flex flex-1 justify-around text-center text-caption">
            <span className="flex flex-col">
              <b className="text-label">12</b>posts
            </span>
            <span className="flex flex-col">
              <b className="text-label">1,284</b>followers
            </span>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-px">
          {grid.map((tile) => (
            <div key={tile.label} className={cn('relative aspect-square', tileClass[tile.tone])}>
              <span className="absolute inset-x-1 bottom-1 font-display text-caption font-extrabold leading-none">
                {tile.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
