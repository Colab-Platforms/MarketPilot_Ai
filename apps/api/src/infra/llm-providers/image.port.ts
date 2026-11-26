import type { LlmUsage } from './llm.port';

export type ImageAspectRatio = '1:1' | '4:5' | '9:16';

export interface ImageRequest {
  // For logs only; never sent to the provider.
  task: string;
  model: string;
  prompt: string;
  // Public HTTPS URLs of images the model should follow (product photos, logo, past posts).
  references: string[];
  aspectRatio: ImageAspectRatio;
  timeoutMs?: number;
}

export interface GeneratedImageBytes {
  bytes: Buffer;
  mediaType: string;
}

export interface ImageResult {
  images: GeneratedImageBytes[];
  usage: LlmUsage;
}

// Image models (ARCHITECTURE.md section 5). Like LlmPort, reached only through modules/ai,
// and failures are LlmError so callers handle one error type.
export abstract class ImagePort {
  abstract readonly available: boolean;
  abstract generate(request: ImageRequest): Promise<ImageResult>;
}
