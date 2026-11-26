import { useId } from 'react';
import { Check, Link2, X } from 'lucide-react';
import { classifyLink, type LinkKind } from '@marketpilot/contracts';
import { cn } from '@marketpilot/ui';

const PROVIDER_NAMES: Record<string, string> = {
  instagram: 'Instagram page',
  facebook: 'Facebook page',
  youtube: 'YouTube channel',
  linkedin: 'LinkedIn page',
  x: 'X profile',
  tiktok: 'TikTok profile',
  pinterest: 'Pinterest profile',
  whatsapp: 'WhatsApp link',
};

export function describeLink(kind: LinkKind | null): string | null {
  if (!kind) return null;
  if (kind.kind === 'website') return 'Website';
  if (kind.kind === 'maps') return 'Google Maps listing';
  return PROVIDER_NAMES[kind.provider] ?? 'Social page';
}

interface LinkFieldProps {
  label: string;
  value: string;
  placeholder?: string;
  error?: string;
  autoFocus?: boolean;
  onChange: (value: string) => void;
  onRemove?: () => void;
}

// A link box with a live "Instagram page found" hint, as in the setup design.
export function LinkField({ label, value, placeholder, error, autoFocus, onChange, onRemove }: LinkFieldProps) {
  const id = useId();
  const found = describeLink(classifyLink(value));
  const messageId = `${id}-message`;
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-body font-medium">
        {label}
      </label>
      <div
        className={cn(
          'flex h-control-lg items-center gap-3 rounded-lg border bg-surface pl-4',
          'focus-within:ring-2 focus-within:ring-accent focus-within:ring-offset-2 focus-within:ring-offset-canvas',
          error ? 'border-danger' : 'border-line-strong',
          onRemove ? 'pr-1' : 'pr-4',
        )}
      >
        <Link2 className="size-5 shrink-0 text-ink-tertiary" strokeWidth={2} aria-hidden="true" />
        <input
          id={id}
          type="url"
          inputMode="url"
          autoComplete="url"
          value={value}
          placeholder={placeholder}
          autoFocus={autoFocus}
          aria-invalid={error ? true : undefined}
          aria-describedby={error || found ? messageId : undefined}
          onChange={(event) => onChange(event.target.value)}
          className="h-control min-w-0 flex-1 bg-transparent text-lead text-ink outline-none placeholder:text-ink-tertiary"
        />
        {onRemove ? (
          <button
            type="button"
            onClick={onRemove}
            aria-label={`Remove ${label.toLowerCase()}`}
            className="flex size-12 items-center justify-center rounded-md text-ink-tertiary hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <X className="size-5" strokeWidth={2.2} aria-hidden="true" />
          </button>
        ) : null}
      </div>
      {error ? (
        <p id={messageId} role="alert" className="text-body text-danger">
          {error}
        </p>
      ) : found ? (
        <p id={messageId} className="flex items-center gap-2 text-body font-medium text-success">
          <Check className="size-4" strokeWidth={2.4} aria-hidden="true" />
          {found} found
        </p>
      ) : null}
    </div>
  );
}
