import { Injectable, Logger } from '@nestjs/common';
import { EmbeddingService } from './knowledge/embedding.service';
import { ContextBuilder, type BrandContext, type ContextRequest } from './knowledge/context/context-builder';
import { ReelContextReader, type ReelContext, type ReelContextRequest } from './knowledge/context/reel-context';
import { VisualContextReader, type VisualContext } from './knowledge/context/visual-context';
import { EntityIndexer } from './knowledge/entities/entity-indexer';
import { Retriever, type RetrievalResult, type RetrieveOptions } from './knowledge/retrieval/retriever';

// The one door to the Business Brain (CLAUDE.md rule 2). Features call this, never the tables.
@Injectable()
export class MemoryService {
  private readonly logger = new Logger(MemoryService.name);

  constructor(
    private readonly entities: EntityIndexer,
    private readonly embeddings: EmbeddingService,
    private readonly retriever: Retriever,
    private readonly contexts: ContextBuilder,
    private readonly visuals: VisualContextReader,
    private readonly reels: ReelContextReader,
  ) {}

  // Everything an AI task needs to know about the business, in one block within a token
  // budget: confirmed core facts, the live catalogue, and the most relevant passages.
  buildContext(workspaceId: string, brandId: string, request: ContextRequest): Promise<BrandContext> {
    return this.contexts.build(workspaceId, brandId, request);
  }

  // What an image task needs: confirmed visual identity, the owner's past posts as style
  // references and, if given, one product with its photos. `product` is null when the id is
  // not one of this brand's products.
  visualContext(workspaceId: string, brandId: string, productId: string | null): Promise<VisualContext> {
    return this.visuals.read(workspaceId, brandId, productId);
  }

  // What a reel task needs: the brand without its catalogue, the one product the reel is about
  // (null when the id is not this brand's), the market for trends, and the brief's defaults.
  reelContext(workspaceId: string, brandId: string, request: ReelContextRequest): Promise<ReelContext> {
    return this.reels.read(workspaceId, brandId, request);
  }

  // The passages most relevant to a question, from the website, profile and catalogue,
  // each with where it came from. Prices and stock must still be read from the records.
  retrieve(workspaceId: string, brandId: string, question: string, options?: RetrieveOptions): Promise<RetrievalResult> {
    return this.retriever.retrieve(workspaceId, brandId, question, options);
  }

  // Call after the owner saves or approves anything in the profile or catalogue. It never
  // throws: the owner's save has already succeeded, and indexing is retried on the next call.
  async syncEntities(workspaceId: string, brandId: string): Promise<void> {
    try {
      await this.entities.sync(workspaceId, brandId);
      void this.embeddings.indexBrand(workspaceId, brandId).catch((error: unknown) => {
        this.logger.warn(`Embedding failed: ${error instanceof Error ? error.message : 'unknown'}`);
      });
    } catch (error) {
      this.logger.warn(`Syncing brand memory failed: ${error instanceof Error ? error.message : 'unknown'}`);
    }
  }
}
