import type { LlmFailure } from './llm.port';

export interface VideoRequest {
  // For logs only; never sent to the provider.
  task: string;
  model: string;
  prompt: string;
  // Public HTTPS URL of the image the clip starts from.
  firstFrameUrl: string;
  durationSeconds: number;
  // The provider dedupes a retried submit with this, so a network retry never pays twice.
  idempotencyKey: string;
}

export interface VideoDownload {
  url: string;
  // Set when the URL needs the provider's credentials; such files are fetched by us, not by storage.
  headers: Record<string, string> | null;
}

export type VideoJobState =
  | { state: 'pending' }
  | { state: 'completed'; download: VideoDownload; costUsd: number | null }
  | { state: 'failed'; failure: LlmFailure | 'moderated'; message: string };

// Video models (ADR 0011). Generation is asynchronous: submit returns a provider job id, which
// is polled until it settles. Like the other ports, reached only through modules/ai.
export abstract class VideoPort {
  // The route name in VIDEO_MODELS, e.g. "openrouter".
  abstract readonly route: string;
  abstract readonly available: boolean;
  abstract submit(request: VideoRequest): Promise<{ providerJobId: string }>;
  abstract status(providerJobId: string): Promise<VideoJobState>;
}
