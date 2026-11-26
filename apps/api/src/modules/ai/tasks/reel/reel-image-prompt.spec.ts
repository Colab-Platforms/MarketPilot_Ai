import {
  composeKeyframePrompt,
  composePortraitPrompt,
  type ReelKeyframeBrief,
} from './reel-image-prompt';

const person = {
  look: 'Long black hair, warm brown skin',
  wardrobe: 'Teal cotton kurta',
  portraitUrl: 'https://img.example/c1.png',
};
const product = {
  name: 'Hair oil',
  imageUrls: [
    'https://img.example/p1.jpg',
    'https://img.example/p2.jpg',
    'https://img.example/p3.jpg',
  ],
};

const brief: ReelKeyframeBrief = {
  shot: 'close_up',
  setting: 'A sunlit bathroom',
  action: 'She lifts the bottle toward the camera.',
  people: [person],
  product,
};

describe('composeKeyframePrompt', () => {
  it('sends the portrait first, then at most two product photos, and numbers them to match', () => {
    const { references, prompt, aspectRatio } = composeKeyframePrompt(brief);
    expect(references).toEqual([
      'https://img.example/c1.png',
      'https://img.example/p1.jpg',
      'https://img.example/p2.jpg',
    ]);
    expect(prompt).toContain('same person as reference image 1');
    expect(prompt).toContain('reference images 2 to 3');
    expect(aspectRatio).toBe('9:16');
  });

  it('asks for exactly one product and no text on the picture', () => {
    const { prompt } = composeKeyframePrompt(brief);
    expect(prompt).toContain('exactly one of the product');
    expect(prompt).toContain('Do not put any text');
  });

  it('keeps people out when the scene has none', () => {
    const { prompt, references } = composeKeyframePrompt({ ...brief, people: [], product: null });
    expect(prompt).toContain('No people appear');
    expect(references).toEqual([]);
  });
});

describe('composePortraitPrompt', () => {
  it('describes a fictional person with no references', () => {
    const request = composePortraitPrompt({
      ageRange: 'about 30',
      look: person.look,
      wardrobe: person.wardrobe,
    });
    expect(request.prompt).toContain('fictional person');
    expect(request.references).toEqual([]);
    expect(request.aspectRatio).toBe('4:5');
  });
});
