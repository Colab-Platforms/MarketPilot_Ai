'use client';

import { useId } from 'react';
import { Switch } from '@marketpilot/ui';
import { useSetSectionSkipped } from './profile-api';

// "Use this section": off means the section is not relevant to this business, so it stops
// counting toward profile completeness. Values already in it are kept.
export function SectionSwitch({ sectionId, skipped }: { sectionId: string; skipped: boolean }) {
  const labelId = useId();
  const toggle = useSetSectionSkipped();
  return (
    <div className="flex min-h-touch items-center gap-2">
      <span id={labelId} className="text-label text-ink-secondary">
        Use this section
      </span>
      <Switch
        aria-labelledby={labelId}
        checked={!skipped}
        disabled={toggle.isPending}
        onCheckedChange={(on) => toggle.mutate({ id: sectionId, skipped: !on })}
      />
      {toggle.isError ? (
        <span role="alert" className="text-caption text-danger">
          Could not change this. Try again.
        </span>
      ) : null}
    </div>
  );
}
