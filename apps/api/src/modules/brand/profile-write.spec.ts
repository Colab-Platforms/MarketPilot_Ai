import { Prisma } from '@prisma/client';
import { planProfileWrites } from './profile-write';

type Input = Parameters<typeof planProfileWrites>[0];
const business: Input = { track: 'business', category: 'fashion', languages: ['hi', 'en'] };

const ok = (values: Record<string, unknown>, input: Input = business) => {
  const result = planProfileWrites(input, values);
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result.plan;
};
const errors = (values: Record<string, unknown>, input: Input = business) => {
  const result = planProfileWrites(input, values);
  if (result.ok) throw new Error('expected errors');
  return result.errors;
};

describe('planProfileWrites: reference post images', () => {
  const post = (n: number) => `https://res.cloudinary.com/c/image/upload/v1/marketpilot_posts/w1/${n}.jpg`;

  it('stores uploaded post images as a list on the profile', () => {
    const plan = ok({ recentPostImages: [post(1), post(2), post(1)] });
    expect(plan.attributes.set).toEqual({ recentPostImages: [post(1), post(2)] });
  });

  it('rejects anything that is not an https image address, and more than nine', () => {
    expect(errors({ recentPostImages: ['javascript:alert(1)'] })).toHaveProperty('recentPostImages');
    expect(errors({ recentPostImages: 'not a list' })).toHaveProperty('recentPostImages');
    expect(errors({ recentPostImages: Array.from({ length: 10 }, (_, i) => post(i)) })).toHaveProperty(
      'recentPostImages',
    );
  });
});

describe('planProfileWrites', () => {
  it('translates values to what each column stores', () => {
    const plan = ok({
      monthlyBudgetMinor: 5000,
      adBudgetMinor: 2000,
      operatingHours: 'Mon to Sat',
      branches: ['Mumbai', 'Delhi'],
      serviceAreas: ['Pune'],
      yearEstablished: 2011,
      tagline: 'Woven with care',
    });
    expect(plan.columns).toEqual({
      monthlyBudgetMinor: 500000,
      operatingHours: { text: 'Mon to Sat' },
      branches: ['Mumbai', 'Delhi'],
      serviceAreas: ['Pune'],
      yearEstablished: 2011,
      tagline: 'Woven with care',
    });
    expect(plan.attributes.set).toEqual({ adBudgetMinor: 200000 });
    expect([...plan.stamped].sort()).toEqual(
      ['adBudgetMinor', 'branches', 'monthlyBudgetMinor', 'operatingHours', 'serviceAreas', 'tagline', 'yearEstablished'].sort(),
    );
  });

  it('clears values the way each column needs, and drops their provenance', () => {
    const plan = ok({
      operatingHours: null,
      serviceAreas: [],
      tagline: '',
      country: null,
      audienceSummary: '',
      monthlyBudgetMinor: null,
    });
    expect(plan.columns).toMatchObject({
      operatingHours: Prisma.DbNull,
      serviceAreas: [],
      tagline: null,
      country: 'IN',
      monthlyBudgetMinor: null,
    });
    expect(plan.attributes.remove).toEqual(['audienceSummary']);
    expect(plan.cleared).toContain('tagline');
    expect(plan.stamped).toEqual([]);
  });

  it('keeps the primary language first and removes it from the secondary list', () => {
    expect(ok({ 'brand.secondaryLanguages': ['hi', 'ta'] }).brand.languages).toEqual(['hi', 'ta']);
    expect(ok({ 'brand.language': 'en' }).brand.languages).toEqual(['en']);
    expect(ok({ 'brand.language': 'ta', 'brand.secondaryLanguages': ['ta', 'en'] }).brand.languages).toEqual(['ta', 'en']);
    expect(ok({ tagline: 'x' }).brand.languages).toBeUndefined();
  });

  it('routes social links, policies, the website and the category sync', () => {
    const plan = ok({
      'social.instagram': 'instagram.com/kala',
      'social.facebook': null,
      'policy.return_policy': '7 day returns',
      'brand.websiteUrl': 'kala.in',
      category: 'restaurant',
    });
    expect(plan.social).toEqual([
      { provider: 'instagram', url: 'https://instagram.com/kala' },
      { provider: 'facebook', url: null },
    ]);
    expect(plan.policies).toEqual([{ kind: 'return_policy', content: '7 day returns' }]);
    expect(plan.brand.websiteUrl).toBe('https://kala.in/');
    expect(plan.categoryChanged).toBe(true);
    expect(plan.category).toBe('restaurant');
  });

  it('reports every problem by field and writes nothing for a bad request', () => {
    expect(
      errors({
        contactEmail: 'nope',
        'summary.names': 'x',
        'connection.106': '5',
        'alias.60': 'x',
        notAField: 1,
        'brand.name': '',
        pack_travel_destinations: ['Goa'],
      }),
    ).toEqual({
      contactEmail: 'Enter a valid email address',
      'summary.names': 'This field cannot be edited here',
      'connection.106': 'This field cannot be edited here',
      'alias.60': 'This field cannot be edited here',
      notAField: 'This field does not exist',
      'brand.name': 'This is required',
      pack_travel_destinations: 'This field does not exist',
    });
  });

  it('accepts a pack field in the same save that sets its category', () => {
    const plan = ok({ category: 'restaurant', pack_restaurant_cuisines: ['North Indian'] }, { ...business, category: null });
    expect(plan.attributes.set).toEqual({ pack_restaurant_cuisines: ['North Indian'] });
    expect(errors({ pack_restaurant_cuisines: ['x'] }, { ...business, category: null })).toEqual({
      pack_restaurant_cuisines: 'This field does not exist',
    });
  });

  it('only accepts fields for the account type', () => {
    expect(errors({ legalName: 'Kala Pvt Ltd' }, { track: 'creator', category: null, languages: ['en'] })).toEqual({
      legalName: 'This field does not exist',
    });
    expect(errors({ niche: 'cooking' })).toEqual({ niche: 'This field does not exist' });
  });
});
