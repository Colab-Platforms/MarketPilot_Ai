'use client';

import { useEffect, useState } from 'react';
import { Star, ThumbsDown, ThumbsUp } from 'lucide-react';
import { FEEDBACK_REASONS, type AssetFeedback, type FeedbackRating, type FeedbackReason } from '@marketpilot/contracts';
import { Button, cn } from '@marketpilot/ui';
import { useAuthStore } from '@/lib/auth-store';
import { useSetFeedback, useSetStyleReference } from './feedback-api';

const STAR_ROLES = new Set(['owner', 'admin', 'manager', 'creator']);

interface FeedbackBarProps {
  assetId: string;
  // Only images made with AI take a like or dislike; any image can be a style reference.
  rateable: boolean;
  styleReference: boolean;
  feedback: AssetFeedback | null;
  // Icon buttons only, for image grids and the copilot panel.
  compact?: boolean;
}

// Like, dislike (with quick reasons) and "use as style reference" for one library image.
// Changes show at once and roll back if the server refuses them.
export function FeedbackBar({ assetId, rateable, styleReference, feedback, compact = false }: FeedbackBarProps) {
  const role = useAuthStore((state) => state.context?.role);
  const canStar = role ? STAR_ROLES.has(role) : false;
  const setFeedback = useSetFeedback();
  const setStar = useSetStyleReference();
  const [rating, setRating] = useState<FeedbackRating | null>(feedback?.rating ?? null);
  const [reasons, setReasons] = useState<FeedbackReason[]>(feedback?.reasons ?? []);
  const [starred, setStarred] = useState(styleReference);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    setRating(feedback?.rating ?? null);
    setReasons(feedback?.reasons ?? []);
  }, [feedback?.rating, feedback?.reasons]);
  useEffect(() => setStarred(styleReference), [styleReference]);

  function sendFeedback(nextRating: FeedbackRating | null, nextReasons: FeedbackReason[]) {
    const before = { rating, reasons };
    setRating(nextRating);
    setReasons(nextReasons);
    setProblem(null);
    setFeedback.mutate(
      { assetId, body: { rating: nextRating, reasons: nextReasons } },
      {
        onError: () => {
          setRating(before.rating);
          setReasons(before.reasons);
          setProblem('We could not save that. Try again.');
        },
      },
    );
  }

  function toggleStar() {
    const next = !starred;
    setStarred(next);
    setProblem(null);
    setStar.mutate(
      { assetId, styleReference: next },
      {
        onError: () => {
          setStarred(!next);
          setProblem('We could not save that. Try again.');
        },
      },
    );
  }

  const rate = (value: FeedbackRating) => sendFeedback(rating === value ? null : value, value === 'dislike' ? reasons : []);
  const toggleReason = (reason: FeedbackReason) =>
    sendFeedback('dislike', reasons.includes(reason) ? reasons.filter((r) => r !== reason) : [...reasons, reason]);

  const iconButton = (pressed: boolean) =>
    cn('min-h-touch md:min-h-0', compact && 'px-2', pressed && 'bg-accent-subtle text-accent hover:bg-accent-subtle hover:text-accent');

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-1">
        {rateable ? (
          <>
            <Button
              variant="ghost"
              size="sm"
              aria-pressed={rating === 'like'}
              aria-label={compact ? 'Like this image' : undefined}
              title="Like this image"
              className={iconButton(rating === 'like')}
              onClick={() => rate('like')}
            >
              <ThumbsUp className="size-4" strokeWidth={1.5} aria-hidden="true" />
              {compact ? null : 'Like'}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              aria-pressed={rating === 'dislike'}
              aria-label={compact ? 'Dislike this image' : undefined}
              title="Dislike this image"
              className={iconButton(rating === 'dislike')}
              onClick={() => rate('dislike')}
            >
              <ThumbsDown className="size-4" strokeWidth={1.5} aria-hidden="true" />
              {compact ? null : 'Dislike'}
            </Button>
          </>
        ) : null}
        {canStar ? (
          <Button
            variant="ghost"
            size="sm"
            aria-pressed={starred}
            aria-label={compact ? 'Use as style reference for new images' : undefined}
            title="New images follow the look of your style references"
            className={iconButton(starred)}
            onClick={toggleStar}
          >
            <Star className={cn('size-4', starred && 'fill-current')} strokeWidth={1.5} aria-hidden="true" />
            {compact ? null : starred ? 'Style reference' : 'Use as style reference'}
          </Button>
        ) : null}
      </div>

      {rating === 'dislike' ? (
        <div className="flex flex-col gap-1">
          <span className="text-caption text-ink-secondary">What was wrong? (optional)</span>
          <ul className="flex flex-wrap gap-1" aria-label="Reasons">
            {FEEDBACK_REASONS.map((reason) => {
              const on = reasons.includes(reason.value);
              return (
                <li key={reason.value}>
                  <button
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggleReason(reason.value)}
                    className={cn(
                      'min-h-touch rounded-sm border px-2 text-caption transition-colors duration-fast ease-standard focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent md:min-h-0 md:py-0.5',
                      on ? 'border-accent-line bg-accent-subtle text-accent' : 'border-line text-ink-secondary hover:bg-subtle',
                    )}
                  >
                    {reason.label}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      {problem ? (
        <p role="alert" className="text-caption text-danger">
          {problem}
        </p>
      ) : null}
    </div>
  );
}
