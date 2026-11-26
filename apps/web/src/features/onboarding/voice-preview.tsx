import { cn } from '@marketpilot/ui';

interface VoicePreviewProps {
  brandName: string;
  headline: string;
  caption: string;
  className?: string;
}

// A sample post in the chosen tone. It is illustrative; real posts use the owner's products.
export function VoicePreview({ brandName, headline, caption, className }: VoicePreviewProps) {
  const initials = brandName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('');
  const handle = brandName.toLowerCase().replace(/[^a-z0-9]+/g, '');
  return (
    <figure className={cn('m-0 overflow-hidden rounded-xl border border-line bg-surface', className)}>
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <span className="flex items-center gap-3">
          <span aria-hidden="true" className="flex size-8 items-center justify-center rounded-full bg-tile-ink text-caption font-bold text-highlight">
            {initials || 'MP'}
          </span>
          <span className="text-body font-semibold">{handle || 'yourbrand'}</span>
        </span>
        <span className="rounded-full bg-subtle px-2 text-caption font-medium text-ink-tertiary">Preview</span>
      </div>
      <div className="mk-tile-navy mk-pattern-lg flex aspect-video items-end p-5 font-display text-display font-bold leading-tight">
        {headline}
      </div>
      <figcaption className="p-4 text-body text-ink-secondary">{caption}</figcaption>
    </figure>
  );
}
