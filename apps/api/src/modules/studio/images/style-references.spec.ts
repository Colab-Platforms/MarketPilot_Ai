import type { StyleCandidate, StyleCandidates } from '@/modules/assets';
import { pickStyleReferences, type GeneratedTraits } from './style-references';

const upload = (name: string): StyleCandidate => ({ url: `https://cdn.test/${name}.jpg`, source: 'upload', studioOutputId: null });
const generated = (name: string): StyleCandidate => ({ url: `https://cdn.test/${name}.png`, source: 'generated', studioOutputId: name });

const none: StyleCandidates = { starred: [], liked: [] };
const target = { design: 'designed' as const, productId: 'p1' };

function pick(candidates: StyleCandidates, recentPostUrls: string[] = [], traits: Record<string, GeneratedTraits> = {}) {
  return pickStyleReferences({ candidates, recentPostUrls, traits: new Map(Object.entries(traits)), target });
}

describe('pickStyleReferences', () => {
  it('falls back to the newest two recent posts when nothing is starred or liked', () => {
    expect(pick(none, ['https://cdn.test/old.jpg', 'https://cdn.test/mid.jpg', 'https://cdn.test/new.jpg'])).toEqual([
      'https://cdn.test/new.jpg',
      'https://cdn.test/mid.jpg',
    ]);
  });

  it('pairs one real post with one AI image, never two AI images', () => {
    const result = pick({ starred: [generated('a'), generated('b')], liked: [generated('c')] }, ['https://cdn.test/post.jpg']);
    expect(result).toEqual(['https://cdn.test/post.jpg', 'https://cdn.test/a.png']);
    expect(pick({ starred: [generated('a'), generated('b')], liked: [] })).toEqual(['https://cdn.test/a.png']);
  });

  it('prefers starred uploads over recent posts', () => {
    expect(pick({ starred: [upload('star')], liked: [] }, ['https://cdn.test/post.jpg'])).toEqual([
      'https://cdn.test/star.jpg',
      'https://cdn.test/post.jpg',
    ]);
  });

  it('prefers a starred AI image over a liked one, then the closest design and product', () => {
    expect(pick({ starred: [generated('starred')], liked: [generated('liked')] })).toEqual(['https://cdn.test/starred.png']);

    const traits = {
      other: { design: 'photo' as const, productId: null },
      sameDesign: { design: 'designed' as const, productId: 'p2' },
      exact: { design: 'designed' as const, productId: 'p1' },
    };
    expect(pick({ starred: [], liked: [generated('other'), generated('sameDesign'), generated('exact')] }, [], traits)).toEqual([
      'https://cdn.test/exact.png',
    ]);
  });

  it('never repeats an image', () => {
    const post = upload('post');
    expect(pick({ starred: [post], liked: [] }, [post.url])).toEqual([post.url]);
  });
});
