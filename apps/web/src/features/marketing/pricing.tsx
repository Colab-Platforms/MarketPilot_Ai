'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Check } from 'lucide-react';
import { Button, PillToggle, cn } from '@marketpilot/ui';
import { CreditEstimator } from './credit-estimator';
import { YEARLY_MONTHS_CHARGED, formatRupees, plans, type Plan } from './pricing-data';
import { Container, SectionIntro } from './section';

type Billing = 'monthly' | 'yearly';

const billingOptions = [
  { value: 'monthly', label: 'Monthly' },
  {
    value: 'yearly',
    ariaLabel: 'Yearly, 2 months free',
    label: (
      <>
        Yearly
        <span className="rounded-full bg-highlight-subtle px-2 py-0.5 text-caption font-bold text-highlight-text">2 months free</span>
      </>
    ),
  },
] as const;

function PlanCard({ plan, billing }: { plan: Plan; billing: Billing }) {
  const yearly = billing === 'yearly';
  const price = yearly ? plan.monthlyPrice * YEARLY_MONTHS_CHARGED : plan.monthlyPrice;
  return (
    <div
      className={cn(
        'flex flex-col gap-4 rounded-2xl bg-surface px-6 py-6',
        plan.recommended ? 'border-2 border-highlight ring-8 ring-highlight-subtle' : 'border border-line',
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-display text-title font-bold">{plan.name}</h3>
        {plan.recommended ? (
          <span className="rounded-full bg-highlight px-3 py-1 text-caption font-bold text-highlight-on">Recommended</span>
        ) : null}
      </div>
      <p className="m-0 flex flex-wrap items-baseline gap-1">
        {plan.fromPrice ? <span className="text-body font-semibold">from</span> : null}
        <span className="font-display text-stat">{formatRupees(price)}</span>
        <span className="text-body text-ink-tertiary">{yearly ? '/yr' : '/mo'}</span>
      </p>
      <span className="text-body text-ink-secondary">{plan.allowance}</span>
      <ul className="m-0 flex flex-1 list-none flex-col gap-2 p-0">
        {plan.features.map((feature) => (
          <li key={feature} className="flex gap-3 text-body">
            <Check className="mt-0.5 size-4 shrink-0" strokeWidth={2.2} aria-hidden="true" />
            {feature}
          </li>
        ))}
      </ul>
      <Button asChild size="lg" variant={plan.recommended ? 'primary' : 'secondary'} className="rounded-lg font-bold">
        <Link href="/register">
          {plan.cta}
          <span className="sr-only"> with {plan.name}</span>
        </Link>
      </Button>
    </div>
  );
}

export function Pricing() {
  const [billing, setBilling] = useState<Billing>('monthly');
  return (
    <section id="pricing" aria-labelledby="pricing-title" className="scroll-mt-4 bg-canvas py-16 md:py-24">
      <Container className="flex flex-col gap-8">
        <SectionIntro
          titleId="pricing-title"
          title={
            <>
              In rupees, with UPI. <span className="whitespace-nowrap">No surprises.</span>
            </>
          }
          aside={<PillToggle label="Billing period" options={billingOptions} value={billing} onChange={setBilling} />}
        />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {plans.map((plan) => (
            <PlanCard key={plan.name} plan={plan} billing={billing} />
          ))}
        </div>
        <CreditEstimator />
      </Container>
    </section>
  );
}
