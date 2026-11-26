import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '@/config';
import { LlmError, VideoRoutes, type LlmFailure, type VideoJobState } from '@/infra/llm-providers';
import {
  REEL_CLIP_PROMPT_VERSION,
  clipSeconds,
  composeClipPrompt,
  type ReelClipBrief,
} from './tasks/reel/reel-clip-prompt';

// Failures another route or model may not share. Auth and account balance belong to one
// route, so they also move on: the next route has its own account.
const TRY_NEXT: ReadonlySet<LlmFailure | 'moderated'> = new Set([
  'no_provider',
  'upstream',
  'rate_limited',
  'timeout',
  'invalid_output',
  'moderated',
  'auth',
  'insufficient_credits',
  'unavailable',
]);

export interface SubmittedClip {
  // Where in VIDEO_MODELS the clip went; a later failure resumes from the entry after it.
  attempt: number;
  route: string;
  model: string;
  providerJobId: string;
  prompt: string;
  promptVersion: string;
  seconds: number;
}

// The door to video models (ADR 0011): callers hand over a clip brief, never a model.
@Injectable()
export class VideoService {
  private readonly logger = new Logger(VideoService.name);
  private readonly chain: readonly { route: string; model: string }[];

  constructor(
    private readonly routes: VideoRoutes,
    config: ConfigService<Env, true>,
  ) {
    this.chain = config.get('VIDEO_MODELS', { infer: true });
  }

  get available(): boolean {
    return this.chain.some((entry) => this.routes.get(entry.route));
  }

  // Whether a failure on chain entry `attempt` can be retried on a later entry.
  canMoveOn(attempt: number, failure: LlmFailure | 'moderated'): boolean {
    return (
      TRY_NEXT.has(failure) && this.chain.slice(attempt + 1).some((e) => this.routes.get(e.route))
    );
  }

  // Submits to the first entry from `startAt` that accepts the clip. The key is suffixed with
  // the entry, so a retried submit is deduped by the provider but a fallback is a new request.
  async submitClip(
    brief: ReelClipBrief,
    startAt: number,
    idempotencyKey: string,
  ): Promise<SubmittedClip> {
    const prompt = composeClipPrompt(brief);
    const seconds = clipSeconds(brief);
    let lastError = new LlmError('unavailable', 'No video model is configured');
    for (let attempt = startAt; attempt < this.chain.length; attempt += 1) {
      const entry = this.chain[attempt]!;
      const port = this.routes.get(entry.route);
      if (!port) continue;
      const started = Date.now();
      try {
        const { providerJobId } = await port.submit({
          task: 'reel.clip',
          model: entry.model,
          prompt,
          firstFrameUrl: brief.keyframeUrl,
          durationSeconds: seconds,
          idempotencyKey: `${idempotencyKey}-${attempt}`,
        });
        this.logger.log(
          `reel.clip submitted route=${entry.route} model=${entry.model} seconds=${seconds} latency=${Date.now() - started}ms`,
        );
        return {
          attempt,
          ...entry,
          providerJobId,
          prompt,
          promptVersion: REEL_CLIP_PROMPT_VERSION,
          seconds,
        };
      } catch (error) {
        if (!(error instanceof LlmError)) throw error;
        this.logger.warn(
          `reel.clip submit failed route=${entry.route} model=${entry.model} failure=${error.reason}`,
        );
        lastError = error;
        if (!TRY_NEXT.has(error.reason)) break;
      }
    }
    throw lastError;
  }

  async checkClip(route: string, providerJobId: string): Promise<VideoJobState> {
    const port = this.routes.get(route);
    if (!port)
      return {
        state: 'failed',
        failure: 'unavailable',
        message: 'This video route is no longer set up',
      };
    return port.status(providerJobId);
  }
}
