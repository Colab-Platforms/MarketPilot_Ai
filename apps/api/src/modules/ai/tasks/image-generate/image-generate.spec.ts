import { ImagePort, LlmError, type ImageRequest, type ImageResult, type LlmFailure } from '@/infra/llm-providers';
import { ImageGenerationFailed, generateImage } from './image-generate.task';
import type { ImageBrief } from './image-prompt';

const brief: ImageBrief = {
  request: 'A bright photo of our chai stall at sunrise',
  aspectRatio: '1:1',
  placement: 'a feed post',
  design: 'photo',
  text: { headline: null, subheading: null, buttonText: null },
  logoUrl: null,
  brand: { name: 'Chai Point', facts: [], colours: [] },
  product: null,
  styleImageUrls: [],
};

class ScriptedImagePort extends ImagePort {
  readonly available = true;
  readonly calls: string[] = [];

  constructor(private readonly outcomes: Record<string, LlmFailure | 'ok'>) {
    super();
  }

  generate(request: ImageRequest): Promise<ImageResult> {
    this.calls.push(request.model);
    const outcome = this.outcomes[request.model];
    if (outcome !== 'ok') return Promise.reject(new LlmError(outcome ?? 'upstream', 'scripted failure'));
    return Promise.resolve({
      images: [{ bytes: Buffer.from('png'), mediaType: 'image/png' }],
      usage: { model: request.model, promptTokens: 10, completionTokens: 1290, costUsd: 0.039 },
    });
  }
}

const models = ['primary', 'second', 'third'];

describe('generateImage', () => {
  it('uses the first model when it works', async () => {
    const port = new ScriptedImagePort({ primary: 'ok', second: 'ok', third: 'ok' });
    const result = await generateImage(port, models, brief);
    expect(port.calls).toEqual(['primary']);
    expect(result.usage.model).toBe('primary');
    expect(result.promptVersion).toBe('image.generate@5');
  });

  it('falls back on provider failures and records every attempt', async () => {
    const port = new ScriptedImagePort({ primary: 'no_provider', second: 'timeout', third: 'ok' });
    const result = await generateImage(port, models, brief);
    expect(port.calls).toEqual(['primary', 'second', 'third']);
    expect(result.attempts.map((a) => [a.model, a.failure])).toEqual([
      ['primary', 'no_provider'],
      ['second', 'timeout'],
      ['third', null],
    ]);
  });

  it('stops at failures every model would share, such as an empty gateway account', async () => {
    const port = new ScriptedImagePort({ primary: 'insufficient_credits', second: 'ok', third: 'ok' });
    await expect(generateImage(port, models, brief)).rejects.toMatchObject({ reason: 'insufficient_credits' });
    expect(port.calls).toEqual(['primary']);
  });

  it('reports the last failure when every model fails', async () => {
    const port = new ScriptedImagePort({ primary: 'upstream', second: 'rate_limited', third: 'invalid_output' });
    const error = await generateImage(port, models, brief).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ImageGenerationFailed);
    expect((error as ImageGenerationFailed).reason).toBe('invalid_output');
    expect((error as ImageGenerationFailed).attempts).toHaveLength(3);
  });
});
