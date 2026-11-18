import type { Metadata } from 'next';
import { StepScreen } from '@/features/onboarding/step-screen';

export const metadata: Metadata = { title: 'Set up your workspace' };

export default async function OnboardingStepPage({ params }: { params: Promise<{ step: string }> }) {
  const { step } = await params;
  return <StepScreen rawStep={step} />;
}
