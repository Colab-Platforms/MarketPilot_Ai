import { createImageGenerationSchema } from '@marketpilot/contracts';
import type { VisualContext } from '@/modules/memory';
import { resolveInput, toImageBrief } from './image-brief';

const context = (overrides: Partial<VisualContext> = {}): VisualContext => ({
  brandName: 'Aayush Wellness',
  facts: [],
  colours: [],
  recentPostUrls: [],
  logoUrl: 'https://res.cloudinary.com/demo/image/upload/logo.png',
  designStyle: 'designed',
  product: null,
  ...overrides,
});

const input = (extra: Record<string, unknown> = {}) =>
  createImageGenerationSchema.parse({ brief: 'Night routine post', format: 'portrait', ...extra });

describe('resolveInput', () => {
  it('uses the brand design style and shows the logo by default', () => {
    expect(resolveInput(input(), context())).toMatchObject({ design: 'designed', showLogo: true });
  });

  it('keeps photo-first images logo-free unless asked', () => {
    expect(resolveInput(input({ design: 'photo' }), context())).toMatchObject({ design: 'photo', showLogo: false });
    expect(resolveInput(input({ design: 'photo', showLogo: true }), context()).showLogo).toBe(true);
  });

  it('never claims a logo the brand does not have', () => {
    expect(resolveInput(input({ showLogo: true }), context({ logoUrl: null })).showLogo).toBe(false);
  });

  it('sends the logo to the model only when it is shown', () => {
    const ctx = context();
    expect(toImageBrief(resolveInput(input(), ctx), ctx, []).logoUrl).toBe(ctx.logoUrl);
    expect(toImageBrief(resolveInput(input({ showLogo: false }), ctx), ctx, []).logoUrl).toBeNull();
  });
});
