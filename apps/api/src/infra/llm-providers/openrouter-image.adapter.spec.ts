import { createServer, type IncomingMessage, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { LlmError } from './llm.port';
import { OpenRouterImageAdapter } from './openrouter-image.adapter';

let server: Server;
let base: string;
let captured: { path: string; body: Record<string, unknown> } | null = null;
let respond: () => { status: number; body: unknown } = () => ({ status: 200, body: {} });

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString('utf8');
}

beforeAll(async () => {
  server = createServer(async (req, res) => {
    captured = { path: req.url ?? '', body: JSON.parse((await readBody(req)) || '{}') as Record<string, unknown> };
    const { status, body } = respond();
    res.statusCode = status;
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify(body));
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(() => {
  server.closeAllConnections();
  server.close();
});

const adapter = (strictPrivacy = true) => new OpenRouterImageAdapter({ apiKey: 'sk-test', baseUrl: base, strictPrivacy });
const request = {
  task: 'image.generate',
  model: 'google/gemini-nano-banana-2.1',
  prompt: 'A chai stall at sunrise',
  references: ['https://res.cloudinary.com/demo/image/upload/p.jpg'],
  aspectRatio: '4:5' as const,
};
const png = Buffer.from([0x89, 0x50, 0x4e, 0x47]).toString('base64');

describe('OpenRouterImageAdapter', () => {
  it('calls the Image API with privacy routing, aspect ratio and references', async () => {
    respond = () => ({
      status: 200,
      body: { data: [{ b64_json: png, media_type: 'image/png' }], usage: { prompt_tokens: 50, completion_tokens: 1290, cost: 0.039 } },
    });
    const result = await adapter().generate(request);

    expect(captured?.path).toBe('/images');
    expect(captured?.body).toMatchObject({
      model: 'google/gemini-nano-banana-2.1',
      aspect_ratio: '4:5',
      n: 1,
      response_format: 'b64_json',
      provider: { zdr: true, data_collection: 'deny' },
      input_references: [{ type: 'image_url', image_url: { url: request.references[0] } }],
    });
    expect(result.images[0]?.mediaType).toBe('image/png');
    expect(result.images[0]?.bytes.length).toBe(4);
    expect(result.usage).toEqual({ model: request.model, promptTokens: 50, completionTokens: 1290, costUsd: 0.039 });
  });

  it('sends no references field when there are none', async () => {
    respond = () => ({ status: 200, body: { data: [{ b64_json: png, media_type: 'image/png' }] } });
    await adapter().generate({ ...request, references: [] });
    expect(captured?.body).not.toHaveProperty('input_references');
  });

  it('treats an answer with no usable image as invalid output', async () => {
    respond = () => ({ status: 200, body: { data: [{ media_type: 'image/png' }, { b64_json: png, media_type: 'text/html' }] } });
    await expect(adapter().generate(request)).rejects.toMatchObject({ reason: 'invalid_output' });
  });

  it('maps gateway errors to LlmError reasons', async () => {
    respond = () => ({ status: 404, body: { error: { message: 'No endpoints found' } } });
    const error = await adapter().generate(request).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(LlmError);
    expect((error as LlmError).reason).toBe('no_provider');
  });
});
