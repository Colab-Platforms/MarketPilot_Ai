import { createServer, type IncomingMessage, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { LlmError } from './llm.port';
import { OpenRouterAdapter } from './openrouter.adapter';
import { UnavailableLlmAdapter } from './unavailable-llm.adapter';

interface Captured {
  path: string;
  auth: string | undefined;
  body: Record<string, unknown> & { provider?: unknown; messages?: unknown; model?: string };
}

let server: Server;
let base: string;
let captured: Captured | null = null;
let respond: (path: string) => { status: number; body: unknown } = () => ({ status: 200, body: {} });

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString('utf8');
}

beforeAll(async () => {
  server = createServer(async (req, res) => {
    captured = { path: req.url ?? '', auth: req.headers.authorization, body: JSON.parse((await readBody(req)) || '{}') };
    if (captured.body.model === 'slow') return; // never answers
    const { status, body } = respond(req.url ?? '');
    res.statusCode = status;
    res.setHeader('content-type', 'application/json');
    res.end(typeof body === 'string' ? body : JSON.stringify(body));
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(() => {
  server.closeAllConnections();
  server.close();
});

const adapter = (strictPrivacy = true) => new OpenRouterAdapter({ apiKey: 'sk-test', baseUrl: base, strictPrivacy });
const request = {
  task: 'test',
  model: 'anthropic/claude-haiku-5.5',
  system: 'be exact',
  user: 'hello',
  schemaName: 'answer',
  jsonSchema: { type: 'object', properties: { a: { type: 'string' } }, required: ['a'], additionalProperties: false },
  maxOutputTokens: 500,
};
const completion = (content: string, extra: Record<string, unknown> = {}) => ({
  status: 200,
  body: {
    model: 'anthropic/claude-haiku-5.5',
    choices: [{ message: { content }, finish_reason: 'stop' }],
    usage: { prompt_tokens: 120, completion_tokens: 30, cost: 0.0004 },
    ...extra,
  },
});

describe('OpenRouterAdapter.generateStructured', () => {
  it('sends a strict schema, requires matching providers, and enforces zero data retention', async () => {
    respond = () => completion('{"a":"x"}');
    const result = await adapter().generateStructured(request);

    expect(captured!.path).toBe('/chat/completions');
    expect(captured!.auth).toBe('Bearer sk-test');
    expect(captured!.body).toMatchObject({
      model: 'anthropic/claude-haiku-5.5',
      max_tokens: 500,
      response_format: { type: 'json_schema', json_schema: { name: 'answer', strict: true } },
      provider: { require_parameters: true, zdr: true, data_collection: 'deny' },
      usage: { include: true },
    });
    // Sending an unsupported parameter under require_parameters empties the provider pool.
    expect(captured!.body).not.toHaveProperty('temperature');
    expect(captured!.body.messages).toEqual([
      { role: 'system', content: 'be exact' },
      { role: 'user', content: 'hello' },
    ]);
    expect(result.data).toEqual({ a: 'x' });
    expect(result.usage).toEqual({ model: 'anthropic/claude-haiku-5.5', promptTokens: 120, completionTokens: 30, costUsd: 0.0004 });
  });

  it('adds Exa web search only when asked, keeps strict privacy, and returns the cited URLs', async () => {
    respond = () => completion('{"a":"x"}');
    await adapter().generateStructured(request);
    expect(captured!.body).not.toHaveProperty('plugins');

    respond = () => ({
      status: 200,
      body: {
        model: 'm',
        choices: [
          {
            finish_reason: 'stop',
            message: {
              content: '{"a":"x"}',
              annotations: [
                { type: 'url_citation', url_citation: { url: 'https://muditam.com/' } },
                { type: 'url_citation', url_citation: { url: 'https://muditam.com/' } },
                { type: 'file', file: {} },
              ],
            },
          },
        ],
      },
    });
    const result = await adapter().generateStructured({ ...request, webSearch: { maxResults: 8 } });
    expect(captured!.body).toMatchObject({
      plugins: [{ id: 'web', engine: 'exa', max_results: 8 }],
      provider: { require_parameters: true, zdr: true, data_collection: 'deny' },
    });
    expect(result.sources).toEqual(['https://muditam.com/']);
  });

  it('drops the retention restrictions only when privacy is explicitly standard', async () => {
    respond = () => completion('{"a":"x"}');
    await adapter(false).generateStructured(request);
    expect(captured!.body.provider).toEqual({ require_parameters: true });
  });

  it('accepts JSON wrapped in a code fence, and rejects text that is not JSON', async () => {
    respond = () => completion('```json\n{"a":"x"}\n```');
    expect((await adapter().generateStructured(request)).data).toEqual({ a: 'x' });
    respond = () => completion('Sure! Here you go');
    await expect(adapter().generateStructured(request)).rejects.toMatchObject({ reason: 'invalid_output' });
  });

  it('treats a truncated answer and an empty answer as invalid output', async () => {
    respond = () => ({ status: 200, body: { choices: [{ message: { content: '{"a":' }, finish_reason: 'length' }] } });
    await expect(adapter().generateStructured(request)).rejects.toMatchObject({ reason: 'invalid_output' });
    respond = () => ({ status: 200, body: { choices: [{ message: { content: null }, finish_reason: 'stop' }] } });
    await expect(adapter().generateStructured(request)).rejects.toMatchObject({ reason: 'invalid_output' });
  });

  it.each([
    [401, 'auth'],
    [402, 'insufficient_credits'],
    [404, 'no_provider'],
    [429, 'rate_limited'],
    [502, 'upstream'],
  ])('maps HTTP %i to %s without leaking the response body', async (status, reason) => {
    respond = () => ({ status, body: { error: { message: 'secret prompt text echoed here', code: status } } });
    const error = await adapter().generateStructured(request).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(LlmError);
    expect((error as LlmError).reason).toBe(reason);
    if (reason !== 'no_provider') expect((error as LlmError).message).not.toContain('secret prompt text');
  });

  it('times out on a gateway that never answers', async () => {
    await expect(adapter().generateStructured({ ...request, model: 'slow', timeoutMs: 300 })).rejects.toMatchObject({
      reason: 'timeout',
    });
  });
});

describe('OpenRouterAdapter.embed', () => {
  const vector = (n: number, fill: number) => Array.from({ length: n }, () => fill);

  it('asks for the configured dimensions with privacy enforced and returns vectors in input order', async () => {
    respond = () => ({
      status: 200,
      body: {
        model: 'openai/text-embedding-3-large',
        data: [
          { index: 1, embedding: vector(4, 2) },
          { index: 0, embedding: vector(4, 1) },
        ],
        usage: { prompt_tokens: 20, cost: 0.000003 },
      },
    });
    const result = await adapter().embed({ task: 'e', model: 'openai/text-embedding-3-large', inputs: ['a', 'b'], dimensions: 4 });

    expect(captured!.path).toBe('/embeddings');
    expect(captured!.body).toMatchObject({
      model: 'openai/text-embedding-3-large',
      input: ['a', 'b'],
      dimensions: 4,
      encoding_format: 'float',
      provider: { zdr: true, data_collection: 'deny' },
    });
    expect(result.vectors).toEqual([vector(4, 1), vector(4, 2)]);
    expect(result.usage).toMatchObject({ promptTokens: 20, completionTokens: 0, costUsd: 0.000003 });
  });

  it('refuses vectors of the wrong size or count instead of corrupting the index', async () => {
    respond = () => ({ status: 200, body: { data: [{ index: 0, embedding: vector(3, 1) }] } });
    await expect(adapter().embed({ task: 'e', model: 'm', inputs: ['a'], dimensions: 4 })).rejects.toMatchObject({
      reason: 'invalid_output',
    });
    respond = () => ({ status: 200, body: { data: [{ index: 0, embedding: vector(4, 1) }] } });
    await expect(adapter().embed({ task: 'e', model: 'm', inputs: ['a', 'b'], dimensions: 4 })).rejects.toMatchObject({
      reason: 'invalid_output',
    });
  });
});

describe('UnavailableLlmAdapter', () => {
  it('reports itself unavailable and fails clearly', async () => {
    const unavailable = new UnavailableLlmAdapter();
    expect(unavailable.available).toBe(false);
    await expect(unavailable.generateStructured()).rejects.toMatchObject({ reason: 'unavailable' });
    await expect(unavailable.embed()).rejects.toMatchObject({ reason: 'unavailable' });
  });
});
