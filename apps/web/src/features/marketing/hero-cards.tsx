import { Check, Sparkle } from 'lucide-react';
import { Button, cn } from '@marketpilot/ui';

export function ApprovalCard({ className }: { className?: string }) {
  return (
    <div className={cn('rounded-lg border border-line bg-surface p-3', className)}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-label font-bold">Saturday reel</span>
        <span className="rounded-full bg-highlight px-2 py-0.5 text-caption font-bold text-highlight-on">Needs you</span>
      </div>
      <div className="mk-tile-ink mb-2 flex h-thumb items-end rounded-md p-3 font-display text-heading font-extrabold leading-tight">
        Wedding boxes from ₹499
      </div>
      <p className="mb-3 text-caption text-ink-secondary">
        Wedding guests coming? Our kaju katli is made fresh every morning.
      </p>
      <div className="flex gap-2">
        <Button className="min-h-touch flex-1 font-bold" tabIndex={-1}>
          Approve
        </Button>
        <Button variant="secondary" className="min-h-touch" tabIndex={-1}>
          Edit
        </Button>
      </div>
    </div>
  );
}

export function SafetyCard({ className }: { className?: string }) {
  return (
    <div className={cn('flex flex-col gap-1 rounded-lg border border-line bg-surface px-3 py-3 text-caption text-ink-secondary', className)}>
      <span className="flex items-center gap-2 font-bold text-ink">
        <Check className="size-4 text-success" strokeWidth={2.4} />
        Checked before posting
      </span>
      <span>Price matches your menu</span>
      <span>No risky claims</span>
    </div>
  );
}

const learnt = ['Tone: warm', 'Hindi + English', 'Best at 6 pm', '12 products'];

export function LearntCard({ className }: { className?: string }) {
  return (
    <div className={cn('rounded-xl border border-line bg-surface p-4 text-left shadow-card', className)}>
      <span className="mb-3 flex items-center gap-2 text-label font-bold">
        <Sparkle className="size-4 text-accent" strokeWidth={2} />
        Learnt your shop
      </span>
      <div className="flex flex-wrap gap-2 text-caption">
        {learnt.map((fact) => (
          <span key={fact} className="rounded-sm bg-subtle px-2 py-1">
            {fact}
          </span>
        ))}
      </div>
    </div>
  );
}
