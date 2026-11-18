import { Injectable, Logger } from '@nestjs/common';
import { LlmError } from '@/infra/llm-providers';
import { PrismaService } from '@/infra/prisma';
import { AiService, EMBEDDING_DIMENSIONS } from '@/modules/ai';
import { chunkText } from './chunker';

const BATCH_SIZE = 32;
const MAX_BATCHES_PER_RUN = 12;
// Bump when the chunking rules change, so old vectors are rebuilt rather than mixed in.
const EMBEDDING_VERSION = '1';

export interface IndexResult {
  chunksCreated: number;
  embedded: number;
  // Chunks still waiting: the model was unavailable or the run hit its batch limit.
  pending: number;
}

// Turns crawled pages into searchable memory: chunks (full-text searchable at once) and
// vectors (once the embedding model answers). Vectors are derived and rebuildable.
@Injectable()
export class EmbeddingService {
  private readonly logger = new Logger(EmbeddingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiService,
  ) {}

  async indexBrand(workspaceId: string, brandId: string): Promise<IndexResult> {
    const chunksCreated = await this.prisma.withTenant(workspaceId, (tx) => this.prepare(tx, workspaceId, brandId));
    if (!this.ai.available) return { chunksCreated, embedded: 0, pending: await this.countPending(workspaceId, brandId) };

    let embedded = 0;
    for (let batch = 0; batch < MAX_BATCHES_PER_RUN; batch++) {
      const done = await this.embedBatch(workspaceId, brandId);
      if (done === null) break;
      embedded += done;
      if (done === 0) break;
    }
    return { chunksCreated, embedded, pending: await this.countPending(workspaceId, brandId) };
  }

  private async prepare(tx: Parameters<Parameters<PrismaService['withTenant']>[1]>[0], workspaceId: string, brandId: string) {
    // A superseded page's chunks must stop appearing in search.
    await tx.knowledgeChunk.updateMany({
      where: { brandId, state: 'active', document: { state: { not: 'active' } } },
      data: { state: 'superseded' },
    });

    const documents = await tx.knowledgeDocument.findMany({
      where: { brandId, state: 'active', chunks: { none: {} } },
      select: { id: true, sourceId: true, language: true, content: true, version: true },
    });
    let created = 0;
    for (const document of documents) {
      const chunks = chunkText(document.content);
      if (chunks.length === 0) continue;
      const result = await tx.knowledgeChunk.createMany({
        data: chunks.map((chunk) => ({
          workspaceId,
          brandId,
          sourceId: document.sourceId,
          documentId: document.id,
          ordinal: chunk.ordinal,
          content: chunk.content,
          contentHash: chunk.contentHash,
          tokenCount: chunk.tokenCount,
          language: document.language,
          // Versioned with the page: re-reading an unchanged page must still get its own live chunks.
          version: document.version,
        })),
        skipDuplicates: true,
      });
      created += result.count;
    }

    const model = this.ai.embeddingModel;
    const unembedded = await tx.knowledgeChunk.findMany({
      where: { brandId, state: 'active', embeddings: { none: { embeddingModel: model, embeddingVersion: EMBEDDING_VERSION } } },
      select: { id: true },
    });
    await tx.knowledgeEmbedding.createMany({
      data: unembedded.map((chunk) => ({
        workspaceId,
        brandId,
        chunkId: chunk.id,
        embeddingModel: model,
        embeddingVersion: EMBEDDING_VERSION,
      })),
      skipDuplicates: true,
    });
    return created;
  }

  // Returns how many were embedded, or null when there is nothing left to do or the model failed.
  private async embedBatch(workspaceId: string, brandId: string): Promise<number | null> {
    const pending = await this.prisma.withTenant(workspaceId, (tx) =>
      tx.knowledgeEmbedding.findMany({
        where: {
          brandId,
          status: 'pending',
          embeddingModel: this.ai.embeddingModel,
          embeddingVersion: EMBEDDING_VERSION,
          chunk: { state: 'active' },
        },
        include: { chunk: { select: { content: true } } },
        take: BATCH_SIZE,
      }),
    );
    if (pending.length === 0) return null;

    let vectors: number[][];
    try {
      ({ vectors } = await this.ai.embed(pending.map((row) => row.chunk.content)));
    } catch (error) {
      // Left pending on purpose: the next run retries them.
      this.logger.warn(`Embedding failed (${error instanceof LlmError ? error.reason : 'unknown'})`);
      return null;
    }

    await this.prisma.withTenant(workspaceId, async (tx) => {
      for (const [index, row] of pending.entries()) {
        const vector = vectors[index];
        if (!vector || vector.length !== EMBEDDING_DIMENSIONS) continue;
        // halfvec has no Prisma type; the vector goes in as pgvector text.
        await tx.$executeRaw`
          UPDATE knowledge_embedding
          SET embedding = CAST(${`[${vector.join(',')}]`} AS halfvec(1024)), status = 'ready'::"EmbeddingStatus"
          WHERE id = ${row.id}::uuid`;
      }
    });
    return pending.length;
  }

  private countPending(workspaceId: string, brandId: string): Promise<number> {
    return this.prisma.withTenant(workspaceId, (tx) =>
      tx.knowledgeEmbedding.count({ where: { brandId, status: 'pending', chunk: { state: 'active' } } }),
    );
  }
}
