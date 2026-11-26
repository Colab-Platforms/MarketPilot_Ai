'use client';

import { useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import { Button, Progress } from '@marketpilot/ui';
import { creditActions, formatRupees, plans, type CreditActionId } from './pricing-data';

const MAX_PER_ACTION = 99;

const initialCounts = Object.fromEntries(creditActions.map((a) => [a.id, a.initial])) as Record<CreditActionId, number>;

export function CreditEstimator() {
  const [counts, setCounts] = useState(initialCounts);
  const total = creditActions.reduce((sum, a) => sum + counts[a.id] * a.credits, 0);
  const fit = plans.find((p) => p.credits >= total);

  function change(id: CreditActionId, by: number) {
    setCounts((prev) => ({ ...prev, [id]: Math.min(MAX_PER_ACTION, Math.max(0, prev[id] + by)) }));
  }

  return (
    <div className="flex flex-col gap-6 rounded-2xl border border-line bg-surface p-4 md:p-8 lg:flex-row lg:items-center">
      <div className="flex flex-1 flex-col gap-2" aria-live="polite">
        <h3 className="font-display text-title font-extrabold md:text-display">Which plan fits my shop?</h3>
        <span className="font-display text-stat text-accent">{total.toLocaleString('en-IN')} credits</span>
        <Progress value={total} max={fit?.credits ?? total} label="Credits used by your plan" tone="highlight" className="h-2 bg-subtle" />
        <span className="text-body font-semibold">
          {fit
            ? `Fits ${fit.name}: ${total.toLocaleString('en-IN')} of ${fit.credits.toLocaleString('en-IN')} credits, ${fit.fromPrice ? 'from ' : ''}${formatRupees(fit.monthlyPrice)} a month`
            : 'More than our largest plan. Talk to us about a custom one.'}
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-2">
        {creditActions.map((action) => (
          <div key={action.id} className="flex items-center gap-3 rounded-lg bg-subtle px-3 py-2">
            <span className="flex flex-1 flex-col">
              <span className="text-body font-semibold">{action.label}</span>
              <span className="text-caption text-ink-tertiary">{action.credits} credits each</span>
            </span>
            <Button
              variant="secondary"
              className="min-h-touch w-12 px-0"
              aria-label={`Fewer ${action.label.toLowerCase()}`}
              disabled={counts[action.id] === 0}
              onClick={() => change(action.id, -1)}
            >
              <Minus className="size-5" strokeWidth={2} aria-hidden="true" />
            </Button>
            <span className="w-8 text-center text-heading font-bold tabular-nums">{counts[action.id]}</span>
            <Button
              className="min-h-touch w-12 px-0"
              aria-label={`More ${action.label.toLowerCase()}`}
              disabled={counts[action.id] === MAX_PER_ACTION}
              onClick={() => change(action.id, 1)}
            >
              <Plus className="size-5" strokeWidth={2} aria-hidden="true" />
            </Button>
          </div>
        ))}
        <span className="text-caption text-ink-tertiary">
          Indicative launch pricing, GST included. Every action shows its credit cost before you confirm.
        </span>
      </div>
    </div>
  );
}
