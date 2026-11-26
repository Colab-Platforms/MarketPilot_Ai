'use client';

import { useState } from 'react';
import { classifyLink, type OnboardingState } from '@marketpilot/contracts';
import { BuyScreen, LinkScreen, ManualScreen } from './basics-screens';
import { StepFrame } from './step-frame';
import { buysFrom, channelsFor, type BuyOption } from './setup-copy';
import { useStepSubmit } from './use-step-submit';

interface SavedBasics {
  brandName?: string;
  websiteUrl?: string;
  city?: string;
  salesChannels?: string[];
  socialLinks?: string[];
}

type Screen = 'buy' | 'link' | 'manual';

const COPY = {
  business: {
    buy: ['How do customers buy from you?', 'Pick all that apply. This decides what your posts ask people to do.'],
    link: ['Where can we learn about your business?', 'Paste your website, Instagram, Facebook or Google Maps link. We read it and fill in your profile, so you type less.'],
    offline: ['Where can we find your shop online?', 'Paste your Google Maps listing, Instagram or Facebook page. Most shops are on Google Maps even without a website.'],
    manual: ['Tell us about your business', 'Just the essentials. You can add a website or page any time later.'],
  },
  creator: {
    link: ['Where do people follow you?', 'Paste your Instagram or YouTube profile. We save it to your profile and use it to learn your style.'],
    manual: ['Tell us about yourself', 'Just the essentials. You can add your profiles any time later.'],
  },
} as const;

function initialLinks(saved: SavedBasics): string[] {
  const links = [saved.websiteUrl, ...(saved.socialLinks ?? [])].filter((l): l is string => Boolean(l));
  return links.length > 0 ? links : [''];
}

function contactLink(isBusiness: boolean, raw: string): string | null | undefined {
  const value = raw.trim();
  if (!value) return undefined;
  if (isBusiness) {
    const digits = value.replace(/\D/g, '').replace(/^(91|0)(?=\d{10}$)/, '');
    return digits.length === 10 ? `https://wa.me/91${digits}` : null;
  }
  const handle = value.replace(/^@/, '').replace(/^https?:\/\/(www\.)?instagram\.com\//, '').replace(/\/.*$/, '');
  return /^[\w.]{1,30}$/.test(handle) ? `https://instagram.com/${handle}` : null;
}

export function BasicsStep({ state }: { state: OnboardingState }) {
  const saved = (state.answers.basics ?? {}) as SavedBasics;
  const isBusiness = state.track === 'business';
  const { submit, saving, fieldErrors, setFieldErrors, formError } = useStepSubmit('basics');
  const [screen, setScreen] = useState<Screen>(isBusiness ? 'buy' : 'link');
  const [buys, setBuys] = useState<BuyOption[]>(buysFrom(saved.salesChannels));
  const [name, setName] = useState(saved.brandName ?? '');
  const [city, setCity] = useState(saved.city ?? '');
  const [links, setLinks] = useState<string[]>(() => initialLinks(saved));
  const [contact, setContact] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const offline = isBusiness && buys.length > 0 && !buys.includes('online');
  const allErrors: Record<string, string | undefined> = {
    ...errors,
    ...fieldErrors,
    ...(fieldErrors.websiteUrl ? { link0: fieldErrors.websiteUrl } : {}),
  };
  const clear = (key: string) => {
    setErrors(({ [key]: _a, ...rest }) => rest);
    setFieldErrors(({ [key]: _b, ...rest }) => rest);
  };

  const [title, description] =
    screen === 'buy'
      ? COPY.business.buy
      : screen === 'manual'
        ? COPY[state.track].manual
        : isBusiness
          ? offline
            ? COPY.business.offline
            : COPY.business.link
          : COPY.creator.link;

  function save(websiteUrl: string | undefined, socialLinks: string[]) {
    submit({
      brandName: name,
      city: city || undefined,
      websiteUrl,
      socialLinks,
      ...(isBusiness && { salesChannels: channelsFor(buys) }),
    });
  }

  function submitLinks() {
    const next: Record<string, string> = {};
    if (!name.trim()) next.brandName = 'Enter a name';
    let websiteUrl: string | undefined;
    const socialLinks: string[] = [];
    links.forEach((link, index) => {
      if (!link.trim()) {
        if (index === 0) next.link0 = 'Paste a link, or choose the option below if you have none';
        return;
      }
      const kind = classifyLink(link);
      if (!kind) next[`link${index}`] = 'Enter a valid link, like yourshop.com';
      else if (kind.kind !== 'website') socialLinks.push(kind.url);
      else if (!websiteUrl) websiteUrl = kind.url;
      else next[`link${index}`] = 'Add only one website. Use this box for a social page.';
    });
    setErrors(next);
    if (Object.keys(next).length === 0) save(websiteUrl, socialLinks);
  }

  function submitManual() {
    const next: Record<string, string> = {};
    if (!name.trim()) next.brandName = 'Enter a name';
    const link = contactLink(isBusiness, contact);
    if (link === null) next.contact = isBusiness ? 'Enter a 10-digit mobile number' : 'Enter an Instagram handle, like @yourname';
    setErrors(next);
    if (Object.keys(next).length === 0) save(undefined, link ? [link] : []);
  }

  function onSubmit() {
    if (screen === 'buy') {
      if (buys.length === 0) return setErrors({ buys: 'Pick at least one' });
      setErrors({});
      return setScreen('link');
    }
    if (screen === 'link') return submitLinks();
    return submitManual();
  }

  const onBack = screen === 'manual' ? () => setScreen('link') : screen === 'link' && isBusiness ? () => setScreen('buy') : undefined;

  return (
    <StepFrame
      step="basics"
      title={title}
      description={description}
      error={formError}
      saving={saving}
      submitLabel={screen === 'link' ? (isBusiness ? 'Read my links' : 'Continue') : 'Continue'}
      onSubmit={onSubmit}
      onBack={onBack}
    >
      {screen === 'buy' ? (
        <BuyScreen
          buys={buys}
          error={allErrors.buys}
          onToggle={(id) => {
            setBuys((current) => (current.includes(id) ? current.filter((b) => b !== id) : [...current, id]));
            clear('buys');
          }}
        />
      ) : screen === 'link' ? (
        <LinkScreen
          isBusiness={isBusiness}
          offline={offline}
          name={name}
          city={city}
          links={links}
          errors={allErrors}
          onName={(value) => {
            setName(value);
            clear('brandName');
          }}
          onCity={(value) => {
            setCity(value);
            clear('city');
          }}
          onLink={(index, value) => {
            setLinks((current) => current.map((l, i) => (i === index ? value : l)));
            clear(`link${index}`);
            if (index === 0) clear('websiteUrl');
          }}
          onAddLink={() => setLinks((current) => [...current, ''])}
          onRemoveLink={(index) => setLinks((current) => current.filter((_, i) => i !== index))}
          onManual={() => {
            setErrors({});
            setScreen('manual');
          }}
        />
      ) : (
        <ManualScreen
          isBusiness={isBusiness}
          name={name}
          city={city}
          contact={contact}
          errors={allErrors}
          onName={(value) => {
            setName(value);
            clear('brandName');
          }}
          onCity={(value) => {
            setCity(value);
            clear('city');
          }}
          onContact={(value) => {
            setContact(value);
            clear('contact');
          }}
        />
      )}
    </StepFrame>
  );
}
