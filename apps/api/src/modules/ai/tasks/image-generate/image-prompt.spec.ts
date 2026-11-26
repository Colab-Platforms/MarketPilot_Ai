import { composeImagePrompt, type ImageBrief } from './image-prompt';

const noText = { headline: null, subheading: null, buttonText: null };

const base: ImageBrief = {
  request: 'Diwali offer post for our sweets',
  aspectRatio: '4:5',
  placement: 'an instagram feed',
  design: 'photo',
  text: noText,
  logoUrl: null,
  brand: { name: 'Kanha Sweets', facts: [{ label: 'Business category', value: 'Sweet shop' }], colours: ['#c0392b'] },
  product: null,
  styleImageUrls: [],
};

const product = (count: number) => ({
  name: 'Kaju katli',
  description: 'Cashew fudge with silver leaf',
  imageUrls: Array.from({ length: count }, (_, i) => `https://img.example/p${i}.jpg`),
});

const logo = 'https://img.example/logo.png';

describe('composeImagePrompt', () => {
  it('keeps a photo-first image free of text and logos', () => {
    const { prompt, references } = composeImagePrompt(base);
    expect(prompt).toContain('Do not put any text');
    expect(prompt).toContain('Do not add any logo');
    expect(prompt).toContain('aspect ratio 4:5');
    expect(prompt).toContain('#c0392b');
    expect(references).toEqual([]);
  });

  it('asks for the headline verbatim, in any script', () => {
    const { prompt } = composeImagePrompt({ ...base, text: { ...noText, headline: 'दिवाली धमाका 20% छूट' } });
    expect(prompt).toContain('Headline: "दिवाली धमाका 20% छूट"');
    expect(prompt).toContain('exactly as written');
  });

  it('prints every line of a designed ad, with the button, and asks for rich detail', () => {
    const { prompt } = composeImagePrompt({
      ...base,
      design: 'designed',
      text: { headline: 'The Timeless Classic', subheading: 'Rich, Aromatic & Refreshing', buttonText: 'Shop now' },
    });
    expect(prompt).toContain('professionally designed promotional post');
    expect(prompt).toContain('Subheading: "Rich, Aromatic & Refreshing"');
    expect(prompt).toContain('Button: "Shop now"');
  });

  it('lets a designed ad without text write its own short headline', () => {
    const { prompt } = composeImagePrompt({ ...base, design: 'designed' });
    expect(prompt).toContain('Write one short headline');
    expect(prompt).not.toContain('Do not put any text');
  });

  it('drops the button and subheading where the design has no place for them', () => {
    const text = { headline: 'Fresh today', subheading: 'Made every morning', buttonText: 'Order' };
    expect(composeImagePrompt({ ...base, design: 'minimal', text }).prompt).not.toContain('Button:');
    const photo = composeImagePrompt({ ...base, design: 'photo', text }).prompt;
    expect(photo).not.toContain('Subheading:');
    expect(photo).not.toContain('Button:');
  });

  it('orders references as product photos, then logo, then style posts, and numbers them so', () => {
    const { prompt, references } = composeImagePrompt({
      ...base,
      design: 'designed',
      logoUrl: logo,
      product: product(2),
      styleImageUrls: ['https://img.example/post1.jpg'],
    });
    expect(references).toEqual(['https://img.example/p0.jpg', 'https://img.example/p1.jpg', logo, 'https://img.example/post1.jpg']);
    expect(prompt).toContain('Reference images 1 to 2 are photos of the real product');
    expect(prompt).toContain("Reference image 3 is the brand's logo");
    expect(prompt).toContain('Reference image 4 is an example of the look');
  });

  it('gives each of several options its own direction, keeping product and text', () => {
    const prompts = [0, 1, 2].map((index) => composeImagePrompt({ ...base, option: { index, of: 3 } }).prompt);
    expect(new Set(prompts).size).toBe(3);
    expect(prompts[0]).toContain('option 1 of 3');
    expect(prompts[0]).toContain('Follow the description closely');
    expect(prompts[1]).toContain('change the camera angle');
    expect(prompts[2]).toContain('Keep the product, the text to print and the logo the same');
  });

  it('adds no option note to a single image', () => {
    expect(composeImagePrompt({ ...base, option: { index: 0, of: 1 } }).prompt).not.toContain('option 1');
  });

  it('caps references so cost and confusion stay low', () => {
    const { references } = composeImagePrompt({
      ...base,
      logoUrl: logo,
      product: product(6),
      styleImageUrls: ['https://a.example/1.jpg', 'https://a.example/2.jpg', 'https://a.example/3.jpg'],
    });
    expect(references).toHaveLength(6);
  });

  it('gives designed posts a layout that changes with the seed and between options', () => {
    const layoutOf = (brief: Partial<ImageBrief>) =>
      composeImagePrompt({ ...base, design: 'designed', ...brief }).prompt.match(/Layout: [^\n]+/)?.[0];
    expect(layoutOf({ layoutSeed: 0 })).toBeDefined();
    expect(layoutOf({ layoutSeed: 0 })).not.toEqual(layoutOf({ layoutSeed: 1 }));
    expect(layoutOf({ layoutSeed: 0, option: { index: 1, of: 2 } })).toEqual(layoutOf({ layoutSeed: 1 }));
    expect(composeImagePrompt({ ...base, layoutSeed: 0 }).prompt).not.toContain('Layout:');
  });

  it('takes the look from style references but not their layout', () => {
    const { prompt } = composeImagePrompt({ ...base, styleImageUrls: ['https://img.example/post1.jpg'] });
    expect(prompt).toContain('Do not copy their layout');
  });

  it('asks for the product to be shot in the scene, not pasted in', () => {
    const { prompt } = composeImagePrompt({ ...base, product: product(1) });
    expect(prompt).toContain('Photograph it fresh inside the new scene');
    expect(prompt).toContain('Do not paste or cut out the reference photo');
  });

  it('names a product without photos but claims no reference image for it', () => {
    const { prompt } = composeImagePrompt({ ...base, product: product(0) });
    expect(prompt).toContain('Featured product: Kaju katli');
    expect(prompt).not.toContain('Reference image');
  });
});
