import type { Metadata } from 'next';
import { Audiences } from '@/features/marketing/audiences';
import { Bento } from '@/features/marketing/bento';
import { Control } from '@/features/marketing/control';
import { Credits } from '@/features/marketing/credits';
import { Faq } from '@/features/marketing/faq';
import { FinalCta } from '@/features/marketing/final-cta';
import { Hero } from '@/features/marketing/hero';
import { HowItWorks } from '@/features/marketing/how-it-works';
import { SiteFooter } from '@/features/marketing/site-footer';
import { SiteHeader } from '@/features/marketing/site-header';

export const metadata: Metadata = {
  title: { absolute: 'MarketPilot | Marketing that takes off while you run the shop' },
  description:
    'Share your website and a budget. MarketPilot plans, creates and publishes your Instagram and Facebook posts once you approve.',
};

export default function LandingPage() {
  return (
    <>
      <SiteHeader />
      <main>
        <Hero />
        <Bento />
        <HowItWorks />
        <Control />
        <Audiences />
        <Credits />
        <Faq />
        <FinalCta />
      </main>
      <SiteFooter />
    </>
  );
}
