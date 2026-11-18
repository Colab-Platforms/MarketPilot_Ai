export type MemorySource = 'user_stated' | 'uploaded_or_crawled' | 'ai_inferred';

export interface ChunkInput {
  sourceId: string;
  text: string;
  source: MemorySource;
  tags: string[];
  contentHash: string;
}

export interface EpisodeInput {
  contextBundleId: string;
  kind: 'post' | 'ad' | 'reply' | 'email';
  text: string;
  outcomeScore?: number;
}

export interface SearchQuery {
  text: string;
  limit: number;
  tags?: string[];
}

export interface ScoredChunk {
  id: string;
  text: string;
  score: number;
  source: MemorySource;
}

export interface ScoredEpisode {
  id: string;
  text: string;
  score: number;
  outcomeScore: number | null;
}

export interface MemoryStore {
  upsertChunks(brandId: string, chunks: ChunkInput[]): Promise<void>;
  searchChunks(brandId: string, query: SearchQuery): Promise<ScoredChunk[]>;
  recordEpisode(brandId: string, episode: EpisodeInput): Promise<string>;
  similarEpisodes(brandId: string, query: SearchQuery): Promise<ScoredEpisode[]>;
  deleteBySource(brandId: string, sourceId: string): Promise<void>;
}

export const MEMORY_STORE = Symbol('MEMORY_STORE');
