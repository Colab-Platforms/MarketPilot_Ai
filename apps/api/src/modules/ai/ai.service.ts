import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ZodType, ZodTypeDef } from 'zod';
import type { Env } from '@/config';
import type { EvidencePage } from './tasks/profile-extract/evidence';
import {
  ImagePort,
  LlmError,
  LlmPort,
  type ChatMessage,
  type ConverseResult,
  type EmbedResult,
  type LlmUsage,
  type ToolSpec,
  type WebSearchEngine,
} from '@/infra/llm-providers';
import {
  discoverCompetitors,
  type CompetitorDiscoveryInput,
  type CompetitorDiscoveryResult,
} from './tasks/competitors-discover/competitors-discover.task';
import {
  ImageGenerationFailed,
  generateImage,
  generateWithFallback,
  type ComposedImageRequest,
  type ImageAttempt,
  type ImageGenerateResult,
} from './tasks/image-generate/image-generate.task';
import {
  composeKeyframePrompt,
  composePortraitPrompt,
  type ReelKeyframeBrief,
  type ReelPortraitBrief,
} from './tasks/reel/reel-image-prompt';
import type { ImageBrief } from './tasks/image-generate/image-prompt';
import { extractProducts, type ProductExtractResult } from './tasks/products-extract/products-extract.task';
import { extractProfileFields, type ProfileExtractInput, type ProfileExtractResult } from './tasks/profile-extract/profile-extract.task';
import { proposeReelIdeas, type ReelIdeasInput, type ReelIdeasResult } from './tasks/reel/reel-ideas.task';
import {
  rewriteReelScene,
  writeReelStoryboard,
  type ReelSceneRewriteInput,
  type ReelStoryboardInput,
} from './tasks/reel/reel-storyboard.task';
import { findReelTrends, type ReelTrendsInput, type ReelTrendsResult } from './tasks/reel/reel-trends.task';
import type { ModelTier } from './tasks/task-definition';
import { CONVERSE_TASKS, REEL_TASKS, STRUCTURED_TASKS, type ConverseTask, type StructuredTask } from './tasks/task-routing';

// ADR 0002: vectors are halfvec(1024).
export const EMBEDDING_DIMENSIONS = 1024;

const CONVERSE_MAX_OUTPUT_TOKENS = 2_000;

export interface ConverseInput {
  messages: ChatMessage[];
  tools: ToolSpec[];
  onText?: (text: string) => void;
  signal?: AbortSignal;
}

export interface StructuredInput<T> {
  system: string;
  user: string;
  schemaName: string;
  // Strict JSON schema sent to the model; `schema` re-validates what comes back.
  jsonSchema: Record<string, unknown>;
  schema: ZodType<T, ZodTypeDef, unknown>;
  maxOutputTokens: number;
  timeoutMs?: number;
}

