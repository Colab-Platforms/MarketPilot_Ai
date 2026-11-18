import { Fragment } from 'react';
import {
  Cake,
  Coffee,
  Dumbbell,
  Gem,
  GraduationCap,
  Play,
  Scissors,
  ShoppingBag,
  Shirt,
  Stethoscope,
  Store,
  Utensils,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Badge, cn } from '@marketpilot/ui';

type Tone = 'accent' | 'info' | 'success' | 'warning' | 'danger' | 'neutral';

const toneClasses: Record<Tone, string> = {
  accent: 'bg-accent-subtle text-accent',
  info: 'bg-info-subtle text-info',
  success: 'bg-success-subtle text-success',
  warning: 'bg-warning-subtle text-warning',
  danger: 'bg-danger-subtle text-danger',
  neutral: 'bg-subtle text-ink-secondary',
};

interface TileData {
  category: string;
  icon: LucideIcon;
  headline: string;
  tone: Tone;
  isReel?: boolean;
}

function Tile({ category, icon: Icon, headline, tone, isReel }: TileData) {
  return (
    <div
      className={cn(
        'flex h-tile w-tile shrink-0 flex-col justify-between rounded-md border border-line p-3',
        toneClasses[tone],
      )}
    >
      <Badge className="self-start bg-surface text-ink-secondary">{category}</Badge>
      <Icon className="size-8" strokeWidth={1.5} aria-hidden="true" />
      <div>
        <p className="font-display text-heading text-ink">{headline}</p>
        <p className="mt-1 flex items-center gap-1 text-caption text-ink-secondary">
          {isReel ? <Play className="size-4" strokeWidth={1.5} aria-hidden="true" /> : null}
          {isReel ? 'Reel' : 'Post'} · sample
        </p>
      </div>
    </div>
  );
}

const rowOne: TileData[] = [
  { category: 'Food', icon: Utensils, headline: 'Jowar rolls are back this weekend', tone: 'warning', isReel: true },
  { category: 'Salon', icon: Scissors, headline: 'Festive hair and glow, booked early', tone: 'danger' },
  { category: 'Jewellery', icon: Gem, headline: 'New temple-style collection', tone: 'accent', isReel: true },
  { category: 'Coaching', icon: GraduationCap, headline: 'Weekend batch opens Monday', tone: 'info' },
  { category: 'Clinic', icon: Stethoscope, headline: 'Three habits for healthier teeth', tone: 'success', isReel: true },
  { category: 'Fashion', icon: Shirt, headline: 'Cotton kurtas for hot days', tone: 'neutral' },
  { category: 'Bakery', icon: Cake, headline: 'Order your Diwali boxes now', tone: 'warning', isReel: true },
  { category: 'Retail', icon: Store, headline: 'Open late all week', tone: 'info' },
];

const rowTwo: TileData[] = [
  { category: 'Cafe', icon: Coffee, headline: 'Monsoon menu, now pouring', tone: 'accent', isReel: true },
  { category: 'Fitness', icon: Dumbbell, headline: 'Join before the month ends', tone: 'success' },
  { category: 'Gifting', icon: ShoppingBag, headline: 'Hampers made your way', tone: 'danger', isReel: true },
  { category: 'Food', icon: Utensils, headline: 'Thali of the day', tone: 'warning' },
  { category: 'Fashion', icon: Shirt, headline: 'Wedding season edit', tone: 'info', isReel: true },
  { category: 'Salon', icon: Scissors, headline: 'Meet our new stylist', tone: 'neutral' },
  { category: 'Jewellery', icon: Gem, headline: 'Gold you can gift', tone: 'accent' },
  { category: 'Coaching', icon: GraduationCap, headline: 'Free demo class on Saturday', tone: 'success', isReel: true },
];

export const sampleRows = [rowOne, rowTwo].map((tiles, index) => (
  <Fragment key={index}>
    {tiles.map((tile) => (
      <Tile key={tile.headline} {...tile} />
    ))}
  </Fragment>
));
