import { domainOf, verifyCompetitors } from './verify-competitors';

const item = (name: string, website: string, extra: Record<string, unknown> = {}) => ({
  name,
  website,
  summary: 'Ayurvedic supplements sold online.',
  whySimilar: 'Sells herbal wellness products to the same customers.',
  offerings: ['Gummies', 'Gummies', 'Capsules'],
  priceRange: null,
  positioning: null,
  ...extra,
});

const sources = ['https://www.muditam.com/', 'https://biotane.in/products/x', 'https://www.amazon.in/s?k=ayurveda'];
const none = { ownDomain: null, knownDomains: [] };

describe('verifyCompetitors', () => {
  it('keeps only competitors whose website the web search actually returned', () => {
    const result = verifyCompetitors(
      { competitors: [item('Muditam', 'muditam.com'), item('Invented Herbs', 'https://invented-herbs.in')] },
      sources,
      none,
    );
    expect(result.map((c) => c.name)).toEqual(['Muditam']);
    expect(result[0]).toMatchObject({
      websiteUrl: 'https://muditam.com/',
      domain: 'muditam.com',
      evidence: ['https://www.muditam.com/'],
      offerings: ['Gummies', 'Capsules'],
    });
  });

  it('matches a shop subdomain to the main site', () => {
    const result = verifyCompetitors({ competitors: [item('Biotane', 'https://shop.biotane.in')] }, sources, none);
    expect(result).toHaveLength(1);
  });

  it('drops marketplaces, the business itself, competitors already listed and duplicates', () => {
    const result = verifyCompetitors(
      {
        competitors: [
          item('Amazon', 'https://www.amazon.in'),
          item('Us', 'https://muditam.com'),
          item('Biotane', 'https://biotane.in'),
          item('Biotane again', 'https://www.biotane.in/about'),
        ],
      },
      sources,
      { ownDomain: 'muditam.com', knownDomains: [] },
    );
    expect(result.map((c) => c.name)).toEqual(['Biotane']);
    expect(verifyCompetitors({ competitors: [item('Biotane', 'biotane.in')] }, sources, { ownDomain: null, knownDomains: ['biotane.in'] })).toEqual([]);
  });

  it('returns nothing for an answer that does not match the schema', () => {
    expect(verifyCompetitors({ nope: true }, sources, none)).toEqual([]);
    expect(verifyCompetitors({ competitors: [item('Muditam', 'muditam.com')] }, [], none)).toEqual([]);
  });

  it('normalises domains', () => {
    expect(domainOf('https://WWW.Muditam.com/path')).toBe('muditam.com');
    expect(domainOf('muditam.com')).toBe('muditam.com');
    expect(domainOf('localhost')).toBeNull();
    expect(domainOf('javascript:alert(1)')).toBeNull();
  });
});
