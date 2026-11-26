import { Module } from '@nestjs/common';
import { AiModule } from '@/modules/ai';
import { BrandModule } from '@/modules/brand';
import { CompetitorDiscoveryService } from './competitors/competitor-discovery.service';
import { CompetitorService } from './competitors/competitor.service';
import { CrawlerPort } from './crawler/crawler.port';
import { HttpFetcher } from './crawler/http-fetcher';
import { EmbeddingService } from './embedding.service';
import { EntityIndexer } from './entities/entity-indexer';
import { ContextBuilder } from './context/context-builder';
import { ReelContextReader } from './context/reel-context';
import { VisualContextReader } from './context/visual-context';
import { Retriever } from './retrieval/retriever';
import { ProfileSuggester } from './profile-suggester';
import { ScanReviewService } from './scan-review.service';
import { ScanService } from './scan.service';
import { WebsiteScanner } from './website-scanner';

@Module({
  imports: [BrandModule, AiModule],
  providers: [
    { provide: CrawlerPort, useFactory: (): CrawlerPort => new HttpFetcher() },
    { provide: WebsiteScanner, useFactory: (crawler: CrawlerPort) => new WebsiteScanner(crawler), inject: [CrawlerPort] },
    ProfileSuggester,
    EmbeddingService,
    EntityIndexer,
    Retriever,
    ContextBuilder,
    VisualContextReader,
    ReelContextReader,
    ScanService,
    ScanReviewService,
    CompetitorService,
    CompetitorDiscoveryService,
  ],
  exports: [
    ScanService,
    ScanReviewService,
    CompetitorService,
    CompetitorDiscoveryService,
    EmbeddingService,
    EntityIndexer,
    Retriever,
    ContextBuilder,
    VisualContextReader,
    ReelContextReader,
  ],
})
export class KnowledgeModule {}
