import { LlmError, type LlmFailure } from './llm.port';
import { VideoPort, type VideoJobState, type VideoRequest } from './video.port';

const BASE_URL = 'https://api.higgsfield.ai';
const TIMEOUT_MS = 60_000;

interface HiggsfieldStatus {
  status?: string;
  error?: unknown;
  video?: { url?: string };
}

// Higgsfield's API (ADR 0011), the fallback route. Each model has its own body shape; the
// model id is the endpoint path, e.g. "kling-video/v3.0/std/image-to-video".
export class HiggsfieldVideoAdapter extends VideoPort {
  readonly route = 'higgsfield';
  readonly available = true;

  // `credentials` is "keyId:secret", as the Higgsfield console copies it.
  constructor(private readonly credentials: string) {
    super();
  }

  async submit(request: VideoRequest): Promise<{ providerJobId: string }> {
    const response = await this.send(`/${request.model}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'idempotency-key': request.idempotencyKey },
      body: JSON.stringify(bodyFor(request)),
    });
    const json = (await response.json().catch(() => null)) as { request_id?: string } | null;
    if (!json?.request_id) throw new LlmError('upstream', 'Higgsfield returned no request id');
    return { providerJobId: json.request_id };
  }

  async status(providerJobId: string): Promise<VideoJobState> {
    const response = await this.send(`/requests/${encodeURIComponent(providerJobId)}/status`, {
      method: 'GET',
    });
    const job = (await response.json().catch(() => null)) as HiggsfieldStatus | null;
    switch (job?.status) {
      case 'completed':
        if (!job.video?.url)
          return {
            state: 'failed',
            failure: 'invalid_output',
            message: 'Higgsfield returned no video',
          };
        // Higgsfield bills in its console; per-request cost is not in the response.
        return {
          state: 'completed',
          download: { url: job.video.url, headers: null },
          costUsd: null,
        };
      case 'nsfw':
        return {
          state: 'failed',
          failure: 'moderated',
          message: 'The video model refused this picture',
        };
      case 'failed':
      case 'canceled':
        return { state: 'failed', ...failureOf(job.error) };
      default:
        return { state: 'pending' };
    }
  }

  private async send(path: string, init: RequestInit): Promise<Response> {
    let response: Response;
    try {
      response = await fetch(`${BASE_URL}${path}`, {
        ...init,
        headers: {
          ...(init.headers as Record<string, string>),
          authorization: `Key ${this.credentials}`,
        },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (error) {
      const name = (error as { name?: string } | null)?.name;
      throw new LlmError(
        name === 'TimeoutError' ? 'timeout' : 'upstream',
        'Could not reach Higgsfield',
      );
    }
    if (response.ok) return response;
    if (response.status === 401 || response.status === 403)
      throw new LlmError('auth', 'Higgsfield rejected the API key');
    if (response.status === 402)
      throw new LlmError('insufficient_credits', 'The Higgsfield balance is too low');
    if (response.status === 429) throw new LlmError('rate_limited', 'Higgsfield is busy');
    if (response.status === 404 || response.status === 423)
      throw new LlmError('no_provider', 'This Higgsfield model is not available');
    throw new LlmError('upstream', `Higgsfield answered ${response.status}`);
  }
}

// Kling and Seedance name their frame and audio fields differently.
function bodyFor(request: VideoRequest): Record<string, unknown> {
  if (request.model.startsWith('bytedance/')) {
    return {
      image_url: request.firstFrameUrl,
      prompt: request.prompt,
      duration: Math.max(request.durationSeconds, 4),
      resolution: '720p',
      generate_audio: false,
    };
  }
  return {
    image_url: request.firstFrameUrl,
    prompt: request.prompt,
    duration: request.durationSeconds,
    sound: 'off',
  };
}

// A low balance comes back as a failed job with a message, not as an HTTP status.
function failureOf(error: unknown): { failure: LlmFailure; message: string } {
  const raw = typeof error === 'string' ? error : (error as { message?: unknown } | null)?.message;
  const message =
    typeof raw === 'string' && raw ? raw.slice(0, 160) : 'The video model could not make this clip';
  if (/balance|credit/i.test(message))
    return { failure: 'insufficient_credits', message: 'The Higgsfield balance is too low' };
  return { failure: 'upstream', message };
}
