import { LlmError, type GeneratedImageBytes, type ImageAspectRatio, type ImagePort, type LlmFailure, type LlmUsage } from '@/infra/llm-providers';
import { IMAGE_PROMPT_VERSION, composeImagePrompt, type ImageBrief } from './image-prompt';

// Failures that another model may not share. Auth, account credit and cancellation would
// fail the same way on every model, so they stop the chain.
const TRY_NEXT_MODEL: ReadonlySet<LlmFailure> = new Set([
  'no_provider',
  'upstream',
  'rate_limited',
  'timeout',
  'invalid_output',
]);

export interface ImageAttempt {
  model: string;
  failure: LlmFailure | null;
  usage: LlmUsage | null;
  latencyMs: number;
}

export interface ImageGenerateResult {
  image: GeneratedImageBytes;
  usage: LlmUsage;
  prompt: string;
  promptVersion: string;
  attempts: ImageAttempt[];
}

export class ImageGenerationFailed extends LlmError {
  constructor(
    reason: LlmFailure,
    message: string,
    readonly attempts: ImageAttempt[],
  ) {
    super(reason, message);
    this.name = 'ImageGenerationFailed';
  }
}

export interface ComposedImageRequest {
  task: string;
  prompt: string;
  references: string[];
  aspectRatio: ImageAspectRatio;
  promptVersion: string;
}

export function generateImage(port: ImagePort, models: readonly string[], brief: ImageBrief): Promise<ImageGenerateResult> {
  const { prompt, references } = composeImagePrompt(brief);
  return generateWithFallback(port, models, {
    task: 'image.generate',
    prompt,
    references,
    aspectRatio: brief.aspectRatio,
    promptVersion: IMAGE_PROMPT_VERSION,
  });
}

// Tries each configured model in order until one returns an image (ADR 0008).
export async function generateWithFallback(
  port: ImagePort,
  models: readonly string[],
  request: ComposedImageRequest,
): Promise<ImageGenerateResult> {
  const { prompt, references } = request;
  const attempts: ImageAttempt[] = [];
  let lastError: LlmError = new LlmError('unavailable', 'No image model is configured');

  for (const model of models) {
    const started = Date.now();
    try {
      const result = await port.generate({
        task: request.task,
        model,
        prompt,
        references,
        aspectRatio: request.aspectRatio,
      });
      const [image] = result.images;
      if (!image) throw new LlmError('invalid_output', 'The image model returned no image');
      attempts.push({ model, failure: null, usage: result.usage, latencyMs: Date.now() - started });
      return { image, usage: result.usage, prompt, promptVersion: request.promptVersion, attempts };
    } catch (error) {
      if (!(error instanceof LlmError)) throw error;
      attempts.push({ model, failure: error.reason, usage: null, latencyMs: Date.now() - started });
      lastError = error;
      if (!TRY_NEXT_MODEL.has(error.reason)) break;
    }
  }
  throw new ImageGenerationFailed(lastError.reason, lastError.message, attempts);
}
