'use client';

import { useState } from 'react';
import { Globe, Lock, MapPin, MessageCircle, Plus, Store } from 'lucide-react';
import { ChoiceCard, Field, FieldGroup, Input, cn } from '@marketpilot/ui';
import { entryInput } from '@/features/identity/entry-styles';
import { LinkField } from './link-field';
import { BUY_OPTIONS, type BuyOption } from './setup-copy';

const buyIcons: Record<BuyOption, typeof Globe> = { online: Globe, shop: Store, whatsapp: MessageCircle };

export function BuyScreen({ buys, error, onToggle }: { buys: BuyOption[]; error?: string; onToggle: (id: BuyOption) => void }) {
  const chosen = BUY_OPTIONS.filter((o) => buys.includes(o.id));
  return (
    <FieldGroup legend="How customers buy from you" error={error}>
      <div className="grid gap-4 md:grid-cols-2">
        {BUY_OPTIONS.map((option, index) => {
          const Icon = buyIcons[option.id];
          return (
            <ChoiceCard
              key={option.id}
              size="lg"
              type="checkbox"
              name="buy"
              value={option.id}
              checked={buys.includes(option.id)}
              onChange={() => onToggle(option.id)}
              className={index === 0 ? 'md:col-span-2' : undefined}
              icon={<Icon className="size-6" strokeWidth={1.8} aria-hidden="true" />}
              title={option.title}
              description={option.description}
              footer={
                <span className="mt-3 flex flex-col gap-1 border-t border-line pt-3">
                  <span className="text-caption font-semibold text-ink-tertiary">Your posts will ask people to</span>
                  <span className="text-body font-semibold text-accent">{option.cta}</span>
                </span>
              }
            />
          );
        })}
      </div>
      <p aria-live="polite" className="text-body text-ink-tertiary">
        {chosen.length === 0
          ? 'Pick all that apply.'
          : `Your posts will say: ${chosen.map((o) => `“${o.cta}”`).join(', ')}.`}
      </p>
    </FieldGroup>
  );
}

interface LinkScreenProps {
  isBusiness: boolean;
  offline: boolean;
  name: string;
  city: string;
  links: string[];
  errors: Record<string, string | undefined>;
  onName: (value: string) => void;
  onCity: (value: string) => void;
  onLink: (index: number, value: string) => void;
  onAddLink: () => void;
  onRemoveLink: (index: number) => void;
  onManual: () => void;
}

const MAX_LINKS = 3;

export function LinkScreen(props: LinkScreenProps) {
  const { isBusiness, offline, links, errors } = props;
  const [tipOpen, setTipOpen] = useState(false);
  const mainLabel = !isBusiness
    ? 'Instagram or YouTube profile link'
    : offline
      ? 'Google Maps, Instagram or Facebook link'
      : 'Website, social page or Google Maps link';
  const mainPlaceholder = !isBusiness ? 'instagram.com/yourname' : offline ? 'A Google Maps link or instagram.com/yourshop' : 'yourshop.com or a Google Maps link';

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label={isBusiness ? 'Business name' : 'Your name or creator name'} error={errors.brandName}>
          <Input value={props.name} onChange={(e) => props.onName(e.target.value)} autoComplete="organization" autoFocus className={entryInput} />
        </Field>
        <Field label="City" optional error={errors.city}>
          <Input value={props.city} onChange={(e) => props.onCity(e.target.value)} autoComplete="address-level2" className={entryInput} />
        </Field>
      </div>

      {links.map((link, index) => (
        <LinkField
          key={index}
          label={index === 0 ? mainLabel : 'Another social page'}
          value={link}
          placeholder={index === 0 ? mainPlaceholder : 'instagram.com/yourshop'}
          error={errors[`link${index}`]}
          onChange={(value) => props.onLink(index, value)}
          onRemove={index > 0 ? () => props.onRemoveLink(index) : undefined}
        />
      ))}

      {links.length < MAX_LINKS ? (
        <button type="button" onClick={props.onAddLink} className="flex min-h-touch items-center gap-2 self-start rounded-sm text-body font-semibold text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
          <Plus className="size-5" strokeWidth={2.2} aria-hidden="true" />
          {isBusiness ? 'Add your social links' : 'Add your other links'}
        </button>
      ) : null}

      {isBusiness ? (
        <div className="flex flex-col gap-2">
          <button
            type="button"
            aria-expanded={tipOpen}
            onClick={() => setTipOpen((open) => !open)}
            className="flex min-h-touch items-center gap-2 self-start rounded-sm text-body font-semibold text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <MapPin className="size-5" strokeWidth={2} aria-hidden="true" />
            Where do I find my Google Maps link?
          </button>
          {tipOpen ? (
            <ol className="m-0 flex flex-col gap-2 rounded-lg border border-line bg-surface py-4 pl-12 pr-4 text-body text-ink-secondary">
              <li>Open Google Maps and search for your shop’s name.</li>
              <li>
                Tap your shop, then tap <b className="text-ink">Share</b>.
              </li>
              <li>
                Tap <b className="text-ink">Copy link</b> and paste it above.
              </li>
            </ol>
          ) : null}
        </div>
      ) : null}

      <p className="flex items-start gap-3 rounded-lg bg-subtle p-4 text-body text-ink-secondary">
        <Lock className="mt-0.5 size-5 shrink-0" strokeWidth={2} aria-hidden="true" />
        We only read public pages. Nothing is posted until you approve it. Today we can read websites; social pages and Google Maps are saved to your profile.
      </p>

      <div className="flex items-center gap-3 text-body text-ink-tertiary" role="separator" aria-label="or">
        <span className="h-px flex-1 bg-line" />
        or
        <span className="h-px flex-1 bg-line" />
      </div>
      <button
        type="button"
        onClick={props.onManual}
        className="h-control-lg rounded-lg border border-line-strong text-heading font-semibold transition-colors duration-fast ease-standard hover:bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
      >
        {!isBusiness ? 'I am just starting out' : offline ? 'My shop is not online anywhere' : 'I don’t have a website or page'}
      </button>
    </>
  );
}

interface ManualScreenProps {
  isBusiness: boolean;
  name: string;
  city: string;
  contact: string;
  errors: Record<string, string | undefined>;
  onName: (value: string) => void;
  onCity: (value: string) => void;
  onContact: (value: string) => void;
}

export function ManualScreen(props: ManualScreenProps) {
  const { isBusiness, errors } = props;
  return (
    <>
      <Field label={isBusiness ? 'Business name' : 'Your name or creator name'} error={errors.brandName}>
        <Input value={props.name} onChange={(e) => props.onName(e.target.value)} autoComplete="organization" autoFocus className={entryInput} />
      </Field>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="City" optional error={errors.city}>
          <Input value={props.city} onChange={(e) => props.onCity(e.target.value)} autoComplete="address-level2" className={entryInput} />
        </Field>
        <Field
          label={isBusiness ? 'WhatsApp number' : 'Instagram handle'}
          optional
          error={errors.contact}
        >
          <Input
            value={props.contact}
            onChange={(e) => props.onContact(e.target.value)}
            inputMode={isBusiness ? 'numeric' : 'text'}
            placeholder={isBusiness ? '98765 43210' : '@yourname'}
            className={cn(entryInput, 'tabular-nums')}
          />
        </Field>
      </div>
      <p className="text-body text-ink-tertiary">
        You can add a website or page any time later. We will ask what you sell in a moment.
      </p>
    </>
  );
}
