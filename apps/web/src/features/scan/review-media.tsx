'use client';

import { useState } from 'react';
import Image from 'next/image';
import {
  Check,
  Facebook,
  Instagram,
  Linkedin,
  MessageCircle,
  Music2,
  Package,
  Pin,
  Twitter,
  Youtube,
  type LucideIcon,
} from 'lucide-react';
import { Button, Switch, cn } from '@marketpilot/ui';
import { priceOf } from './review-format';
import type { ProductCandidate, RowState, SocialCandidate } from './row-state';

const PROVIDERS: Record<SocialCandidate['provider'], { name: string; Icon: LucideIcon }> = {
  instagram: { name: 'Instagram', Icon: Instagram },
  facebook: { name: 'Facebook', Icon: Facebook },
  whatsapp: { name: 'WhatsApp', Icon: MessageCircle },
  youtube: { name: 'YouTube', Icon: Youtube },
  linkedin: { name: 'LinkedIn', Icon: Linkedin },
  tiktok: { name: 'TikTok', Icon: Music2 },
  pinterest: { name: 'Pinterest', Icon: Pin },
  x: { name: 'X', Icon: Twitter },
};

export function ReviewCard({
  title,
  hint,
  action,
  children,
}: {
  title: string;
  hint?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col">
          <h2 className="text-title font-semibold">{title}</h2>
          {hint ? <p className="text-body text-ink-tertiary">{hint}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function SocialSection({ social, rows }: { social: SocialCandidate[]; rows: RowState }) {
  return (
    <ReviewCard title="Social pages we found" hint="You connect them for posting at the end. Turn off any that are not yours.">
      <ul className="m-0 flex list-none flex-col p-0">
        {social.map((candidate) => {
          const { name, Icon } = PROVIDERS[candidate.provider];
          const nameId = `social-${candidate.id}`;
          return (
            <li key={candidate.id} className="flex items-center gap-4 border-t border-line py-3">
              <span className="flex h-control w-control shrink-0 items-center justify-center rounded-full bg-subtle">
                <Icon className="size-5" strokeWidth={2} aria-hidden="true" />
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span id={nameId} className="text-heading">
                  {name}
                </span>
                <span className="break-all text-body text-ink-tertiary">
                  {candidate.url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')}
                </span>
              </span>
              <span className="flex min-h-touch items-center">
                <Switch
                  checked={rows.isChecked(candidate.id)}
                  onCheckedChange={() => rows.toggle(candidate.id)}
                  aria-labelledby={nameId}
                />
              </span>
            </li>
          );
        })}
      </ul>
    </ReviewCard>
  );
}

const FIRST_PRODUCTS = 8;
const PLACEHOLDER_TONES = ['bg-subtle', 'bg-highlight-subtle', 'bg-accent-subtle', 'bg-muted'];

function ProductPicture({ product, index }: { product: ProductCandidate; index: number }) {
  const [broken, setBroken] = useState(false);
  const tone = PLACEHOLDER_TONES[index % PLACEHOLDER_TONES.length];
  return (
    <span className={cn('relative block aspect-square overflow-hidden rounded-md', tone)}>
      {product.imageUrl && !broken ? (
        <Image
          src={product.imageUrl}
          alt=""
          fill
          unoptimized
          sizes="200px"
          className="object-cover"
          onError={() => setBroken(true)}
        />
      ) : (
        <Package
          className="absolute left-1/2 top-1/2 size-8 -translate-x-1/2 -translate-y-1/2 text-ink-secondary"
          strokeWidth={1.6}
          aria-hidden="true"
        />
      )}
    </span>
  );
}

export function ProductsSection({ products, rows }: { products: ProductCandidate[]; rows: RowState }) {
  const [showAll, setShowAll] = useState(false);
  const picked = products.filter((p) => rows.isChecked(p.id)).length;
  const allPicked = picked === products.length;
  const shown = showAll ? products : products.slice(0, FIRST_PRODUCTS);

  return (
    <ReviewCard
      title={`Products (${products.length})`}
      hint={`${picked} picked to promote. Untick any you do not sell any more.`}
      action={
        <Button
          type="button"
          variant="secondary"
          className="min-h-touch px-4 font-semibold"
          onClick={() => rows.setChecked(products.map((p) => p.id), !allPicked)}
        >
          {allPicked ? 'Untick all' : 'Tick all'}
        </Button>
      }
    >
      <ul className="m-0 grid list-none grid-cols-2 gap-3 p-0 md:grid-cols-4">
        {shown.map((product, index) => {
          const on = rows.isChecked(product.id);
          const price = priceOf(product);
          return (
            <li key={product.id} className="flex">
              <button
                type="button"
                role="checkbox"
                aria-checked={on}
                onClick={() => rows.toggle(product.id)}
                className={cn(
                  'flex w-full flex-col gap-2 rounded-lg border-2 bg-surface p-2 pb-3 text-left transition-colors duration-fast',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-canvas',
                  on ? 'border-accent' : 'border-line opacity-70 hover:opacity-100',
                )}
              >
                <span className="relative block">
                  <ProductPicture product={product} index={index} />
                  <span
                    aria-hidden="true"
                    className={cn(
                      'absolute right-2 top-2 flex size-6 items-center justify-center rounded-md',
                      on ? 'bg-accent text-accent-on' : 'border-2 border-line-strong bg-surface',
                    )}
                  >
                    {on ? <Check className="size-4" strokeWidth={3} /> : null}
                  </span>
                </span>
                <span className="px-1 text-body font-semibold">{product.name}</span>
                {price ? (
                  <span className={cn('px-1 text-body tabular-nums', on ? 'text-ink-secondary' : 'text-ink-tertiary line-through')}>
                    {price}
                  </span>
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>
      {products.length > FIRST_PRODUCTS ? (
        <Button
          type="button"
          variant="secondary"
          className="min-h-touch w-full font-semibold text-accent"
          onClick={() => setShowAll((v) => !v)}
        >
          {showAll ? 'Show fewer products' : `Show all ${products.length} products`}
        </Button>
      ) : null}
    </ReviewCard>
  );
}
