import { Bookmark, Heart, MessageCircle, Send } from 'lucide-react';
import { cn } from '@marketpilot/ui';
import { kindLabel, type PostLanguage, type SampleBusiness, type SamplePost } from './sample-posts-data';
import type { TileTone } from './tiles';

const artwork: Record<TileTone, { tile: string; kind: string; headline: string; cta: string }> = {
  ink: { tile: 'mk-tile-ink', kind: 'bg-glass text-tile-white', headline: 'text-tile-white', cta: 'bg-highlight text-highlight-on' },
  sky: { tile: 'mk-tile-sky', kind: 'bg-tile-ink text-highlight', headline: 'text-tile-ink', cta: 'bg-tile-ink text-tile-white' },
  navy: { tile: 'mk-tile-navy', kind: 'bg-glass text-tile-white', headline: 'text-tile-white', cta: 'bg-tile-white text-tile-ink' },
};

interface PostCardProps {
  business: SampleBusiness;
  post: SamplePost;
  language: PostLanguage;
  className?: string;
}

export function PostCard({ business, post, language, className }: PostCardProps) {
  const copy = post.copy[language];
  const style = artwork[post.tone];
  return (
    <article lang={language} className={cn('overflow-hidden rounded-xl border border-line bg-surface shadow-card', className)}>
      <div className="flex items-center gap-2 px-3 py-3">
        <span className="flex size-8 items-center justify-center rounded-full bg-tile-ink text-caption font-extrabold text-highlight" aria-hidden="true">
          {business.initials}
        </span>
        <span className="flex-1 text-body font-bold">{business.handle}</span>
        <span className="text-caption font-semibold text-ink-tertiary">{post.day}</span>
      </div>
      <div className={cn('mk-pattern-lg flex aspect-square flex-col justify-between p-6', style.tile)}>
        <span className={cn('self-start rounded-full px-3 py-1 text-caption font-bold', style.kind)}>
          {kindLabel[language][post.kind]}
        </span>
        <p className={cn('font-display text-display font-extrabold leading-none tracking-tight', style.headline)}>
          {copy.headline}
        </p>
        <span className={cn('self-end rounded-lg px-3 py-2 text-body font-extrabold', style.cta)}>{copy.cta}</span>
      </div>
      <div className="flex items-center gap-4 px-3 pb-1 pt-3" aria-hidden="true">
        <Heart className="size-5" strokeWidth={2} />
        <MessageCircle className="size-5" strokeWidth={2} />
        <Send className="size-5" strokeWidth={2} />
        <Bookmark className="ml-auto size-5" strokeWidth={2} />
      </div>
      <p className="px-3 pb-4 pt-1 text-label text-ink-tertiary">
        <b className="text-ink">{business.handle}</b> {copy.caption}
      </p>
    </article>
  );
}
