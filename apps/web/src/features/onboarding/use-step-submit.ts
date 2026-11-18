import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { OnboardingStep } from '@marketpilot/contracts';
import { ApiError } from '@/lib/api-client';
import { useSaveStep } from './onboarding-api';

// Shared by every step: runs the save, maps server field errors back onto the
// form, and moves on to the next screen.
export function useStepSubmit(step: OnboardingStep) {
  const router = useRouter();
  const save = useSaveStep(step);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  function submit(payload: unknown) {
    setFormError(null);
    save.mutate(payload, {
      onSuccess: (state) => {
        const next = state.steps[state.steps.indexOf(step) + 1];
        router.push(next ? `/onboarding/${next}` : '/onboarding/done');
      },
      onError: (error) => {
        if (error instanceof ApiError && Object.keys(error.fields).length > 0) {
          setFieldErrors(error.fields);
          return;
        }
        setFormError(error instanceof ApiError ? error.message : 'Something went wrong. Try again.');
      },
    });
  }

  return { submit, saving: save.isPending, fieldErrors, setFieldErrors, formError };
}
