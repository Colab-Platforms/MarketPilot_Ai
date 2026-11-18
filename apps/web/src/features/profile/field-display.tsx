import Image from 'next/image';
import type { ProfileFieldState } from '@marketpilot/contracts';
import { formatRupees } from '@/features/fields/field-draft';

function labelOf(field: ProfileFieldState, value: string): string {
  return field.options?.find((o) => o.value === value)?.label ?? value;
}

function Chips({ items }: { items: string[] }) {
  return (
    <ul className="flex flex-wrap gap-1">
      {items.map((item) => (
        <li key={item} className="rounded-full bg-subtle px-2 text-caption text-ink">
          {item}
        </li>
      ))}
    </ul>
  );
}

export function FieldValueView({ field }: { field: ProfileFieldState }) {
  const { value } = field;

  if (field.display) return <p className="text-body text-ink">{field.display}</p>;
  if (field.status === 'needs_connection') {
    return <p className="text-body text-ink-tertiary">Appears here once you connect your accounts.</p>;
  }
  if (value === null) return <p className="text-body text-ink-tertiary">Not added yet</p>;

  // Before the generic list case, which would show the image addresses as text.
  if (field.kind === 'images' && Array.isArray(value)) {
    return (
      <ul className="flex flex-wrap gap-2" aria-label={field.label}>
        {value.map((url, index) => (
          <li key={url} className="relative h-thumb w-thumb overflow-hidden rounded-md border border-line bg-surface">
            <Image src={url} alt={`${field.label} ${index + 1}`} fill unoptimized className="object-cover" />
          </li>
        ))}
      </ul>
    );
  }
  if (Array.isArray(value)) {
    return <Chips items={field.kind === 'multiselect' ? value.map((v) => labelOf(field, v)) : value} />;
  }
  if (typeof value === 'boolean') return <p className="text-body text-ink">{value ? 'Yes' : 'No'}</p>;
  if (field.kind === 'money' && typeof value === 'number') return <p className="text-body text-ink">{formatRupees(value)}</p>;
  if (field.key === 'logoUrl' && typeof value === 'string') {
    return (
      <span className="relative block size-16 overflow-hidden rounded-md border border-line bg-surface">
        <Image src={value} alt="Your logo" fill unoptimized className="object-contain p-1" />
      </span>
    );
  }
  if (field.kind === 'url' && typeof value === 'string') {
    return (
      <a
        href={value}
        target="_blank"
        rel="noopener noreferrer"
        className="break-all text-body text-accent underline underline-offset-2"
      >
        {value.replace(/^https?:\/\//, '')}
      </a>
    );
  }
  if (field.kind === 'select') return <p className="text-body text-ink">{labelOf(field, String(value))}</p>;
  return <p className="whitespace-pre-wrap break-words text-body text-ink">{String(value)}</p>;
}
