import { fitDurations, normalizeIdea, normalizeStoryboard } from './storyboard-normalize';
import type { SceneAnswer } from './reel-output';

const scene = (overrides: Partial<SceneAnswer> = {}): SceneAnswer => ({
  durationSeconds: 4,
  shot: 'medium',
  camera: 'static',
  setting: 'A small kitchen in morning light',
  action: 'She pours the oil into her palm',
  characterIds: ['c1'],
  showsProduct: true,
  onScreenText: '',
  voiceover: '',
  ...overrides,
});

const person = {
  id: 'c1',
  name: 'Asha',
  ageRange: 'about 30',
  look: 'Long black hair, warm brown skin',
  wardrobe: 'Green cotton kurta',
};

describe('fitDurations', () => {
  it('leaves lengths alone when they already add up', () => {
    expect(fitDurations([3, 4, 4, 4], 15)).toEqual([3, 4, 4, 4]);
  });

  it('grows the shortest scenes first to reach the target', () => {
    const fitted = fitDurations([2, 3, 3], 15);
    expect(fitted.reduce((a, b) => a + b, 0)).toBe(15);
    expect(Math.max(...fitted) - Math.min(...fitted)).toBeLessThanOrEqual(1);
  });

  it('shrinks the longest scenes first and never goes under the minimum', () => {
    const fitted = fitDurations([8, 8, 8, 2], 15);
    expect(fitted.reduce((a, b) => a + b, 0)).toBe(15);
    expect(Math.min(...fitted)).toBeGreaterThanOrEqual(2);
  });

  it('stops at the range limits when there are too few scenes', () => {
    expect(fitDurations([4, 4], 30)).toEqual([8, 8]);
  });
});

describe('normalizeStoryboard', () => {
  it('renumbers the cast and maps scene references to the new ids', () => {
    const result = normalizeStoryboard(
      {
        cast: [{ ...person, id: 'mother' }],
        scenes: [
          scene({ characterIds: ['mother', 'ghost'] }),
          scene({ characterIds: [] }),
          scene(),
        ],
      },
      15,
    );
    expect(result?.cast.map((c) => c.id)).toEqual(['c1']);
    expect(result?.scenes[0]?.characterIds).toEqual(['c1']);
    expect(result?.scenes[2]?.characterIds).toEqual([]);
  });

  it('drops scenes without a setting or action and fits the rest to the length', () => {
    const result = normalizeStoryboard(
      { cast: [person], scenes: [scene(), scene({ action: '  ' }), scene(), scene()] },
      15,
    );
    expect(result?.scenes).toHaveLength(3);
    expect(result?.scenes.reduce((sum, s) => sum + s.durationSeconds, 0)).toBe(15);
  });

  it('turns empty on-screen text and voiceover into null', () => {
    const result = normalizeStoryboard(
      { cast: [person], scenes: [scene(), scene({ onScreenText: 'Try it today' })] },
      15,
    );
    expect(result?.scenes[0]?.onScreenText).toBeNull();
    expect(result?.scenes[1]?.onScreenText).toBe('Try it today');
  });

  it('rejects an answer with fewer than two usable scenes', () => {
    expect(normalizeStoryboard({ cast: [person], scenes: [scene()] }, 15)).toBeNull();
  });
});

describe('normalizeIdea', () => {
  const idea = {
    title: 'Monday hair rescue',
    hook: 'A tangled comb snaps',
    format: 'Problem to solution',
    trendName: '',
    trendWhy: 'ignored',
    persona: 'A college student',
    story: 'She finds the oil and her hair is soft by Friday',
    cta: 'Order on WhatsApp',
    musicMood: 'Upbeat',
    sceneCount: 12,
  };

  it('keeps no trend when the model named none, and caps the scene count', () => {
    const result = normalizeIdea(idea);
    expect(result?.trend).toBeNull();
    expect(result?.sceneCount).toBe(8);
  });

  it('rejects an idea without a hook', () => {
    expect(normalizeIdea({ ...idea, hook: '' })).toBeNull();
  });
});
