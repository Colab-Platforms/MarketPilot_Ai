import { basicsStepSchema } from '@marketpilot/contracts';
import { basicsProfileValues, postLanguageValues } from './setup-profile-values';

const basics = (extra: Record<string, unknown>) => basicsStepSchema.parse({ brandName: 'Sharma Sweets', ...extra });

describe('basicsProfileValues', () => {
  it('maps social links to their profile fields and keeps the first link per network', () => {
    const values = basicsProfileValues(
      basics({ socialLinks: ['instagram.com/sharmasweets', 'https://www.facebook.com/sharma', 'instagram.com/other'] }),
    );
    expect(values).toEqual({
      'social.instagram': 'https://instagram.com/sharmasweets',
      'social.facebook': 'https://www.facebook.com/sharma',
    });
  });

  it('keeps Google Maps links out of the profile', () => {
    expect(basicsProfileValues(basics({ socialLinks: ['maps.app.goo.gl/abc123'] }))).toEqual({});
  });

  it('passes sales channels through', () => {
    expect(basicsProfileValues(basics({ salesChannels: ['store', 'whatsapp'] }))).toEqual({
      salesChannels: ['store', 'whatsapp'],
    });
  });

  it('writes nothing when the owner gave neither', () => {
    expect(basicsProfileValues(basics({}))).toEqual({});
  });

  it('rejects an unknown sales channel at the schema', () => {
    expect(() => basics({ salesChannels: ['teleport'] })).toThrow();
  });
});

describe('postLanguageValues', () => {
  it('makes the first language the main one', () => {
    expect(postLanguageValues(['hi', 'en'])).toEqual({ 'brand.language': 'hi', 'brand.secondaryLanguages': ['en'] });
  });
});
