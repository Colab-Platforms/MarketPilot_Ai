import type { BrandProduct, BrandService } from '@prisma/client';
import type { ProfileFieldState, ProfileResponse } from '@marketpilot/contracts';
import { productDocument, profileDocuments, serviceDocument } from './entity-documents';

const field = (overrides: Partial<ProfileFieldState>): ProfileFieldState => ({
  id: 1,
  key: 'k',
  label: 'Label',
  kind: 'text',
  editable: true,
  sources: [],
  value: null,
  display: null,
  status: 'owner',
  sourceUrl: null,
  updatedAt: null,
  ...overrides,
});

const profile = (fields: ProfileFieldState[]): ProfileResponse => ({
  brand: { id: 'b1', name: 'Aayush', websiteUrl: null, accountType: 'business', category: null },
  completeness: { filled: 0, total: 0 },
  sections: [{ id: 'brand', title: 'Brand', description: '', filled: 0, total: 0, skipped: false, canSkip: true, fields }],
});

describe('profileDocuments', () => {
  it('writes the approved facts of a section into one document', () => {
    const [doc] = profileDocuments(
      profile([
        field({ label: 'Mission', value: 'Preventive wellness for everyday life' }),
        field({ label: 'Values', kind: 'tags', value: ['Integrity', 'Transparency'] }),
      ]),
    );
    expect(doc).toMatchObject({ entityType: 'profile:brand', entityId: 'b1' });
    expect(doc!.text).toContain('Mission: Preventive wellness for everyday life');
    expect(doc!.text).toContain('Values: Integrity, Transparency');
  });

  it('shows an option by its label, not its stored value', () => {
    const [doc] = profileDocuments(
      profile([field({ label: 'Tone', kind: 'select', value: 'warm', options: [{ value: 'warm', label: 'Warm and friendly' }] })]),
    );
    expect(doc!.text).toContain('Tone: Warm and friendly');
  });

  it('leaves out missing, derived and contact-style fields, and empty sections', () => {
    const docs = profileDocuments(
      profile([
        field({ label: 'Empty', status: 'missing' }),
        field({ label: 'Catalogue', status: 'derived', value: '24 products' }),
        field({ label: 'Phone', kind: 'phone', value: '+91 98765 43210' }),
      ]),
    );
    expect(docs).toEqual([]);
  });
});

describe('catalogue documents', () => {
  it('keeps price and availability out of the searchable text', () => {
    const doc = productDocument({
      id: 'p1',
      name: 'Shilajit Drops',
      category: 'Supplements',
      description: 'Himalayan resin drops',
      tags: ['ayurveda'],
      priceMinor: 149900,
      availability: 'in_stock',
    } as unknown as BrandProduct);
    expect(doc.text).toContain('Product: Shilajit Drops');
    expect(doc.text).toContain('Tags: ayurveda');
    expect(doc.text).not.toMatch(/1499|in_stock/);
  });

  it('describes a service with how to book it', () => {
    const doc = serviceDocument({
      id: 's1',
      name: 'Haircut',
      description: null,
      benefits: ['Fresh look'],
      durationMinutes: 45,
      bookingProcess: 'Call or WhatsApp',
    } as unknown as BrandService);
    expect(doc).toMatchObject({ entityType: 'service', title: 'Haircut' });
    expect(doc.text).toContain('Duration: 45 minutes');
    expect(doc.text).toContain('How to book: Call or WhatsApp');
  });
});
