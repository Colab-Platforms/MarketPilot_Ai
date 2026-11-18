import type { LlmPort, StructuredRequest } from '@/infra/llm-providers';
import { discoverCompetitors, type CompetitorDiscoveryInput } from './competitors-discover.task';
import { marketOf } from './market';
import { fallbackQueries } from './plan-queries';

const signals = {
  city: 'Mumbai',
  country: 'IN',
  serviceAreas: [],
  audienceLocations: [],
  salesChannels: [],
  operatingModel: null,
  onlineStoreUrl: null,
};

describe('marketOf', () => {
  it('treats a business with only a city as local', () => {
    expect(marketOf(signals)).toEqual({ scope: 'local', area: 'Mumbai' });
  });

  it('treats online sellers and pan-India audiences as national', () => {
    expect(marketOf({ ...signals, audienceLocations: ['Pan-India', 'Tier 1 to Tier 4 cities'] })).toEqual({
      scope: 'national',
      area: 'India',
    });
    expect(marketOf({ ...signals, salesChannels: ['website'] }).scope).toBe('national');
    expect(marketOf({ ...signals, operatingModel: 'd2c' }).scope).toBe('national');
    expect(marketOf({ ...signals, city: null }).scope).toBe('national');
  });
});

const input: CompetitorDiscoveryInput = {
  brandName: 'Aayush Wellness',
  websiteUrl: 'https://www.aayushwellness.com/',
  category: 'other',
  subcategory: 'Nutraceuticals and herbal wellness',
  description: null,
  offerings: ['Liver detox gummies', 'Shilajit drops'],
  audience: null,
  market: { scope: 'national', area: 'India' },
  knownCompetitors: [],
  knownDomains: [],
  wanted: 4,
};

describe('fallbackQueries', () => {
  it('builds plain queries that always name the market', () => {
    const queries = fallbackQueries(input);
    expect(queries.length).toBeGreaterThanOrEqual(3);
    expect(queries.every((q) => q.endsWith('in India'))).toBe(true);
  });
});

describe('discoverCompetitors', () => {
  const usage = { model: 'm', promptTokens: 10, completionTokens: 5, costUsd: 0.01 };
  const competitor = (name: string, website: string) => ({
    name,
    website,
    summary: null,
    whySimilar: 'Same customers.',
    offerings: [],
    priceRange: null,
    positioning: null,
  });

  function fakeLlm(): { llm: LlmPort; calls: StructuredRequest[] } {
    const calls: StructuredRequest[] = [];
    const llm = {
      available: true,
      async generateStructured(request: StructuredRequest) {
        calls.push(request);
        if (request.task === 'competitors.plan') {
          return { data: { queries: ['liver detox gummies brands India', 'shilajit brands India', 'wellness brands like Aayush'] }, usage, sources: [] };
        }
        if (request.task === 'competitors.recall') {
          return {
            data: { brands: [{ name: 'Himalaya', website: 'himalayawellness.in', note: 'Leading herbal brand' }] },
            usage,
            sources: [],
          };
        }
        if (request.task === 'competitors.search') {
          const kapiva = { name: 'Kapiva', website: 'https://kapiva.in', note: 'Ayurvedic D2C brand' };
          return {
            data: { brands: [kapiva, { name: 'Us', website: 'https://aayushwellness.com', note: '' }] },
            usage,
            sources: ['https://www.kapiva.in/'],
          };
        }
        return {
          data: {
            competitors: [
              competitor('Kapiva', 'https://kapiva.in'),
              competitor('Himalaya', 'https://himalayawellness.in'),
              competitor('Made Up', 'https://made-up.in'),
            ],
          },
          usage,
          sources: [],
        };
      },
      embed: () => Promise.reject(new Error('unused')),
      converse: () => Promise.reject(new Error('unused')),
    } as LlmPort;
    return { llm, calls };
  }

  it('plans, searches each query, recalls known leaders, and keeps only grounded picks', async () => {
    const { llm, calls } = fakeLlm();
    const result = await discoverCompetitors(llm, { plan: 'fast', search: 'fast', rank: 'smart', engine: 'exa' }, input);

    const searches = calls.filter((c) => c.task === 'competitors.search');
    expect(searches).toHaveLength(3);
    expect(searches[0]!.webSearch).toEqual({ maxResults: 8, engine: 'exa' });
    expect(searches[0]!.user.startsWith('liver detox gummies brands India')).toBe(true);
    expect(calls.find((c) => c.task === 'competitors.recall')!.webSearch).toBeUndefined();

    const rank = calls.find((c) => c.task === 'competitors.rank')!;
    expect(rank.webSearch).toBeUndefined();
    expect(rank.user).toContain('Kapiva | https://kapiva.in | found by 3 searches');
    expect(rank.user).toContain('Himalaya | himalayawellness.in | a leading brand in this market');
    expect(rank.user).not.toContain('aayushwellness.com |');

    // "Made Up" was neither searched nor recalled, so ranking cannot introduce it.
    expect(result.competitors.map((c) => [c.name, c.grounding])).toEqual([
      ['Kapiva', 'search'],
      ['Himalaya', 'knowledge'],
    ]);
    expect(result.usage.costUsd).toBeCloseTo(0.06);
  });
});
