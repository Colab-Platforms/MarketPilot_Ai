import { LlmError } from './llm.port';
import { OpenRouterMusicAdapter } from './openrouter-music.adapter';
import { SarvamSpeechAdapter } from './sarvam-speech.adapter';
import { wavOf } from './wav.fixture';

interface Captured {
  url: string;
  init: RequestInit;
}

const bodyOf = (call: Captured) => JSON.parse(String(call.init.body)) as Record<string, unknown>;

function mockFetch(make: () => Response): Captured[] {
  const calls: Captured[] = [];
  jest.spyOn(global, 'fetch').mockImplementation((url, init) => {
    calls.push({ url: String(url), init: init ?? {} });
    return Promise.resolve(make());
  });
  return calls;
}

// The shape OpenRouter streams Lyria in: keep-alive comments, then audio split across chunks.
function sse(events: unknown[]): Response {
  const text = [
    ': OPENROUTER PROCESSING',
    '',
    ...events.flatMap((e) => [`data: ${JSON.stringify(e)}`, '']),
    'data: [DONE]',
    '',
  ].join('\n');
  return new Response(text, { status: 200, headers: { 'content-type': 'text/event-stream' } });
}

afterEach(() => jest.restoreAllMocks());

describe('OpenRouterMusicAdapter', () => {
  const adapter = new OpenRouterMusicAdapter({
    apiKey: 'sk',
    baseUrl: 'https://or.example/api/v1',
    strictPrivacy: true,
  });
  const request = { task: 'reel.music', model: 'google/lyria-3-clip-preview', prompt: 'Upbeat', seed: 42 };
  const mp3 = Buffer.from('ID3 fake mp3 bytes for the test');
  const half = Math.floor(mp3.length / 2);

  it('streams audio output with the seed and joins the base64 chunks into one MP3', async () => {
    const calls = mockFetch(() =>
      sse([
        { choices: [{ delta: { role: 'assistant', content: '<instrumental>' } }] },
        { choices: [{ delta: { audio: { data: mp3.subarray(0, half).toString('base64') } } }] },
        { choices: [{ delta: { audio: { data: mp3.subarray(half).toString('base64') } } }] },
        { choices: [{ delta: {} , finish_reason: 'stop' }], usage: { cost: 0.04 } },
      ]),
    );
    const track = await adapter.compose(request);
    expect(calls[0]!.url).toBe('https://or.example/api/v1/chat/completions');
    expect(bodyOf(calls[0]!)).toMatchObject({
      model: 'google/lyria-3-clip-preview',
      modalities: ['text', 'audio'],
      stream: true,
      seed: 42,
    });
    expect(track).toEqual({ bytes: mp3, mediaType: 'audio/mpeg', durationSeconds: null, costUsd: 0.04 });
  });

  it('fails when the stream carries no audio', async () => {
    mockFetch(() => sse([{ choices: [{ delta: { content: 'sorry' } }] }]));
    await expect(adapter.compose(request)).rejects.toMatchObject({ reason: 'invalid_output' });
  });

  it('fails on an error event mid-stream', async () => {
    mockFetch(() => sse([{ error: { message: 'model overloaded' } }]));
    const error = await adapter.compose(request).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(LlmError);
    expect((error as LlmError).reason).toBe('upstream');
  });

  it('maps an out-of-credit gateway to insufficient_credits', async () => {
    mockFetch(() => new Response(JSON.stringify({ error: { message: 'no credit' } }), { status: 402 }));
    await expect(adapter.compose(request)).rejects.toMatchObject({ reason: 'insufficient_credits' });
  });
});

describe('SarvamSpeechAdapter', () => {
  const adapter = new SarvamSpeechAdapter('sarvam-key');
  const request = { task: 'reel.voiceover', text: 'Naya joota, naya josh.', language: 'hi-IN' as const, voice: 'shubh_enhi_ads' };

  it('asks Bulbul v4 Flash for a WAV and times it from the header', async () => {
    const wav = wavOf(1.5);
    const calls = mockFetch(
      () => new Response(JSON.stringify({ request_id: 'r1', audios: [wav.toString('base64')] }), { status: 200 }),
    );
    const line = await adapter.speak(request);
    expect(calls[0]!.url).toBe('https://api.sarvam.ai/text-to-speech');
    expect((calls[0]!.init.headers as Record<string, string>)['api-subscription-key']).toBe('sarvam-key');
    expect(bodyOf(calls[0]!)).toEqual({
      text: request.text,
      language_code: 'hi-IN',
      model: 'bulbul:v4-flash',
      speaker: 'shubh_enhi_ads',
      speech_sample_rate: 24_000,
      output_audio_codec: 'wav',
    });
    expect(line.mediaType).toBe('audio/wav');
    expect(line.durationSeconds).toBeCloseTo(1.5, 3);
    expect(line.costUsd).toBeGreaterThan(0);
  });

  it('rejects an answer that is not a WAV', async () => {
    mockFetch(() => new Response(JSON.stringify({ audios: [Buffer.from('nope').toString('base64')] }), { status: 200 }));
    await expect(adapter.speak(request)).rejects.toMatchObject({ reason: 'invalid_output' });
  });

  it.each([
    [403, 'auth'],
    [402, 'insufficient_credits'],
    [429, 'rate_limited'],
    [400, 'invalid_output'],
    [503, 'upstream'],
  ])('maps HTTP %i to %s without keeping the echoed text', async (status, reason) => {
    mockFetch(
      () =>
        new Response(JSON.stringify({ error: { code: 'invalid_request_error', message: request.text } }), {
          status,
        }),
    );
    const error = (await adapter.speak(request).catch((e: unknown) => e)) as LlmError;
    expect(error.reason).toBe(reason);
    expect(error.message).not.toContain('josh');
  });
});
