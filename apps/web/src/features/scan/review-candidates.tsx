'use client';

import { SECTIONS, isHiddenField, type ScanCandidate } from '@marketpilot/contracts';
import { Badge, Checkbox, Field, Input, Textarea } from '@marketpilot/ui';
import type { Draft } from '@/features/fields/field-draft';
import { FieldInput } from '@/features/fields/field-input';
import { candidateAsField } from './candidate-field';

type ProfileCandidate = Extract<ScanCandidate, { kind: 'business_profile' }>;
type AiCandidate = Extract<ScanCandidate, { kind: 'profile_field' }>;
type SocialCandidate = Extract<ScanCandidate, { kind: 'social_link' }>;
type ProductCandidate = Extract<ScanCandidate, { kind: 'product' }>;

export interface RowState {
  isChecked: (id: string) => boolean;
  toggle: (id: string) => void;
  valueOf: (candidate: ProfileCandidate) => string;
  edit: (id: string, value: string) => void;
  // For AI suggestions, whose values can be lists, choices or text.
  draftOf: (candidate: AiCandidate) => Draft;
  editDraft: (id: string, draft: Draft) => void;
  errors: Record<string, string>;
}

const PROVIDER_NAMES: Record<SocialCandidate['provider'], string> = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  whatsapp: 'WhatsApp',
  youtube: 'YouTube',
  linkedin: 'LinkedIn',
  tiktok: 'TikTok',
  pinterest: 'Pinterest',
  x: 'X',
};

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

function price(product: ProductCandidate): string | null {
  if (product.priceMinor === undefined) return null;
  try {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: product.currency ?? 'INR' }).format(
      product.priceMinor / 100,
    );
  } catch {
    return `${product.priceMinor / 100} ${product.currency ?? ''}`.trim();
  }
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2 rounded-xl border border-line bg-surface px-4 pb-2 pt-5 md:px-6">
      <div>
        <h2 className="text-title font-semibold">{title}</h2>
        {hint ? <p className="text-body text-ink-tertiary">{hint}</p> : null}
      </div>
      {children}
    </section>
  );
}

function ProfileRow({ candidate, rows }: { candidate: ProfileCandidate; rows: RowState }) {
  const checked = rows.isChecked(candidate.id);
  const Control = candidate.field === 'description' ? Textarea : Input;
  return (
    <li className="flex items-start gap-3 border-t border-line py-4">
      <Checkbox
        checked={checked}
        onChange={() => rows.toggle(candidate.id)}
        aria-label={`Use ${candidate.label}`}
        className="mt-7"
      />
      <Field
        label={candidate.label}
        helper={`Found on ${hostOf(candidate.sourceUrl)}`}
        error={rows.errors[candidate.id]}
        className="min-w-0 flex-1"
      >
        <Control
          value={rows.valueOf(candidate)}
          disabled={!checked}
          onChange={(event) => rows.edit(candidate.id, event.target.value)}
        />
      </Field>
    </li>
  );
}

// One suggestion written by the AI from the website, with the evidence beside it.
function AiRow({ candidate, rows }: { candidate: AiCandidate; rows: RowState }) {
  const checked = rows.isChecked(candidate.id);
  const field = candidateAsField(candidate);
  return (
    <li className="flex items-start gap-3 border-t border-line py-4">
      <Checkbox
        checked={checked}
        onChange={() => rows.toggle(candidate.id)}
        aria-label={`Use ${candidate.label}`}
        className="mt-7"
      />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className={checked ? undefined : 'opacity-60'}>
          <FieldInput
            field={field}
            draft={rows.draftOf(candidate)}
            error={rows.errors[candidate.id]}
            onChange={(draft) => rows.editDraft(candidate.id, draft)}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={candidate.basis === 'stated' ? 'info' : 'accent'}>
            {candidate.basis === 'stated' ? 'From your website' : 'Suggested by AI'}
          </Badge>
          {candidate.sourceUrl ? (
            <span className="text-caption text-ink-secondary">on {hostOf(candidate.sourceUrl)}</span>
          ) : null}
        </div>
        {candidate.evidence ? (
          <blockquote className="border-l-2 border-line pl-3 text-caption text-ink-secondary">
            “{candidate.evidence}”
          </blockquote>
        ) : null}
      </div>
    </li>
  );
}

function SimpleRow({
  id,
  rows,
  title,
  detail,
}: {
  id: string;
  rows: RowState;
  title: string;
  detail?: string | null;
}) {
  const checkId = `pick-${id}`;
  return (
    <li>
      <label
        htmlFor={checkId}
        className="flex min-h-touch cursor-pointer items-center gap-3 border-t border-line py-3 hover:bg-subtle"
      >
        <Checkbox id={checkId} checked={rows.isChecked(id)} onChange={() => rows.toggle(id)} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-label text-ink">{title}</span>
          {detail ? <span className="block truncate text-caption text-ink-secondary">{detail}</span> : null}
        </span>
      </label>
    </li>
  );
}

export function ReviewCandidates({ candidates, rows }: { candidates: ScanCandidate[]; rows: RowState }) {
  // Hidden fields stay ticked, so their values are saved without the owner having to review them.
  const profile = candidates.filter(
    (c): c is ProfileCandidate => c.kind === 'business_profile' && !isHiddenField(c.field),
  );
  const suggested = candidates.filter((c): c is AiCandidate => c.kind === 'profile_field' && !isHiddenField(c.key));
  const social = candidates.filter((c): c is SocialCandidate => c.kind === 'social_link');
  const products = candidates.filter((c): c is ProductCandidate => c.kind === 'product');
  const groups = SECTIONS.map((section) => ({
    section,
    items: suggested.filter((c) => c.section === section.id),
  })).filter((group) => group.items.length > 0);

  return (
    <div className="flex flex-col gap-8">
      {profile.length > 0 ? (
        <Section title="About your business" hint="Edit anything that is not quite right.">
          <ul className="flex flex-col">
            {profile.map((candidate) => (
              <ProfileRow key={candidate.id} candidate={candidate} rows={rows} />
            ))}
          </ul>
        </Section>
      ) : null}
      {groups.length > 0 ? (
        <Section
          title="Written from your website"
          hint="Our AI read your site and drafted these. Check each one, and edit anything that is off."
        >
          <div className="flex flex-col gap-6">
            {groups.map(({ section, items }) => (
              <div key={section.id} className="flex flex-col gap-2">
                <h3 className="text-label text-ink-secondary">{section.title}</h3>
                <ul className="flex flex-col">
                  {items.map((candidate) => (
                    <AiRow key={candidate.id} candidate={candidate} rows={rows} />
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Section>
      ) : null}
      {social.length > 0 ? (
        <Section title="Social profiles" hint="We will ask you to connect these later.">
          <ul className="flex flex-col">
            {social.map((candidate) => (
              <SimpleRow
                key={candidate.id}
                id={candidate.id}
                rows={rows}
                title={PROVIDER_NAMES[candidate.provider]}
                detail={candidate.url.replace(/^https:\/\//, '')}
              />
            ))}
          </ul>
        </Section>
      ) : null}
      {products.length > 0 ? (
        <Section title={`Products (${products.length})`} hint="Untick any that are not yours to promote.">
          <ul className="flex flex-col">
            {products.map((candidate) => (
              <SimpleRow key={candidate.id} id={candidate.id} rows={rows} title={candidate.name} detail={price(candidate)} />
            ))}
          </ul>
        </Section>
      ) : null}
    </div>
  );
}
