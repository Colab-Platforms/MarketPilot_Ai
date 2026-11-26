import type { ReelSceneSpec } from '@marketpilot/contracts';
import { composeIdeasPrompt, type ReelIdeasInput } from './reel-ideas.task';
import { composeRewritePrompt } from './reel-storyboard.task';

const base: ReelIdeasInput = {
  brand: {
    name: 'Kesh Ayurveda',
    contextText: '<business_context>\n## Brand: Kesh Ayurveda\n</business_context>',
  },
  product: {
    name: 'Bhringraj hair oil',
    description: 'Cold-pressed oil in a 200 ml amber bottle',
    price: '₹349',
  },
  brief: {
    goal: 'awareness',
    lengthSeconds: 15,
    language: 'hinglish',
    audience: null,
    notes: null,
  },
  trends: [{ name: 'POV routines', kind: 'format', detail: 'First-person morning routines' }],
  avoidTitles: [],
};

const scene = (action: string): ReelSceneSpec => ({
  durationSeconds: 3,
  shot: 'medium',
  camera: 'static',
  setting: 'A sunlit bathroom',
  action,
  characterIds: ['c1'],
  showsProduct: true,
  onScreenText: null,
  voiceover: null,
});

describe('composeIdeasPrompt', () => {
  it('leads with the brand and product so repeated calls share a prefix', () => {
    const { user } = composeIdeasPrompt(base);
    expect(user.startsWith('<business_context>')).toBe(true);
    expect(user.indexOf('<product>')).toBeLessThan(user.indexOf('<brief>'));
    expect(user.indexOf('<brief>')).toBeLessThan(user.indexOf('<trends>'));
  });

  it('states the reel language and lists earlier titles to avoid', () => {
    const { user } = composeIdeasPrompt({ ...base, avoidTitles: ['Monday rescue'] });
    expect(user).toContain('Hinglish');
    expect(user).toContain('"Monday rescue"');
  });

  it('says plainly when there is no trend data', () => {
    expect(composeIdeasPrompt({ ...base, trends: [] }).user).toContain('No current trend data');
  });

  it('forbids real people and invented offers in the rules', () => {
    const { system } = composeIdeasPrompt(base);
    expect(system).toContain('Every person is fictional');
    expect(system).toContain('Never invent prices, offers');
  });
});

describe('composeRewritePrompt', () => {
  const idea = {
    title: 'Morning ritual',
    hook: 'Hair tangled at 7am',
    format: 'POV',
    trend: null,
    persona: 'A woman about 28',
    story: 'She oils her hair and it is soft',
    cta: 'Order karo',
    musicMood: 'Calm',
    sceneCount: 4,
  };

  it('sends only the scenes either side, not the whole storyboard', () => {
    const { user } = composeRewritePrompt({
      ...base,
      idea,
      cast: [
        {
          id: 'c1',
          name: 'Asha',
          ageRange: 'about 28',
          look: 'Long black hair',
          wardrobe: 'Green kurta',
        },
      ],
      scene: scene('She combs her hair'),
      previous: scene('She wakes up'),
      next: null,
      instruction: 'Make it more playful',
    });
    expect(user).toContain('Scene before: 3s medium');
    expect(user).toContain('This is the last scene');
    expect(user).toContain('Make it more playful');
    expect(user).not.toContain('<trends>');
  });
});
