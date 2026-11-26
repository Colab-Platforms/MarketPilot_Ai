import type { Metadata } from 'next';
import { Controls } from '@/features/marketing/controls';
import { Faq } from '@/features/marketing/faq';
import { FinalCta } from '@/features/marketing/final-cta';
import { Hero } from '@/features/marketing/hero';
import { HowItWorks } from '@/features/marketing/how-it-works';
import { Pricing } from '@/features/marketing/pricing';
import { SamplePosts } from '@/features/marketing/sample-posts';
import { SiteFooter } from '@/features/marketing/site-footer';
import { SiteHeader } from '@/features/marketing/site-header';

export const metadata: Metadata = {
  title: { absolute: 'MarketPilot | Marketing that takes off while you run the shop' },
  description:
    'MarketPilot plans a month of posts, makes them in your brand’s voice, and publishes to Instagram and Facebook only after you say yes.',
};

export default function LandingPage() {
  return (
    <>
      <SiteHeader />
      <main>
        <Hero />
        <SamplePosts />
        <HowItWorks />
        <Controls />
        <Pricing />
        <Faq />
        <FinalCta />
      </main>
      <SiteFooter />
    </>
  );
}
