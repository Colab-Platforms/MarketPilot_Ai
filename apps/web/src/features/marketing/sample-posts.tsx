'use client';

import { useState } from 'react';
import { PillToggle } from '@marketpilot/ui';
import { PostCard } from './post-card';
import { sampleBusinesses, type PostLanguage } from './sample-posts-data';
import { Container, SectionIntro, focusRing } from './section';

const languages = [
  { value: 'en', label: 'English' },
  { value: 'hi', label: <span lang="hi">हिन्दी</span>, ariaLabel: 'Hindi' },
] as const;

const businessOptions = sampleBusinesses.map((b) => ({
  value: b.id,
  ariaLabel: b.label,
  label: (
    <>
      <span className="md:hidden">{b.shortLabel}</span>
      <span className="hidden md:inline">{b.label}</span>
    </>
  ),
}));

export function SamplePosts() {
  const [language, setLanguage] = useState<PostLanguage>('en');
  const [businessId, setBusinessId] = useState('bakery');
  const business = sampleBusinesses.find((b) => b.id === businessId);

  return (
    <section aria-labelledby="samples-title" className="border-t border-line bg-surface py-16 md:py-24">
      <Container className="flex flex-col gap-8">
        <SectionIntro
          titleId="samples-title"
          title="Posts your customers will actually stop for."
          aside={<PillToggle label="Post language" options={languages} value={language} onChange={setLanguage} />}
        />
        <PillToggle
          label="Business type"
          layout="chips"
          options={businessOptions}
          value={businessId}
          onChange={setBusinessId}
          className="grid grid-cols-3 md:flex"
        />
        {business ? (
          <div
            role="region"
            aria-label={`Sample posts for a ${business.label.toLowerCase()} business`}
            tabIndex={0}
            className={`-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-3 lg:mx-0 lg:grid lg:grid-cols-3 lg:gap-6 lg:overflow-visible lg:px-0 ${focusRing}`}
          >
            {business.posts.map((post) => (
              <PostCard
                key={`${business.id}-${post.day}`}
                business={business}
                post={post}
                language={language}
                className="w-4/5 shrink-0 snap-center md:w-2/5 lg:w-auto"
              />
            ))}
          </div>
        ) : null}
        <p className="text-body text-ink-tertiary">
          Samples. Yours are made from your own products, prices and tone, around the festivals and seasons that matter to your customers.
        </p>
      </Container>
    </section>
  );
}
