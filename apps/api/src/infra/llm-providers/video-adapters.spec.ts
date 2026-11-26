import { HiggsfieldVideoAdapter } from './higgsfield-video.adapter';
import { LlmError } from './llm.port';
import { OpenRouterVideoAdapter } from './openrouter-video.adapter';
import type { VideoRequest } from './video.port';

const request: VideoRequest = {
  task: 'reel.clip',
  model: 'kwaivgi/kling-v3.0-std',
  prompt: 'She lifts the bottle.',
  firstFrameUrl: 'https://img.example/k1.png',
  durationSeconds: 3,
  idempotencyKey: 'take-1-0',
};

interface Captured {
  url: string;
  init: RequestInit;
}

function mockFetch(...responses: { status?: number; body: unknown }[]): Captured[] {
  const calls: Captured[] = [];
  jest.spyOn(global, 'fetch').mockImplementation((url, init) => {
    calls.push({ url: String(url), init: init ?? {} });
    const next = responses.shift() ?? { body: {} };
    return Promise.resolve(new Response(JSON.stringify(next.body), { status: next.status ?? 200 }));
  });
  return calls;
}

const bodyOf = (call: Captured) => JSON.parse(String(call.init.body)) as Record<string, unknown>;

afterEach(() => jest.restoreAllMocks());

describe('OpenRouterVideoAdapter', () => {
  const adapter = new OpenRouterVideoAdapter({
    apiKey: 'sk',
    baseUrl: 'https://or.example/api/v1',
    strictPrivacy: true,
  });

  it('submits a vertical 720p clip from the first frame without audio or zero-retention routing', async () => {
    const calls = mockFetch({ status: 202, body: { id: 'job-1', status: 'pending' } });
    await expect(adapter.submit(request)).resolves.toEqual({ providerJobId: 'job-1' });
    const body = bodyOf(calls[0]!);
    expect(calls[0]!.url).toBe('https://or.example/api/v1/videos');
    expect(body).toMatchObject({
      resolution: '720p',
      aspect_ratio: '9:16',
      generate_audio: false,
      duration: 3,
    });
    expect(body.frame_images).toEqual([
      { type: 'image_url', image_url: { url: request.firstFrameUrl }, frame_type: 'first_frame' },
    ]);
    expect(body.provider).toEqual({ data_collection: 'deny' });
  });

  it('hands storage the signed URL and reports the cost when the clip is done', async () => {
    mockFetch({
      body: {
        status: 'completed',
        urls: ['https://cdn.example/v.mp4?sig=1'],
        usage: { cost: 0.252 },
      },
    });
    await expect(adapter.status('job-1')).resolves.toEqual({
      state: 'completed',
      download: { url: 'https://cdn.example/v.mp4?sig=1', headers: null },
      costUsd: 0.252,
    });
  });

  it('falls back to the authenticated content endpoint when there is no signed URL', async () => {
    mockFetch({ body: { status: 'completed', urls: [] } });
    const state = await adapter.status('job-1');
    expect(state).toMatchObject({
      download: {
        url: 'https://or.example/api/v1/videos/job-1/content?index=0',
        headers: { authorization: 'Bearer sk' },
      },
    });
  });

  it('reads pending, failed and expired jobs', async () => {
    mockFetch(
      { body: { status: 'in_progress' } },
      { body: { status: 'failed', error: { message: 'bad frame' } } },
      { body: { status: 'expired' } },
    );
    await expect(adapter.status('a')).resolves.toEqual({ state: 'pending' });
    await expect(adapter.status('b')).resolves.toEqual({
      state: 'failed',
      failure: 'upstream',
      message: 'bad frame',
    });
    await expect(adapter.status('c')).resolves.toMatchObject({ state: 'failed' });
  });
});

describe('HiggsfieldVideoAdapter', () => {
  const adapter = new HiggsfieldVideoAdapter('id:secret');

  it('sends the key pair, the idempotency key and Kling field names', async () => {
    const calls = mockFetch({ body: { request_id: 'r1', status: 'queued' } });
    await adapter.submit({ ...request, model: 'kling-video/v3.0/std/image-to-video' });
    const headers = calls[0]!.init.headers as Record<string, string>;
    expect(calls[0]!.url).toBe('https://api.higgsfield.ai/kling-video/v3.0/std/image-to-video');
    expect(headers.authorization).toBe('Key id:secret');
    expect(headers['idempotency-key']).toBe('take-1-0');
    expect(bodyOf(calls[0]!)).toEqual({
      image_url: request.firstFrameUrl,
      prompt: request.prompt,
      duration: 3,
      sound: 'off',
    });
  });

  it('uses Seedance field names and its four-second minimum', async () => {
    const calls = mockFetch({ body: { request_id: 'r2' } });
    await adapter.submit({ ...request, model: 'bytedance/seedance-2.5/image-to-video' });
    expect(bodyOf(calls[0]!)).toMatchObject({
      duration: 4,
      generate_audio: false,
      resolution: '720p',
    });
  });

  it('maps moderation and a low balance to failures the chain can act on', async () => {
    mockFetch(
      { body: { status: 'nsfw' } },
      { body: { status: 'failed', error: 'Your credit balance is too low' } },
    );
    await expect(adapter.status('r1')).resolves.toMatchObject({
      state: 'failed',
      failure: 'moderated',
    });
    await expect(adapter.status('r2')).resolves.toMatchObject({
      state: 'failed',
      failure: 'insufficient_credits',
    });
  });

  it('turns a rejected key into an auth error', async () => {
    mockFetch({ status: 401, body: { detail: 'Invalid credentials' } });
    await expect(adapter.submit(request)).rejects.toEqual(
      new LlmError('auth', 'Higgsfield rejected the API key'),
    );
  });
});
