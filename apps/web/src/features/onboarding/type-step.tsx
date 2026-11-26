'use client';

import { useState } from 'react';
import { BriefcaseBusiness, Store, UserRound } from 'lucide-react';
import { type AccountType, type OnboardingState } from '@marketpilot/contracts';
import { ChoiceCard, FieldGroup } from '@marketpilot/ui';
import { StepFrame } from './step-frame';
import { useStepSubmit } from './use-step-submit';

const iconClass = 'size-6';

export function TypeStep({ state }: { state: OnboardingState }) {
  const alreadyChosen = state.completedSteps.includes('type');
  const [choice, setChoice] = useState<AccountType | null>(alreadyChosen ? state.track : null);
  const [error, setError] = useState<string | undefined>();
  const { submit, saving, formError } = useStepSubmit('type');

  function pick(value: AccountType) {
    setChoice(value);
    setError(undefined);
  }

  function onSubmit() {
    if (!choice) {
      setError('Choose the option that fits you best');
      return;
    }
    submit({ accountType: choice });
  }

  return (
    <StepFrame
      step="type"
      title="How will you use MarketPilot?"
      description="This sets up the right questions for you. You can change it later in Settings."
      error={formError}
      saving={saving}
      onSubmit={onSubmit}
    >
      <FieldGroup legend="I am setting this up for" error={error}>
        <div className="flex flex-col gap-3">
          <ChoiceCard
            size="lg"
            type="radio"
            name="accountType"
            value="business"
            checked={choice === 'business'}
            onChange={() => pick('business')}
            icon={<Store className={iconClass} strokeWidth={1.8} aria-hidden="true" />}
            title="A business"
            description="A shop, restaurant, salon, clinic or any business that sells to customers."
          />
          <ChoiceCard
            size="lg"
            type="radio"
            name="accountType"
            value="creator"
            checked={choice === 'creator'}
            onChange={() => pick('creator')}
            icon={<UserRound className={iconClass} strokeWidth={1.8} aria-hidden="true" />}
            title="Myself, as a creator"
            description="An influencer, coach, artist or expert growing an audience."
          />
          <ChoiceCard
            size="lg"
            type="radio"
            name="accountType"
            value="agency"
            disabled
            icon={<BriefcaseBusiness className={iconClass} strokeWidth={1.8} aria-hidden="true" />}
            title="An agency, for my clients"
            badge={<span className="rounded-full bg-subtle px-2 text-caption font-semibold text-ink-secondary">Coming soon</span>}
            description="You manage marketing for other businesses. You can add more brands later."
          />
        </div>
      </FieldGroup>
    </StepFrame>
  );
}
