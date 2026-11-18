import { BarChart3, Check, Clock, Facebook, Film, Image as ImageIcon, Instagram, MessageCircle, Sparkles, Type } from 'lucide-react';
import { Badge, Button, cn } from '@marketpilot/ui';

const days = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const cellTones = ['bg-accent-subtle', 'bg-info-subtle', 'bg-warning-subtle', 'bg-success-subtle', 'bg-danger-subtle'];

export function PlanVisual() {
  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <p className="text-label text-ink-secondary">This month</p>
        <Badge tone="accent">14 posts scheduled</Badge>
      </div>
      <div className="mt-3 grid grid-cols-7 gap-2">
        {days.map((day, index) => (
          <p key={index} className="text-center text-caption text-ink-tertiary">
            {day}
          </p>
        ))}
        {Array.from({ length: 14 }, (_, index) => (
          <div
            key={index}
            className={cn(
              'flex aspect-square items-center justify-center rounded-sm border border-line text-ink-secondary',
              cellTones[index % cellTones.length],
            )}
          >
            {index < 5 ? (
              <Check className="size-4" strokeWidth={1.5} />
            ) : (
              <Clock className="size-4" strokeWidth={1.5} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export function ApproveVisual() {
  return (
    <div inert>
      <div className="flex items-center justify-between gap-2">
        <p className="text-label text-ink">Needs your approval</p>
        <Badge tone="info">
          <Sparkles className="size-4" strokeWidth={1.5} />
          AI draft
        </Badge>
      </div>
      <p className="mt-3 text-body text-ink-secondary">
        Order your Diwali boxes by Friday. We deliver across the city.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm">Approve</Button>
        <Button size="sm" variant="secondary">
          Edit
        </Button>
        <Button size="sm" variant="ghost">
          Reject
        </Button>
      </div>
    </div>
  );
}

const outputs = [
  { icon: Type, label: 'Captions' },
  { icon: ImageIcon, label: 'Images' },
  { icon: Film, label: 'Short reels' },
];

export function CreateVisual() {
  return (
    <div inert>
      <ul className="m-0 grid list-none gap-2 p-0">
        {outputs.map(({ icon: Icon, label }) => (
          <li key={label} className="flex items-center justify-between gap-2 rounded-sm border border-line bg-surface p-2">
            <span className="flex items-center gap-2 text-label text-ink">
              <Icon className="size-4 text-accent" strokeWidth={1.5} />
              {label}
            </span>
            <Badge tone="success">Ready</Badge>
          </li>
        ))}
      </ul>
      <Button size="sm" className="mt-3">
        <Sparkles className="size-4" strokeWidth={1.5} />
        Generate · 1 credit
      </Button>
    </div>
  );
}

export function PublishVisual() {
  return (
    <ul className="m-0 grid list-none gap-2 p-0">
      <li className="flex items-center justify-between gap-2 rounded-sm border border-line bg-surface p-2">
        <span className="flex items-center gap-2 text-label text-ink">
          <Instagram className="size-4" strokeWidth={1.5} /> Instagram
        </span>
        <Badge tone="success">
          <Check className="size-4" strokeWidth={1.5} /> Published
        </Badge>
      </li>
      <li className="flex items-center justify-between gap-2 rounded-sm border border-line bg-surface p-2">
        <span className="flex items-center gap-2 text-label text-ink">
          <Facebook className="size-4" strokeWidth={1.5} /> Facebook
        </span>
        <Badge tone="accent">
          <Clock className="size-4" strokeWidth={1.5} /> Scheduled
        </Badge>
      </li>
      <li className="flex items-center justify-between gap-2 rounded-sm border border-line bg-surface p-2">
        <span className="flex items-center gap-2 text-label text-ink-secondary">
          <MessageCircle className="size-4" strokeWidth={1.5} /> WhatsApp
        </span>
        <Badge>Coming later</Badge>
      </li>
    </ul>
  );
}

export function LearnVisual() {
  return (
    <div>
      <div className="flex items-end gap-2" aria-hidden="true">
        <div className="h-8 flex-1 rounded-sm bg-muted" />
        <div className="h-12 flex-1 rounded-sm bg-muted" />
        <div className="h-16 flex-1 rounded-sm bg-accent" />
      </div>
      <p className="mt-3 flex items-start gap-2 text-label text-ink">
        <BarChart3 className="mt-0.5 size-4 shrink-0 text-accent" strokeWidth={1.5} />
        Short reels reached more people than photos this week.
      </p>
      <p className="mt-1 text-caption text-ink-tertiary">Sample insight</p>
    </div>
  );
}

const memoryFacts = [
  'Tone: warm and friendly',
  'Offer: free delivery above ₹500',
  'Festival: Diwali sale in 3 weeks',
  'Languages: Hindi and English',
  'Best time to post: 6:30 pm',
  'Never say: “guaranteed results”',
];

export function BrainVisual() {
  return (
    <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
      {memoryFacts.map((fact) => (
        <li key={fact}>
          <Badge className="h-8 bg-surface px-3 text-label text-ink">{fact}</Badge>
        </li>
      ))}
    </ul>
  );
}
