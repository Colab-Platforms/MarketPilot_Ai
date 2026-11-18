// Semantic similarity leads; keywords only nudge. Rank fusion was tried first and let a chunk
// that loosely shares one word ("customer") outrank the page that actually answers the question,
// because it throws away how close each match is.
const KEYWORD_BOOST = 0.1;

export interface Candidate {
  id: string;
  content: string;
  // Cosine similarity from the vector search; absent when only the keyword search found it.
  similarity?: number;
}

// Share of the question's keywords that appear in the text: lifts exact names and terms
// ("shilajit", a SKU) that embeddings can blur.
export function keywordCoverage(terms: readonly string[], text: string): number {
  if (terms.length === 0) return 0;
  const words = new Set(tokenize(text));
  return terms.filter((term) => words.has(term)).length / terms.length;
}

export function rankCandidates(candidates: Candidate[], terms: readonly string[]): { id: string; score: number }[] {
  const semantic = candidates.some((c) => c.similarity !== undefined);
  return candidates
    .map((c) => {
      const coverage = keywordCoverage(terms, c.content);
      return { id: c.id, score: semantic ? (c.similarity ?? 0) + KEYWORD_BOOST * coverage : coverage };
    })
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score);
}

// Words that match nearly every chunk and so say nothing about what is being asked.
const STOP_WORDS = new Set(
  (
    'a an and are as at be by can could do does for from had has have how i if in is it its me my of on or our ' +
    'so than that the their them then there these they this to us was we were what when where which who why will ' +
    'with would you your about tell give show please any all some'
  ).split(' '),
);
const MAX_TERMS = 12;

function tokenize(text: string): string[] {
  return text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
}

// Turns a question into search terms. Only letters and digits survive, so nothing in the
// question can act as full-text query syntax.
export function keywordTerms(question: string): string[] {
  const terms = tokenize(question).filter((word) => word.length > 1 && !STOP_WORDS.has(word));
  return [...new Set(terms)].slice(0, MAX_TERMS);
}
