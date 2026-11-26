import { LlmError } from './llm.port';
import { getFromOpenRouter, postToOpenRouter, type OpenRouterSettings } from './openrouter-http';
import { VideoPort, type VideoJobState, type VideoRequest } from './video.port';

const SUBMIT_TIMEOUT_MS = 60_000;
const STATUS_TIMEOUT_MS = 30_000;

interface VideoJob {
  id?: string;
  status?: string;
  error?: unknown;
  urls?: string[];
  usage?: { cost?: number | null };
}

// OpenRouter's video API (ADR 0011): POST /videos, then GET /videos/{id} until it settles.
// No video endpoint offers zero data retention, so video alone sends data_collection: deny
// without zdr; text and image calls keep strict routing.
export class OpenRouterVideoAdapter extends VideoPort {
  readonly route = 'openrouter';
  readonly available = true;

  constructor(private readonly settings: OpenRouterSettings) {
    super();
  }

  async submit(request: VideoRequest): Promise<{ providerJobId: string }> {
    const json = (await postToOpenRouter(
      this.settings,
      '/videos',
      {
        model: request.model,
        prompt: request.prompt,
        duration: request.durationSeconds,
        resolution: '720p',
        aspect_ratio: '9:16',
        generate_audio: false,
        frame_images: [
          {
            type: 'image_url',
            image_url: { url: request.firstFrameUrl },
            frame_type: 'first_frame',
          },
        ],
        provider: { data_collection: 'deny' },
      },
      SUBMIT_TIMEOUT_MS,
    )) as VideoJob;
    if (!json.id) throw new LlmError('upstream', 'The video gateway returned no job id');
    return { providerJobId: json.id };
  }

  async status(providerJobId: string): Promise<VideoJobState> {
    const job = (await getFromOpenRouter(
      this.settings,
      `/videos/${encodeURIComponent(providerJobId)}`,
      STATUS_TIMEOUT_MS,
    )) as VideoJob;
    switch (job.status) {
      case 'completed': {
        const signed = job.urls?.[0];
        // A signed URL can be fetched by storage directly; the content endpoint needs our key.
        const download = signed
          ? { url: signed, headers: null }
          : {
              url: `${this.settings.baseUrl}/videos/${encodeURIComponent(providerJobId)}/content?index=0`,
              headers: { authorization: `Bearer ${this.settings.apiKey}` },
            };
        return {
          state: 'completed',
          download,
          costUsd: typeof job.usage?.cost === 'number' ? job.usage.cost : null,
        };
      }
      case 'failed':
        return { state: 'failed', failure: 'upstream', message: errorText(job.error) };
      case 'cancelled':
      case 'expired':
        return { state: 'failed', failure: 'upstream', message: `The video job was ${job.status}` };
      default:
        return { state: 'pending' };
    }
  }
}

// Provider errors can echo the prompt, so only a short message is kept.
function errorText(error: unknown): string {
  const raw = typeof error === 'string' ? error : (error as { message?: unknown } | null)?.message;
  return typeof raw === 'string' && raw
    ? raw.slice(0, 160)
    : 'The video model could not make this clip';
}
