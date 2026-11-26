import type { ImageDesign } from '@marketpilot/contracts';
import type { StyleCandidate, StyleCandidates } from '@/modules/assets';

export const MAX_STYLE_REFERENCES = 2;

// What a past generated image was made as, read from its studio job.
export interface GeneratedTraits {
  design: ImageDesign | null;
  productId: string | null;
}

export interface StyleReferenceInput {
  candidates: StyleCandidates;
  // The profile's "Your recent posts", in stored order (new uploads are added at the end).
  recentPostUrls: string[];
  traits: ReadonlyMap<string, GeneratedTraits>;
  target: { design: ImageDesign; productId: string | null };
}

// Which images a new image follows for its look (ADR 0010). At most two, and at most one made
// with AI next to a real post: feeding AI images back on their own makes every image alike
// and copies their flaws. Real posts: starred uploads, then the newest recent posts. AI images:
// starred, then liked, those closest in design and product first.
export function pickStyleReferences(input: StyleReferenceInput): string[] {
  const { candidates, target, traits } = input;
  const score = (c: StyleCandidate) => {
    const t = c.studioOutputId ? traits.get(c.studioOutputId) : undefined;
    return (t?.design === target.design ? 2 : 0) + (target.productId && t?.productId === target.productId ? 1 : 0);
  };
  const byFit = (list: StyleCandidate[]) =>
    list
      .map((c, order) => ({ c, order, fit: score(c) }))
      .sort((a, b) => b.fit - a.fit || a.order - b.order)
      .map(({ c }) => c.url);

  const real = [
    ...candidates.starred.filter((c) => c.source === 'upload').map((c) => c.url),
    ...[...input.recentPostUrls].reverse(),
  ];
  const ai = [
    ...byFit(candidates.starred.filter((c) => c.source === 'generated')),
    ...byFit(candidates.liked.filter((c) => c.source === 'generated')),
  ];

  const picked = [real[0], ai[0], ...real.slice(1)].filter((url): url is string => !!url);
  return [...new Set(picked)].slice(0, MAX_STYLE_REFERENCES);
}
