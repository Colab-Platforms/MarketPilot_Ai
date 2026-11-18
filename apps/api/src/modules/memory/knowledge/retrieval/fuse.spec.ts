import { keywordCoverage, keywordTerms, rankCandidates } from './fuse';

describe('rankCandidates', () => {
  const terms = ['customer', 'contact', 'address'];

  it('keeps the closest semantic match first even when another shares a keyword', () => {
    const ranked = rankCandidates(
      [
        { id: 'contact-page', content: 'Reach us at Goregaon East, Mumbai', similarity: 0.45 },
        { id: 'audience', content: 'Ideal customer profile: everyday consumers', similarity: 0.3 },
      ],
      terms,
    );
    expect(ranked.map((r) => r.id)).toEqual(['contact-page', 'audience']);
  });

  it('lets an exact keyword match break a near tie', () => {
    const ranked = rankCandidates(
      [
        { id: 'generic', content: 'Our wellness range', similarity: 0.41 },
        { id: 'named', content: 'Contact us: customer address desk', similarity: 0.4 },
      ],
      terms,
    );
    expect(ranked[0]!.id).toBe('named');
  });

  it('ranks a keyword-only hit below real semantic matches', () => {
    const ranked = rankCandidates(
      [
        { id: 'semantic', content: 'unrelated words', similarity: 0.3 },
        { id: 'keyword-only', content: 'customer contact address' },
      ],
      terms,
    );
    expect(ranked.map((r) => r.id)).toEqual(['semantic', 'keyword-only']);
  });

  it('falls back to keyword coverage when there are no vectors', () => {
    const ranked = rankCandidates(
      [
        { id: 'one', content: 'customer' },
        { id: 'three', content: 'customer contact address' },
        { id: 'none', content: 'nothing here' },
      ],
      terms,
    );
    expect(ranked.map((r) => r.id)).toEqual(['three', 'one']);
  });
});

describe('keywordCoverage', () => {
  it('is the share of terms present as whole words', () => {
    expect(keywordCoverage(['gummies', 'price'], 'Wellness Gummies for adults')).toBe(0.5);
    expect(keywordCoverage([], 'anything')).toBe(0);
  });
});

describe('keywordTerms', () => {
  it('drops filler words and keeps the subject of the question', () => {
    expect(keywordTerms('What products do we sell?')).toEqual(['products', 'sell']);
  });

  it('keeps non-English words', () => {
    expect(keywordTerms('आयुर्वेदिक gummies')).toContain('gummies');
  });

  it('cannot carry query syntax', () => {
    expect(keywordTerms("shilajit' | (drop & !table) :*")).toEqual(['shilajit', 'drop', 'table']);
  });

  it('is empty for a question with no content words', () => {
    expect(keywordTerms('what is it?')).toEqual([]);
  });
});
