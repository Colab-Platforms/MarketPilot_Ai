'use client';

import { useState } from 'react';
import { Store, UserRound } from 'lucide-react';
import { type AccountType, type OnboardingState } from '@marketpilot/contracts';
import { ChoiceCard, FieldGroup } from '@marketpilot/ui';
import { StepFrame } from './step-frame';
import { useStepSubmit } from './use-step-submit';

export function TypeStep({ state }: { state: OnboardingState }) {
  const alreadyChosen = state.completedSteps.includes('type');
  const [choice, setChoice] = useState<AccountType | null>(alreadyChosen ? state.track : null);
  const [error, setError] = useState<string | undefined>();
  const { submit, saving, formError } = useStepSubmit('type');

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
      description="This sets up the right questions for you. You can change your answer later."
      error={formError}
      saving={saving}
      onSubmit={onSubmit}
    >
      <FieldGroup legend="I am setting this up for" error={error}>
        <div className="grid gap-3 md:grid-cols-2">
          <ChoiceCard
            type="radio"
            name="accountType"
            value="business"
            checked={choice === 'business'}
            onChange={() => {
              setChoice('business');
              setError(undefined);
            }}
            icon={<Store className="size-5" strokeWidth={1.5} aria-hidden="true" />}
            title="A business"
            description="A shop, restaurant, salon, agency or any company that sells to customers."
          />
          <ChoiceCard
            type="radio"
            name="accountType"
            value="creator"
            checked={choice === 'creator'}
            onChange={() => {
              setChoice('creator');
              setError(undefined);
            }}
            icon={<UserRound className="size-5" strokeWidth={1.5} aria-hidden="true" />}
            title="Myself, as a creator"
            description="An influencer, personal brand, coach or expert growing an audience."
          />
        </div>
      </FieldGroup>
    </StepFrame>
  );
}
