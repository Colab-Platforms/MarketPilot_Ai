import { LlmError } from './llm.port';
import { abortError, sendToOpenRouter, type OpenRouterSettings } from './openrouter-http';
import { readSseChunks } from './openrouter-stream';
import { MusicPort, type GeneratedAudio, type MusicRequest } from './sound.port';

const TIMEOUT_MS = 120_000;
const MAX_AUDIO_BYTES = 20 * 1024 * 1024;

interface AudioDelta {
  choices?: { delta?: { audio?: { data?: string } } }[];
  usage?: { cost?: number };
  error?: { message?: string };
}

// Lyria through OpenRouter (ADR 0013). Audio output is only offered as a stream: the MP3 arrives
// base64-encoded in `delta.audio.data`, split across chunks, with the cost on the last one.
export class OpenRouterMusicAdapter extends MusicPort {
  readonly available = true;

  constructor(private readonly settings: OpenRouterSettings) {
    super();
  }

  async compose(request: MusicRequest): Promise<GeneratedAudio> {
    const signal = AbortSignal.timeout(TIMEOUT_MS);
    const response = await sendToOpenRouter(
      this.settings,
      '/chat/completions',
      {
        model: request.model,
        messages: [{ role: 'user', content: request.prompt }],
        modalities: ['text', 'audio'],
        stream: true,
        seed: request.seed,
        usage: { include: true },
      },
      signal,
    );
    if (!response.body) throw new LlmError('upstream', 'The music model returned no stream');

    const parts: string[] = [];
    let costUsd: number | null = null;
    try {
      for await (const chunk of readSseChunks(response.body)) {
        const event = chunk as AudioDelta;
        if (event.error) {
          throw new LlmError('upstream', `The music model failed: ${(event.error.message ?? '').slice(0, 160)}`);
        }
        const data = event.choices?.[0]?.delta?.audio?.data;
        if (data) parts.push(data);
        if (typeof event.usage?.cost === 'number') costUsd = event.usage.cost;
      }
    } catch (error) {
      if (error instanceof LlmError) throw error;
      throw abortError(error);
    }

    const bytes = Buffer.from(parts.join(''), 'base64');
    if (bytes.length === 0) throw new LlmError('invalid_output', 'The music model returned no audio');
    if (bytes.length > MAX_AUDIO_BYTES) throw new LlmError('invalid_output', 'The music track is too large');
    return { bytes, mediaType: 'audio/mpeg', durationSeconds: null, costUsd };
  }
}
