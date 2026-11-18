'use client';

import { useEffect, useState } from 'react';
import { Alert, Button, ProgressRing, Select, Skeleton, cn } from '@marketpilot/ui';
import { PageHeader } from '@/components/page-header';
import { useAuthStore } from '@/lib/auth-store';
import { Catalogue } from './catalogue';
import { CompetitorList } from './competitors/competitor-list';
import { useProfile } from './profile-api';
import { ProfileSection } from './profile-section';
import { ScanPanel } from './scan-panel';

const EDIT_ROLES = new Set(['owner', 'admin', 'manager']);
// Sections with their own editor stay on the page even when all their fields are hidden.
const SECTIONS_WITH_EDITOR = new Set(['products', 'competitors']);

function ProfileSkeleton() {
  return (
    <div className="flex flex-col gap-6" role="status" aria-live="polite">
      <span className="sr-only">Loading your brand profile</span>
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-control w-full" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}

export function ProfilePage() {
  const query = useProfile();
  const role = useAuthStore((state) => state.context?.role);
  const canEdit = role ? EDIT_ROLES.has(role) : false;
  const [active, setActive] = useState('basics');
  const profile = query.data;

  // Deep links such as /brand#goals open that section.
  useEffect(() => {
    const fromHash = window.location.hash.slice(1);
    if (fromHash) setActive(fromHash);
  }, []);

  function choose(id: string) {
    setActive(id);
    window.history.replaceState(null, '', `#${id}`);
  }

  if (query.isPending) return <ProfileSkeleton />;
  if (query.isError || !profile) {
    return (
      <div className="flex flex-col items-start gap-4">
        <Alert tone="danger" title="We could not load your brand profile">
          Check your connection and try again.
        </Alert>
        <Button variant="secondary" onClick={() => void query.refetch()}>
          Try again
        </Button>
      </div>
    );
  }

  const sections = profile.sections.filter(
    (s) => SECTIONS_WITH_EDITOR.has(s.id) || s.fields.some((f) => !f.hidden),
  );
  const section = sections.find((s) => s.id === active) ?? sections[0]!;
  const { filled, total } = profile.completeness;
  const percent = total > 0 ? Math.round((filled / total) * 100) : 0;
  const logo = profile.sections.flatMap((s) => s.fields).find((f) => f.key === 'logoUrl')?.value;
  const logoUrl = typeof logo === 'string' ? logo : null;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Brand profile"
        description="Everything we know about your business. This is what we use to write posts that sound like you."
        actions={
          <ProgressRing
            className="size-ring"
            percent={percent}
            label={`Brand profile ${percent}% complete: ${filled} of ${total} details filled in`}
          />
        }
      />

      <ScanPanel
        brand={profile.brand}
        logoUrl={logoUrl}
        canEdit={canEdit}
        onAddWebsite={() => choose('basics')}
      />

      <div className="grid gap-6 lg:grid-cols-4">
        <nav aria-label="Profile sections" className="lg:col-span-1">
          <div className="lg:hidden">
            <Select
              aria-label="Jump to a section"
              value={section.id}
              onChange={(event) => choose(event.target.value)}
            >
              {sections.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.skipped ? `${s.title} (off)` : s.total > 0 ? `${s.title} (${s.filled}/${s.total})` : s.title}
                </option>
              ))}
            </Select>
          </div>
          <ul className="hidden flex-col gap-1 lg:sticky lg:top-6 lg:flex">
            {sections.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => choose(s.id)}
                  aria-current={s.id === section.id ? 'true' : undefined}
                  className={cn(
                    'flex min-h-control-sm w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-left text-label',
                    'transition-colors duration-fast ease-standard',
                    s.id === section.id ? 'bg-accent-subtle text-accent' : 'text-ink-secondary hover:bg-subtle hover:text-ink',
                  )}
                >
                  <span>{s.title}</span>
                  {s.skipped ? (
                    <span className="shrink-0 text-caption text-ink-tertiary">Off</span>
                  ) : s.total > 0 ? (
                    <span className="shrink-0 text-caption">
                      {s.filled}/{s.total}
                    </span>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        <div className="min-w-0 lg:col-span-3">
          <ProfileSection
            key={section.id}
            section={section}
            canEdit={canEdit}
            lead={
              section.id === 'products' ? (
                <Catalogue canEdit={canEdit} />
              ) : section.id === 'competitors' ? (
                <CompetitorList canEdit={canEdit} />
              ) : undefined
            }
          />
        </div>
      </div>
    </div>
  );
}
