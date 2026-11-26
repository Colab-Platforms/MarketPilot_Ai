export * from './ai.module';
export { AiService, EMBEDDING_DIMENSIONS } from './ai.service';
export { VideoService, type SubmittedClip } from './video.service';
export { SoundService, type ReelMusicBrief } from './sound.service';
export { REEL_MUSIC_PROMPT_VERSION, REEL_VOICE_VERSION } from './tasks/reel/reel-sound-prompt';
export type { GeneratedAudio } from '@/infra/llm-providers';
export {
  MIN_CLIP_SECONDS,
  REEL_CLIP_PROMPT_VERSION,
  clipSeconds,
  type ReelClipBrief,
} from './tasks/reel/reel-clip-prompt';
export type { VideoDownload, VideoJobState } from '@/infra/llm-providers';
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
export type { ImageBrief } from './tasks/image-generate/image-prompt';
export { ImageGenerationFailed, type ImageGenerateResult } from './tasks/image-generate/image-generate.task';
export type { ImageAspectRatio } from '@/infra/llm-providers';
export type { ReelIdeasInput, ReelIdeasResult } from './tasks/reel/reel-ideas.task';
export type { ReelSceneRewriteInput, ReelStoryboardInput } from './tasks/reel/reel-storyboard.task';
export type { FoundTrend, ReelTrendsInput, ReelTrendsResult } from './tasks/reel/reel-trends.task';
export type { ReelBrand, ReelBriefFacts, ReelProduct, ReelTrend } from './tasks/reel/reel-prompt';
export type { ReelIdeaDraft, ReelStoryboardDraft } from './tasks/reel/storyboard-normalize';
export {
  REEL_KEYFRAME_PROMPT_VERSION,
  REEL_PORTRAIT_PROMPT_VERSION,
  type ReelKeyframeBrief,
  type ReelPortraitBrief,
} from './tasks/reel/reel-image-prompt';
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
