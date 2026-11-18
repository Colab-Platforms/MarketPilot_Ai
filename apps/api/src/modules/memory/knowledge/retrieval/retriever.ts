import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService, type TenantTx } from '@/infra/prisma';
import { AiService } from '@/modules/ai';
import { keywordTerms, rankCandidates } from './fuse';

const DEFAULT_LIMIT = 6;
const MAX_LIMIT = 20;
// Each search over-fetches, so fusion has something to choose between.
const CANDIDATES_PER_SEARCH = 30;
// Below this cosine similarity a vector hit is noise, not a match.
const MIN_SIMILARITY = 0.2;

export interface RetrieveOptions {
  limit?: number;
  // Restrict to kinds of memory, such as ['product', 'service'] or ['profile:brand'].
  entityTypes?: string[];
}

export interface Passage {
  chunkId: string;
  text: string;
  score: number;
  // 'page' for crawled website text, otherwise the kind of record ('product', 'profile:brand', ...).
  kind: string;
  entityId: string | null;
  title: string | null;
  url: string | null;
}

export interface RetrievalResult {
  passages: Passage[];
  // 'keyword' when the embedding model was unavailable and only full-text search ran.
  mode: 'hybrid' | 'keyword';
}

interface Row {
  id: string;
  content: string;
  entity_type: string | null;
  entity_id: string | null;
  metadata: { title?: string } | null;
  doc_title: string | null;
  url: string | null;
  // Set only by the vector search.
  similarity?: number | null;
}

// Hybrid search over one brand's memory: vector similarity, nudged by full-text keyword matches.
// The brand filter is inside both queries, and the tenant session variable backs it with RLS.
@Injectable()
export class Retriever {
  private readonly logger = new Logger(Retriever.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiService,
  ) {}

  async retrieve(workspaceId: string, brandId: string, question: string, options: RetrieveOptions = {}): Promise<RetrievalResult> {
    const text = question.trim();
    if (!text) return { passages: [], mode: 'hybrid' };
    const limit = Math.min(Math.max(options.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);
    const vector = await this.embedQuestion(text);
    const terms = keywordTerms(text);

    return this.prisma.withTenant(workspaceId, async (tx) => {
      const entityFilter = options.entityTypes?.length
        ? Prisma.sql`AND c.entity_type = ANY(${options.entityTypes}::text[])`
        : Prisma.empty;
      const [semantic, keyword] = await Promise.all([
        vector ? this.vectorSearch(tx, brandId, vector, entityFilter) : Promise.resolve([] as Row[]),
        terms.length > 0 ? this.keywordSearch(tx, brandId, terms, entityFilter) : Promise.resolve([] as Row[]),
      ]);

      const byId = new Map<string, Row>([...keyword, ...semantic].map((row) => [row.id, row]));
      const ranked = rankCandidates(
        [...byId.values()].map((row) => ({ id: row.id, content: row.content, similarity: row.similarity ?? undefined })),
        terms,
      ).slice(0, limit);
      return {
        mode: vector ? 'hybrid' : 'keyword',
        passages: ranked.map(({ id, score }) => toPassage(byId.get(id) as Row, score)),
      } satisfies RetrievalResult;
    });
  }

  // Null when the model is unavailable: search then falls back to keywords rather than failing.
  private async embedQuestion(question: string): Promise<string | null> {
    if (!this.ai.available) return null;
    try {
      const { vectors } = await this.ai.embed([question]);
      return vectors[0] ? `[${vectors[0].join(',')}]` : null;
    } catch (error) {
      this.logger.warn(`Question embedding failed: ${error instanceof Error ? error.message : 'unknown'}`);
      return null;
    }
  }

  private async vectorSearch(tx: TenantTx, brandId: string, vector: string, entityFilter: Prisma.Sql): Promise<Row[]> {
    // Lets the vector index keep scanning past other tenants' rows until it has enough of this brand's.
    await tx.$executeRaw`SELECT set_config('hnsw.iterative_scan', 'relaxed_order', true)`;
    return tx.$queryRaw<Row[]>`
      SELECT c.id, c.content, c.entity_type, c.entity_id, c.metadata, d.title AS doc_title, d.url,
        (1 - (e.embedding <=> ${vector}::halfvec(1024)))::float8 AS similarity
      FROM knowledge_embedding e
      JOIN knowledge_chunk c ON c.id = e.chunk_id
      LEFT JOIN knowledge_document d ON d.id = c.document_id
      WHERE e.brand_id = ${brandId}::uuid
        AND e.status = 'ready'
        AND c.state = 'active'
        AND 1 - (e.embedding <=> ${vector}::halfvec(1024)) >= ${MIN_SIMILARITY}
        ${entityFilter}
      ORDER BY e.embedding <=> ${vector}::halfvec(1024)
      LIMIT ${CANDIDATES_PER_SEARCH}`;
  }

  private keywordSearch(tx: TenantTx, brandId: string, terms: string[], entityFilter: Prisma.Sql): Promise<Row[]> {
    const query = terms.join(' | ');
    return tx.$queryRaw<Row[]>`
      SELECT c.id, c.content, c.entity_type, c.entity_id, c.metadata, d.title AS doc_title, d.url
      FROM knowledge_chunk c
      LEFT JOIN knowledge_document d ON d.id = c.document_id
      WHERE c.brand_id = ${brandId}::uuid
        AND c.state = 'active'
        AND c.search_text @@ to_tsquery('simple', ${query})
        ${entityFilter}
      ORDER BY ts_rank_cd(c.search_text, to_tsquery('simple', ${query})) DESC
      LIMIT ${CANDIDATES_PER_SEARCH}`;
  }
}

function toPassage(row: Row, score: number): Passage {
  return {
    chunkId: row.id,
    text: row.content,
    score,
    kind: row.entity_type ?? 'page',
    entityId: row.entity_id,
    title: row.metadata?.title ?? row.doc_title,
    url: row.url,
  };
}
