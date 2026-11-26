'use client';

import { useState } from 'react';
import { Facebook, Instagram, MessageCircle, ShieldCheck } from 'lucide-react';
import { CHANNELS, CUSTOMER_REACH, questionStepSchema, type OnboardingState } from '@marketpilot/contracts';
import { ChoiceCard, FieldGroup, Input, PillToggle, SegmentedControl } from '@marketpilot/ui';
import { BUDGET_CHIPS, GOAL_CARDS, REACH_HELP } from './setup-copy';
import { StepFrame } from './step-frame';
import { useStepSubmit } from './use-step-submit';

const channelIcons: Record<string, typeof Instagram> = { instagram: Instagram, facebook: Facebook, whatsapp: MessageCircle };

type Budget = (typeof BUDGET_CHIPS)[number]['value'];

interface Saved {
  primary_objective?: string;
  customer_reach?: string;
  preferred_channels?: string[];
  monthly_budget?: number;
}

function budgetChipFor(amount: number | undefined): Budget | null {
  if (amount === undefined) return null;
  return BUDGET_CHIPS.find((chip) => chip.amount === amount)?.value ?? 'custom';
}

export function GoalsStep({ state }: { state: OnboardingState }) {
  const saved = (state.answers.goals ?? {}) as Saved;
  const track = state.track;
  const goals = GOAL_CARDS[track];
  const { submit, saving, fieldErrors, setFieldErrors, formError } = useStepSubmit('goals');
  const [goal, setGoal] = useState(saved.primary_objective ?? state.known.primaryObjective ?? '');
  const [reach, setReach] = useState(saved.customer_reach ?? 'local');
  const [channels, setChannels] = useState<string[]>(saved.preferred_channels ?? []);
  const [budget, setBudget] = useState<Budget | null>(budgetChipFor(saved.monthly_budget));
  const [customAmount, setCustomAmount] = useState(
    budgetChipFor(saved.monthly_budget) === 'custom' ? String(saved.monthly_budget ?? '') : '',
  );

  const clear = (key: string) => setFieldErrors(({ [key]: _cleared, ...rest }) => rest);

  function onSubmit() {
    const errors: Record<string, string> = {};
    let monthlyBudget: number | undefined;
    if (budget === 'custom') {
      const text = customAmount.replace(/[,\s₹]/g, '');
      if (!/^\d+$/.test(text)) errors.monthly_budget = 'Enter a whole number, like 10000';
      else monthlyBudget = Number(text);
    } else if (budget) {
      monthlyBudget = BUDGET_CHIPS.find((chip) => chip.value === budget)?.amount ?? undefined;
    }
    const answers: Record<string, unknown> = {
      primary_objective: goal,
      customer_reach: reach,
      preferred_channels: channels,
      ...(monthlyBudget !== undefined && { monthly_budget: monthlyBudget }),
    };
    const parsed = questionStepSchema('goals', track).safeParse(answers);
    if (!parsed.success) for (const issue of parsed.error.issues) errors[String(issue.path[0])] ??= issue.message;
    setFieldErrors(errors);
    if (Object.keys(errors).length === 0) submit(answers);
  }

  return (
    <StepFrame
      step="goals"
      title={track === 'business' ? 'What should marketing do for you?' : 'What do you want from posting?'}
      description="We shape your plan around this. You can change it any time."
      error={formError}
      saving={saving}
      submitLabel="Finish"
      onSubmit={onSubmit}
    >
      <FieldGroup legend="Main goal" error={fieldErrors.primary_objective}>
        <div className="grid gap-3 md:grid-cols-2">
          {goals.map((option) => (
            <ChoiceCard
              key={option.value}
              size="lg"
              type="radio"
              name="goal"
              value={option.value}
              checked={goal === option.value}
              onChange={() => {
                setGoal(option.value);
                clear('primary_objective');
              }}
              title={option.title}
              description={option.description}
            />
          ))}
        </div>
      </FieldGroup>

      <FieldGroup legend={track === 'business' ? 'Where are your customers?' : 'Where is your audience?'} error={fieldErrors.customer_reach}>
        <SegmentedControl
          label="Where your customers are"
          options={CUSTOMER_REACH}
          value={reach}
          onChange={setReach}
          className="grid h-auto w-full grid-cols-2 rounded-lg p-1 md:grid-cols-4 [&>button]:min-h-touch [&>button]:rounded-md [&>button]:text-body [&>button]:font-semibold"
        />
        <p className="text-body text-ink-tertiary">{REACH_HELP[reach]}</p>
      </FieldGroup>

      <FieldGroup legend="Where should we post?" error={fieldErrors.preferred_channels}>
        <div className="grid gap-3 md:grid-cols-3">
          {CHANNELS.map((channel) => {
            const Icon = channelIcons[channel.value] ?? MessageCircle;
            return (
              <ChoiceCard
                key={channel.value}
                type="checkbox"
                name="channels"
                value={channel.value}
                checked={channels.includes(channel.value)}
                onChange={() => {
                  setChannels((current) =>
                    current.includes(channel.value) ? current.filter((c) => c !== channel.value) : [...current, channel.value],
                  );
                  clear('preferred_channels');
                }}
                icon={<Icon className="size-5" strokeWidth={2} aria-hidden="true" />}
                title={channel.label}
                className="items-center rounded-lg border-line-strong text-heading"
              />
            );
          })}
        </div>
        <p className="text-body text-ink-tertiary">YouTube, LinkedIn and Google Business Profile are coming soon.</p>
      </FieldGroup>

      <FieldGroup legend="Monthly budget for ads (optional)" error={fieldErrors.monthly_budget}>
        <PillToggle
          label="Monthly budget for ads"
          layout="chips"
          options={BUDGET_CHIPS.map((chip) => ({ value: chip.value, label: chip.label }))}
          value={budget}
          onChange={(value) => {
            setBudget(value);
            clear('monthly_budget');
          }}
        />
        {budget === 'custom' ? (
          <div className="flex h-control-lg max-w-xs items-center overflow-hidden rounded-lg border border-line-strong bg-surface focus-within:ring-2 focus-within:ring-accent focus-within:ring-offset-2 focus-within:ring-offset-canvas">
            <span className="flex h-full items-center border-r border-line px-4 text-lead font-semibold">₹</span>
            <Input
              aria-label="Monthly ad budget in rupees"
              inputMode="numeric"
              value={customAmount}
              onChange={(event) => {
                setCustomAmount(event.target.value);
                clear('monthly_budget');
              }}
              placeholder="10,000"
              className="h-full rounded-none border-0 text-lead tabular-nums focus-visible:ring-0"
            />
          </div>
        ) : null}
        <p className="flex items-start gap-3 rounded-lg bg-subtle p-4 text-body text-ink-secondary">
          <ShieldCheck className="mt-0.5 size-5 shrink-0" strokeWidth={2} aria-hidden="true" />
          This is only for paid ads. Your posts do not need it, and we never spend anything without your approval.
        </p>
      </FieldGroup>
    </StepFrame>
  );
}
