import { basicsStepSchema, questionStepSchema } from '@marketpilot/contracts';
import { buildProfilePatch } from './profile-patch';

describe('buildProfilePatch', () => {
  it('maps business answers to columns and attributes', () => {
    const answers = questionStepSchema('about', 'business').parse({
      business_category: 'fashion',
      business_description: 'Handloom sarees',
      audience_summary: 'Women 25-45 in Pune',
      topics_to_avoid: ['politics'],
    });

    const patch = buildProfilePatch('about', 'business', answers);

    expect(patch.columns).toMatchObject({
      category: 'fashion',
      categoryPack: 'fashion',
      description: 'Handloom sarees',
      topicsToAvoid: ['politics'],
    });
    expect(patch.attributes).toEqual({ audienceSummary: 'Women 25-45 in Pune' });
  });

  it('converts the budget from rupees to minor units', () => {
    const answers = questionStepSchema('goals', 'business').parse({
      primary_objective: 'sales',
      preferred_channels: ['instagram'],
      monthly_budget: 5000,
    });

    expect(buildProfilePatch('goals', 'business', answers).columns.monthlyBudgetMinor).toBe(500_000);
  });

  it('skips blank optional answers so earlier values survive', () => {
    const answers = questionStepSchema('about', 'creator').parse({
      creator_niche: 'street food',
      creator_description: 'I review street food in Delhi',
    });

    const patch = buildProfilePatch('about', 'creator', answers);

    expect(patch.columns).not.toHaveProperty('toneOfVoice');
    expect(patch.attributes).toEqual({});
  });
});

describe('step schemas', () => {
  it('requires the business category and description', () => {
    const result = questionStepSchema('about', 'business').safeParse({});
    expect(result.success).toBe(false);
  });

  it('rejects answers that do not belong to the track', () => {
    const result = questionStepSchema('about', 'business').safeParse({
      business_category: 'fashion',
      business_description: 'x',
      creator_niche: 'food',
    });
    expect(result.success).toBe(false);
  });

  it('rejects an unknown option', () => {
    const result = questionStepSchema('goals', 'business').safeParse({
      primary_objective: 'world_domination',
      preferred_channels: ['instagram'],
    });
    expect(result.success).toBe(false);
  });

  it('normalises a website address without a scheme', () => {
    const parsed = basicsStepSchema.parse({ brandName: 'Acme', websiteUrl: 'acme.in', language: 'en' });
    expect(parsed.websiteUrl).toBe('https://acme.in/');
  });

  it('rejects an address that is not a website', () => {
    expect(basicsStepSchema.safeParse({ brandName: 'Acme', websiteUrl: 'not a url' }).success).toBe(false);
  });

  it('accepts a missing website', () => {
    expect(basicsStepSchema.parse({ brandName: 'Acme' }).websiteUrl).toBeUndefined();
  });
});
