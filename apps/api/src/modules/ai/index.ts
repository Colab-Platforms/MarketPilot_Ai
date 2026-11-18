export * from './ai.module';
export { AiService, EMBEDDING_DIMENSIONS } from './ai.service';
export type { ConverseInput, StructuredInput } from './ai.service';
export type { ProfileExtractInput, ProfileExtractResult } from './tasks/profile-extract/profile-extract.task';
export type { AiSuggestion } from './tasks/profile-extract/verify';
export type { EvidencePage } from './tasks/profile-extract/evidence';
export type { AiProduct } from './tasks/products-extract/verify-products';
export type {
  CompetitorDiscoveryInput,
  CompetitorDiscoveryResult,
} from './tasks/competitors-discover/competitors-discover.task';
export type { AiCompetitor } from './tasks/competitors-discover/verify-competitors';
export { domainOf } from './tasks/competitors-discover/verify-competitors';
export { marketOf, type Market, type MarketSignals } from './tasks/competitors-discover/market';
export * from './tasks/task-definition';
export type { ConverseTask, StructuredTask } from './tasks/task-routing';
export {
  LlmError,
  type ChatMessage,
  type ConverseResult,
  type LlmFailure,
  type LlmUsage,
  type ToolCallRequest,
  type ToolSpec,
} from '@/infra/llm-providers';
