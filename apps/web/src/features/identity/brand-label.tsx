'use client';

import { Skeleton, initialsOf } from '@marketpilot/ui';
import { useOnboarding } from '@/features/onboarding/onboarding-api';

export function BrandLabel() {
  const query = useOnboarding();
  if (query.isPending) return <Skeleton className="h-8 w-tile" />;

  const name = query.data?.brand.name ?? 'Your workspace';
  return (
    <div className="flex min-w-0 items-center gap-3">
      <span
        aria-hidden="true"
        className="flex size-8 shrink-0 items-center justify-center rounded-sm bg-subtle text-label text-ink"
      >
        {initialsOf(name)}
      </span>
      <div className="min-w-0">
        <p className="truncate text-label text-ink">{name}</p>
        <p className="hidden text-caption text-ink-tertiary sm:block">Brand workspace</p>
      </div>
    </div>
  );
}
