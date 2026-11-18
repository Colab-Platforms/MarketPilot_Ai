import { buildProfileResponse, type ProfileData } from './profile-read';

const data = (overrides: Partial<ProfileData> = {}): ProfileData => ({
  accountType: 'business',
  brand: {
    id: '0190aaaa-0000-7000-8000-000000000001',
    name: 'Kala Sarees',
    websiteUrl: 'https://kala.in/',
    scale: 'small',
    languages: ['hi', 'en'],
  },
  profile: {
    category: 'fashion',
    description: 'Handwoven sarees.',
    city: 'Pune',
    contactEmail: 'hello@kala.in',
    monthlyBudgetMinor: 500000,
    operatingHours: { text: 'Mon to Sat, 10 to 7' },
    branches: ['Mumbai'],
    serviceAreas: [],
    yearEstablished: 2011,
    attributes: { audienceSummary: 'Women 25 to 45', adBudgetMinor: 200000, pack_fashion_sizes: ['S', 'M'] },
    provenance: {
      description: { sourceType: 'crawled', sourceUrl: 'https://kala.in/', verifiedAt: '2026-11-13T10:00:00.000Z' },
      city: { sourceType: 'user_stated', verifiedAt: '2026-11-13T10:01:00.000Z' },
    },
  },
  socials: [
    {
      provider: 'instagram',
      profileUrl: 'https://instagram.com/kala',
      sourceType: 'crawled',
      sourceUrl: 'https://kala.in/',
      status: 'verified',
      createdAt: new Date(2026, 1, 1),
      verifiedAt: new Date(2026, 1, 2),
    },
  ],
  policies: [
    { kind: 'return_policy', content: '7 day returns', sourceType: 'user_stated', sourceUrl: null, updatedAt: new Date(2026, 1, 3) },
  ],
  products: [
    { name: 'Chanderi', category: 'Saree', description: 'Light', imageUrls: ['a.jpg'], priceMinor: 149900, currency: 'INR', availability: 'in_stock' },
    { name: 'Paithani', category: 'Saree', description: null, imageUrls: [], priceMinor: 499900, currency: 'INR', availability: 'out_of_stock' },
  ],
  ...overrides,
});

const fieldOf = (res: ReturnType<typeof buildProfileResponse>, key: string) =>
  res.sections.flatMap((s) => s.fields).find((f) => f.key === key)!;

describe('buildProfileResponse', () => {
  const res = buildProfileResponse(data());

  it('reads columns, attributes and brand fields in the form the editor expects', () => {
    expect(fieldOf(res, 'brand.name').value).toBe('Kala Sarees');
    expect(fieldOf(res, 'brand.language').value).toBe('hi');
    expect(fieldOf(res, 'brand.secondaryLanguages').value).toEqual(['en']);
    expect(fieldOf(res, 'monthlyBudgetMinor').value).toBe(5000);
    expect(fieldOf(res, 'adBudgetMinor').value).toBe(2000);
    expect(fieldOf(res, 'operatingHours').value).toBe('Mon to Sat, 10 to 7');
    expect(fieldOf(res, 'branches').value).toEqual(['Mumbai']);
    expect(fieldOf(res, 'yearEstablished').value).toBe(2011);
    expect(fieldOf(res, 'audienceSummary').value).toBe('Women 25 to 45');
    expect(fieldOf(res, 'social.instagram').value).toBe('https://instagram.com/kala');
    expect(fieldOf(res, 'policy.return_policy').value).toBe('7 day returns');
  });

  it('reports where each value came from', () => {
    expect(fieldOf(res, 'description')).toMatchObject({ status: 'website', sourceUrl: 'https://kala.in/' });
    expect(fieldOf(res, 'city').status).toBe('owner');
    expect(fieldOf(res, 'social.instagram').status).toBe('website');
    expect(fieldOf(res, 'policy.return_policy').status).toBe('owner');
    expect(fieldOf(res, 'legalName').status).toBe('missing');
    expect(fieldOf(res, 'serviceAreas').status).toBe('missing');
  });

  it('derives catalogue summaries and marks connected-account fields', () => {
    expect(fieldOf(res, 'summary.names').display).toBe('2 products: Chanderi, Paithani');
    expect(fieldOf(res, 'summary.pricing').display).toContain('1,499');
    expect(fieldOf(res, 'summary.images').display).toBe('1 of 2 have an image');
    expect(fieldOf(res, 'summary.names')).toMatchObject({ status: 'derived', editable: false });
    expect(fieldOf(res, 'connection.106')).toMatchObject({ status: 'needs_connection', editable: false });
    expect(fieldOf(buildProfileResponse(data({ products: [] })), 'summary.names').status).toBe('missing');
  });

  it('shows the pack for the brand category only, and mirrors the brand name', () => {
    expect(res.sections.some((s) => s.id === 'specific')).toBe(true);
    expect(fieldOf(res, 'pack_fashion_sizes').value).toEqual(['S', 'M']);
    const other = buildProfileResponse(data({ profile: { category: 'services' } }));
    expect(other.sections.some((s) => s.id === 'specific')).toBe(false);
    expect(fieldOf(res, 'alias.60')).toMatchObject({ value: 'Kala Sarees', editable: false });
  });

  it('counts completeness without connection-only fields or repeats', () => {
    const social = res.sections.find((s) => s.id === 'social')!;
    expect(social.fields.length).toBeGreaterThan(social.total);
    const brandSection = res.sections.find((s) => s.id === 'brand')!;
    const counted = brandSection.fields.filter((f) => !f.hidden && !f.key.startsWith('alias.'));
    expect(brandSection.total).toBe(counted.length);
    expect(res.completeness.total).toBe(res.sections.reduce((n, s) => n + s.total, 0));
    expect(res.completeness.filled).toBeGreaterThan(5);
    expect(res.completeness.filled).toBeLessThan(res.completeness.total);
  });

  it('keeps hidden fields and their values but leaves them out of the counts', () => {
    expect(fieldOf(res, 'yearEstablished')).toMatchObject({ value: 2011, hidden: true });
    expect(fieldOf(res, 'city').hidden).toBeUndefined();
    const basics = res.sections.find((s) => s.id === 'basics')!;
    expect(basics.total).toBe(basics.fields.filter((f) => !f.hidden).length);
  });

  it('leaves a section the owner switched off out of overall completeness', () => {
    const before = buildProfileResponse(data());
    const goals = before.sections.find((s) => s.id === 'goals')!;
    const after = buildProfileResponse(data({ profile: { ...data().profile, skippedSections: ['goals', 'basics'] } }));

    expect(after.sections.find((s) => s.id === 'goals')).toMatchObject({ skipped: true, canSkip: true });
    expect(after.completeness.total).toBe(before.completeness.total - goals.total);
    expect(after.completeness.filled).toBe(before.completeness.filled - goals.filled);
    // The core section can never be switched off, even if storage says so.
    expect(after.sections.find((s) => s.id === 'basics')).toMatchObject({ skipped: false, canSkip: false });
  });

  it('hides business-only fields from creators', () => {
    const creator = buildProfileResponse(data({ accountType: 'creator' }));
    const keys = creator.sections.flatMap((s) => s.fields).map((f) => f.key);
    expect(keys).not.toContain('legalName');
    expect(keys).toContain('niche');
  });
});
