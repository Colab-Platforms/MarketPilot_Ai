import { LlmError } from './llm.port';
import { abortError } from './openrouter-http';
import { SpeechPort, type GeneratedAudio, type SpeechRequest } from './sound.port';
import { wavDurationSeconds } from './wav';

const ENDPOINT = 'https://api.sarvam.ai/text-to-speech';
const MODEL = 'bulbul:v4-flash';
const SAMPLE_RATE = 24_000;
const TIMEOUT_MS = 30_000;
// Bulbul v4 Flash is ₹2 per 1,000 characters on pay as you go (October 2026). Converted at
// about ₹84 to the dollar so speech is recorded in USD like every other AI cost.
const USD_PER_CHARACTER = 2 / 1000 / 84;

interface SarvamResponse {
  audios?: string[];
}

// Sarvam Bulbul text-to-speech (ADR 0013). Returns WAV, so its length is read from the header
// and the line can be timed against its scene.
export class SarvamSpeechAdapter extends SpeechPort {
  readonly available = true;

  constructor(private readonly apiKey: string) {
    super();
  }

  async speak(request: SpeechRequest): Promise<GeneratedAudio> {
    let response: Response;
    try {
      response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'api-subscription-key': this.apiKey, 'content-type': 'application/json' },
        body: JSON.stringify({
          text: request.text,
          language_code: request.language,
          model: MODEL,
          speaker: request.voice,
          speech_sample_rate: SAMPLE_RATE,
          output_audio_codec: 'wav',
        }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (error) {
      throw abortError(error);
    }
    if (!response.ok) throw await toError(response);

    const json = (await response.json().catch(() => null)) as SarvamResponse | null;
    const bytes = Buffer.from((json?.audios ?? []).join(''), 'base64');
    const durationSeconds = wavDurationSeconds(bytes);
    if (durationSeconds === null) throw new LlmError('invalid_output', 'The voiceover was not a readable WAV file');
    return {
      bytes,
      mediaType: 'audio/wav',
      durationSeconds,
      costUsd: request.text.length * USD_PER_CHARACTER,
    };
  }
}

// Error bodies echo the request, so only the status and Sarvam's short error code are kept.
async function toError(response: Response): Promise<LlmError> {
  const body = (await response.json().catch(() => null)) as { error?: { code?: unknown } } | null;
  const code = typeof body?.error?.code === 'string' ? body.error.code.slice(0, 60) : 'unknown';
  switch (response.status) {
    case 401:
    case 403:
      return new LlmError('auth', 'Sarvam rejected the API key');
    case 402:
      return new LlmError('insufficient_credits', 'The Sarvam balance is too low');
    case 429:
      return new LlmError('rate_limited', 'Sarvam is rate limiting requests');
    case 400:
    case 422:
      return new LlmError('invalid_output', `Sarvam refused the voiceover request (${code})`);
    default:
      return new LlmError('upstream', `Sarvam failed with status ${response.status}`);
  }
}
