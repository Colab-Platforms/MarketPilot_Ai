import { createHash } from 'node:crypto';

export interface Chunk {
  ordinal: number;
  content: string;
  contentHash: string;
  tokenCount: number;
}

const TARGET_CHARS = 1_000;
const MIN_CHARS = 150;
const OVERLAP_CHARS = 150;
export const MAX_CHUNKS_PER_DOCUMENT = 40;

// Sentence ends in English and Devanagari (the danda), where a space follows.
const SENTENCE_END = /(?<=[.!?\u0964])\s+/;

const hash = (text: string) => createHash('sha256').update(text).digest('hex');

// Splits page text into overlapping, sentence-aligned pieces small enough to embed
// and retrieve precisely. The overlap keeps a fact from being cut off from its context.
export function chunkText(text: string): Chunk[] {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length < MIN_CHARS) return clean ? [toChunk(0, clean)] : [];

  const sentences = clean.split(SENTENCE_END).flatMap((s) => splitLong(s));
  const chunks: string[] = [];
  let current = '';
  for (const sentence of sentences) {
    if (current && current.length + sentence.length + 1 > TARGET_CHARS) {
      chunks.push(current);
      const tail = current.slice(-OVERLAP_CHARS);
      current = `${tail.slice(tail.indexOf(' ') + 1)} ${sentence}`;
    } else {
      current = current ? `${current} ${sentence}` : sentence;
    }
  }
  if (current.length >= MIN_CHARS || chunks.length === 0) chunks.push(current);
  else if (chunks.length > 0) chunks[chunks.length - 1] += ` ${current}`;

  return chunks.slice(0, MAX_CHUNKS_PER_DOCUMENT).map((content, ordinal) => toChunk(ordinal, content));
}

// A "sentence" with no punctuation (menus, lists) is cut on whitespace so it still fits.
function splitLong(sentence: string): string[] {
  if (sentence.length <= TARGET_CHARS) return [sentence];
  const parts: string[] = [];
  let rest = sentence;
  while (rest.length > TARGET_CHARS) {
    const cut = rest.lastIndexOf(' ', TARGET_CHARS);
    const at = cut > MIN_CHARS ? cut : TARGET_CHARS;
    parts.push(rest.slice(0, at));
    rest = rest.slice(at).trimStart();
  }
  if (rest) parts.push(rest);
  return parts;
}

function toChunk(ordinal: number, content: string): Chunk {
  return { ordinal, content, contentHash: hash(content), tokenCount: Math.ceil(content.length / 4) };
}