// The single door to models. Callers ask for a task; which model serves it is
// configuration (ADR 0004), never a caller's choice.
@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly extractModel: string;
  readonly embeddingModel: string;
  private readonly tierModels: Record<ModelTier, string | undefined>;
  private readonly search: { search: string; engine: WebSearchEngine };
  private readonly imageModels: readonly string[];

  constructor(
    private readonly llm: LlmPort,
    private readonly images: ImagePort,
    config: ConfigService<Env, true>,
  ) {
    this.imageModels = config.get('OPENROUTER_MODEL_IMAGE', { infer: true });
    this.extractModel = config.get('OPENROUTER_MODEL_EXTRACT', { infer: true });
    this.embeddingModel = config.get('OPENROUTER_MODEL_EMBED', { infer: true });
    const reasoning = config.get('OPENROUTER_MODEL_REASONING', { infer: true });
    const fast = config.get('OPENROUTER_MODEL_FAST', { infer: true });
    this.search = {
      search: config.get('OPENROUTER_MODEL_SEARCH', { infer: true }),
      engine: config.get('OPENROUTER_SEARCH_ENGINE', { infer: true }),
    };
    this.tierModels = {
      reasoning,
      writing: fast,
      classification: fast,
      vision: undefined,
      image: undefined,
      speech: undefined,
    };
  }

  get available(): boolean {
    return this.llm.available;
  }

  suggestProfile(input: ProfileExtractInput): Promise<ProfileExtractResult> {
    return extractProfileFields(this.llm, this.extractModel, input);
  }

  suggestProducts(input: { pages: EvidencePage[]; brandName: string }): Promise<ProductExtractResult | null> {
    return extractProducts(this.llm, this.extractModel, input);
  }

  // Web-search-backed (ADR 0007); the caller enforces that it runs once per workspace.
  async discoverCompetitors(input: CompetitorDiscoveryInput): Promise<CompetitorDiscoveryResult> {
    const started = Date.now();
    const result = await discoverCompetitors(
      this.llm,
      { plan: this.modelFor('classification'), rank: this.modelFor('reasoning'), ...this.search },
      input,
    );
    this.logCall('competitors.discover', result.usage, Date.now() - started, null);
    return result;
  }

  get imagesAvailable(): boolean {
    return this.images.available;
  }

  // One image for a brief, from the first configured model that succeeds.
  generateImage(brief: ImageBrief): Promise<ImageGenerateResult> {
    return this.logged('image.generate', () => generateImage(this.images, this.imageModels, brief));
  }

  private drawWithFallback(request: ComposedImageRequest): Promise<ImageGenerateResult> {
    return this.logged(request.task, () => generateWithFallback(this.images, this.imageModels, request));
  }

  private async logged(task: string, run: () => Promise<ImageGenerateResult>): Promise<ImageGenerateResult> {
    try {
      const result = await run();
      for (const attempt of result.attempts) this.logAttempt(task, attempt);
      return result;
    } catch (error) {
      if (error instanceof ImageGenerationFailed) for (const attempt of error.attempts) this.logAttempt(task, attempt);
      throw error;
    }
  }

  // Public reel trends for a category and market, from one web search (ADR 0007).
  findReelTrends(input: ReelTrendsInput): Promise<ReelTrendsResult> {
    return this.timed('reel.trends', () => findReelTrends(this.llm, { model: this.search.search, engine: this.search.engine }, input));
  }

  proposeReelIdeas(input: ReelIdeasInput): Promise<ReelIdeasResult> {
    return this.timed('reel.ideas', () => proposeReelIdeas(this.llm, this.modelFor(REEL_TASKS['reel.ideas']), input));
  }

  writeReelStoryboard(input: ReelStoryboardInput): ReturnType<typeof writeReelStoryboard> {
    return this.timed('reel.storyboard', () =>
      writeReelStoryboard(this.llm, this.modelFor(REEL_TASKS['reel.storyboard']), input),
    );
  }

  rewriteReelScene(input: ReelSceneRewriteInput): ReturnType<typeof rewriteReelScene> {
    return this.timed('reel.scene.rewrite', () =>
      rewriteReelScene(this.llm, this.modelFor(REEL_TASKS['reel.scene.rewrite']), input),
    );
  }

  generateReelPortrait(brief: ReelPortraitBrief): Promise<ImageGenerateResult> {
    return this.drawWithFallback(composePortraitPrompt(brief));
  }

  generateReelKeyframe(brief: ReelKeyframeBrief): Promise<ImageGenerateResult> {
    return this.drawWithFallback(composeKeyframePrompt(brief));
  }

  embed(texts: string[]): Promise<EmbedResult> {
    return this.llm.embed({
      task: 'embed.text',
      model: this.embeddingModel,
      inputs: texts,
      dimensions: EMBEDDING_DIMENSIONS,
    });
  }

  // One streamed, tool-calling turn of a conversation.
  async converse(task: ConverseTask, input: ConverseInput): Promise<ConverseResult> {
    const started = Date.now();
    let firstTextMs: number | null = null;
    const result = await this.llm.converse({
      task,
      model: this.modelFor(CONVERSE_TASKS[task]),
      messages: input.messages,
      tools: input.tools,
      maxOutputTokens: CONVERSE_MAX_OUTPUT_TOKENS,
      onText: (text) => {
        firstTextMs ??= Date.now() - started;
        input.onText?.(text);
      },
      signal: input.signal,
    });
    this.logCall(task, result.usage, Date.now() - started, firstTextMs);
    return result;
  }

  // A small structured answer, validated before it is returned.
  async structured<T>(task: StructuredTask, input: StructuredInput<T>): Promise<{ data: T; usage: LlmUsage }> {
    const started = Date.now();
    const response = await this.llm.generateStructured({
      task,
      model: this.modelFor(STRUCTURED_TASKS[task]),
      system: input.system,
      user: input.user,
      schemaName: input.schemaName,
      jsonSchema: input.jsonSchema,
      maxOutputTokens: input.maxOutputTokens,
      timeoutMs: input.timeoutMs,
    });
    this.logCall(task, response.usage, Date.now() - started, null);
    const parsed = input.schema.safeParse(response.data);
    if (!parsed.success) throw new LlmError('invalid_output', `The ${task} answer did not match its schema`);
    return { data: parsed.data, usage: response.usage };
  }

  private async timed<T extends { usage: LlmUsage }>(task: string, run: () => Promise<T>): Promise<T> {
    const started = Date.now();
    const result = await run();
    this.logCall(task, result.usage, Date.now() - started, null);
    return result;
  }

  // One line per model call: never prompt or answer text, only what it cost and how long it took.
  private logCall(task: string, usage: LlmUsage, latencyMs: number, firstTextMs: number | null): void {
    const cost = usage.costUsd === null ? 'n/a' : `$${usage.costUsd.toFixed(5)}`;
    const firstText = firstTextMs === null ? '' : ` first_text=${firstTextMs}ms`;
    this.logger.log(
      `${task} model=${usage.model} latency=${latencyMs}ms${firstText} tokens=${usage.promptTokens}+${usage.completionTokens} cost=${cost}`,
    );
  }

  private logAttempt(task: string, attempt: ImageAttempt): void {
    if (attempt.usage) {
      this.logCall(task, attempt.usage, attempt.latencyMs, null);
      return;
    }
    this.logger.warn(`${task} model=${attempt.model} latency=${attempt.latencyMs}ms failed=${attempt.failure}`);
  }

  private modelFor(tier: ModelTier): string {
    const model = this.tierModels[tier];
    if (!model) throw new LlmError('unavailable', `No model is configured for the ${tier} tier`);
    return model;
  }
}
