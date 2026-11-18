import type { Metadata } from 'next';
import { DoneScreen } from '@/features/onboarding/done-screen';

export const metadata: Metadata = { title: 'All set' };

export default function OnboardingDonePage() {
  return <DoneScreen />;
}
