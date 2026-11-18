import { MAX_CHUNKS_PER_DOCUMENT, chunkText } from './chunker';

const sentence = (n: number) => `This is sentence number ${n} about handloom sarees woven by village weavers in Pune.`;

describe('chunkText', () => {
  it('returns nothing for empty text and one chunk for a short page', () => {
    expect(chunkText('   ')).toEqual([]);
    const short = chunkText('We sell sarees.');
    expect(short).toHaveLength(1);
    expect(short[0]).toMatchObject({ ordinal: 0, content: 'We sell sarees.' });
  });

  it('splits long text into sentence-aligned chunks near the target size, in order', () => {
    const text = Array.from({ length: 80 }, (_, i) => sentence(i)).join(' ');
    const chunks = chunkText(text);
    expect(chunks.length).toBeGreaterThan(3);
    expect(chunks.map((c) => c.ordinal)).toEqual(chunks.map((_, i) => i));
    for (const chunk of chunks) {
      expect(chunk.content.length).toBeLessThanOrEqual(1_200);
      expect(chunk.tokenCount).toBe(Math.ceil(chunk.content.length / 4));
    }
    expect(chunks[0]!.content.startsWith('This is sentence number 0')).toBe(true);
  });

  it('overlaps neighbouring chunks so a fact is not cut off from its context', () => {
    const text = Array.from({ length: 40 }, (_, i) => sentence(i)).join(' ');
    const [first, second] = chunkText(text);
    const tailWords = first!.content.split(' ').slice(-4).join(' ');
    expect(second!.content).toContain(tailWords);
  });

  it('keeps every sentence of the source somewhere in the chunks', () => {
    const sentences = Array.from({ length: 30 }, (_, i) => sentence(i));
    const joined = chunkText(sentences.join(' ')).map((c) => c.content).join(' ');
    for (const s of sentences) expect(joined).toContain(s);
  });

  it('handles Devanagari sentence ends and unpunctuated walls of text', () => {
    const hindi = Array.from({ length: 60 }, (_, i) => `यह वाक्य संख्या ${i} है और बुनकरों के बारे में बताता है\u0964`).join(' ');
    expect(chunkText(hindi).length).toBeGreaterThan(1);
    const wall = Array.from({ length: 600 }, (_, i) => `item${i}`).join(' ');
    const chunks = chunkText(wall);
    expect(chunks.length).toBeGreaterThan(2);
    expect(chunks.every((c) => c.content.length <= 1_200)).toBe(true);
  });

  it('is deterministic, so re-reading an unchanged page produces the same hashes', () => {
    const text = Array.from({ length: 40 }, (_, i) => sentence(i)).join(' ');
    expect(chunkText(text).map((c) => c.contentHash)).toEqual(chunkText(text).map((c) => c.contentHash));
  });

  it('caps the number of chunks per document', () => {
    const text = Array.from({ length: 3_000 }, (_, i) => sentence(i)).join(' ');
    expect(chunkText(text)).toHaveLength(MAX_CHUNKS_PER_DOCUMENT);
  });
});
