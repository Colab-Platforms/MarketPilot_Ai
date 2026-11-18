import { cn } from '../lib/cn';

const SIZES = { sm: 'size-6 text-caption', md: 'size-8 text-label', lg: 'size-12 text-heading' } as const;

interface AvatarProps {
  name: string;
  imageUrl?: string | null;
  size?: keyof typeof SIZES;
  className?: string;
}

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
  return (first + last).toUpperCase() || '?';
}

// Decorative by default: the surrounding control carries the accessible name.
export function Avatar({ name, imageUrl, size = 'md', className }: AvatarProps) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-flex shrink-0 select-none items-center justify-center overflow-hidden rounded-full bg-accent-subtle font-semibold text-accent',
        SIZES[size],
        className,
      )}
    >
      {imageUrl ? <img src={imageUrl} alt="" className="size-full object-cover" /> : initialsOf(name)}
    </span>
  );
}
