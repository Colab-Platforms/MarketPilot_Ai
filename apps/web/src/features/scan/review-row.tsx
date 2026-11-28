'use client';

import { useId, useState, type ReactNode } from 'react';
import { Pencil } from 'lucide-react';
import { Badge, Button, cn } from '@marketpilot/ui';
import { isPaintable, type Shown } from './review-format';

// `website`: copied from the site. `check`: the AI's guess, which the owner should look at.
export type RowTag = 'website' | 'check';

export function SourceTag({ tag, sourceLabel }: { tag: RowTag; sourceLabel: string }) {
  return tag === 'check' ? (
    <Badge tone="warning" className="font-medium">
      Please check
    </Badge>
  ) : (
    <Badge className="font-medium">{sourceLabel}</Badge>
  );
}

export function ShownValue({ shown, muted = false }: { shown: Shown; muted?: boolean }) {
  if (shown.kind === 'empty') return <span className="text-body text-ink-tertiary">Not set</span>;
  if (shown.kind === 'colours') {
    const painted = shown.colours.filter(isPaintable);
    return (
      <span className={cn('flex flex-wrap items-center gap-2', muted && 'opacity-60')}>
        {painted.map((colour) => (
          // The brand's own colour, read from its website: data, not a design token.
          <span
            key={colour}
            aria-hidden="true"
            className="size-8 rounded-md border border-line"
            style={{ backgroundColor: colour }}
          />
        ))}
        <span className="text-body text-ink-secondary">{shown.colours.join(', ')}</span>
      </span>
    );
  }
  if (shown.kind === 'chips') {
    return (
      <span className={cn('flex flex-wrap gap-2', muted && 'opacity-60')}>
        {shown.chips.map((chip) => (
          <span key={chip} className="rounded-full bg-subtle px-3 py-1 text-body">
            {chip}
          </span>
        ))}
      </span>
    );
  }
  return (
    <span className={cn('whitespace-pre-line break-words text-lead', muted && 'text-ink-tertiary line-through')}>
      {shown.text}
    </span>
  );
}

interface ReviewRowProps<T> {
  label: string;
  tag: RowTag;
  sourceLabel: string;
  value: T;
  show: (value: T) => Shown;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  onSave: (value: T) => void;
  error?: string;
  renderEditor: (value: T, onChange: (value: T) => void) => ReactNode;
}

// One fact read from the website: shown as text until the owner chooses to edit it.
// Edits stay local until Save, so Cancel needs nothing to undo.
export function ReviewRow<T>({
  label,
  tag,
  sourceLabel,
  value,
  show,
  checked,
  onCheckedChange,
  onSave,
  error,
  renderEditor,
}: ReviewRowProps<T>) {
  const [draft, setDraft] = useState<{ value: T } | null>(null);
  const labelId = useId();
  // A value the server or the form rules rejected opens for editing, so the problem is in view.
  const editing = draft !== null || Boolean(error);
  const current = draft ? draft.value : value;

  function save() {
    onSave(current);
    setDraft(null);
  }

  function stopUsing() {
    onCheckedChange(false);
    setDraft(null);
  }

  return (
    <li className="flex gap-4 border-t border-line py-4">
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <span className="flex flex-wrap items-center gap-2">
          <span id={labelId} className="text-body font-medium text-ink-tertiary">
            {label}
          </span>
          {checked ? <SourceTag tag={tag} sourceLabel={sourceLabel} /> : <Badge>Not used</Badge>}
        </span>

        {editing ? (
          <div role="group" aria-labelledby={labelId} className="mt-1 flex flex-col gap-3">
            {renderEditor(current, (next) => setDraft({ value: next }))}
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" className="min-h-touch px-5" onClick={save}>
                Save
              </Button>
              <Button type="button" variant="ghost" className="min-h-touch font-semibold text-accent" onClick={() => setDraft(null)}>
                Cancel
              </Button>
              <Button type="button" variant="ghost" className="ml-auto min-h-touch text-ink-secondary" onClick={stopUsing}>
                Do not use this
              </Button>
            </div>
          </div>
        ) : (
          <ShownValue shown={show(value)} muted={!checked} />
        )}
      </div>

      {editing ? null : checked ? (
        <Button
          type="button"
          variant="ghost"
          aria-label={`Edit ${label}`}
          className="min-h-touch shrink-0 self-start px-3 font-semibold text-accent"
          onClick={() => setDraft({ value })}
        >
          <Pencil className="size-4" strokeWidth={2} aria-hidden="true" />
          <span className="hidden md:inline">Edit</span>
        </Button>
      ) : (
        <Button
          type="button"
          variant="ghost"
          aria-label={`Use ${label}`}
          className="min-h-touch shrink-0 self-start px-3 font-semibold text-accent"
          onClick={() => onCheckedChange(true)}
        >
          Use it
        </Button>
      )}
    </li>
  );
}
