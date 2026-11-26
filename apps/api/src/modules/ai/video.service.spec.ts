import type { ConfigService } from '@nestjs/config';
import type { Env } from '@/config';
import {
  LlmError,
  VideoPort,
  VideoRoutes,
  type VideoJobState,
  type VideoRequest,
} from '@/infra/llm-providers';
import { VideoService } from './video.service';

class FakeRoute extends VideoPort {
  readonly available = true;
  readonly submitted: VideoRequest[] = [];
  constructor(
    readonly route: string,
    private readonly outcome: 'ok' | LlmError,
  ) {
    super();
  }
  submit(request: VideoRequest): Promise<{ providerJobId: string }> {
    this.submitted.push(request);
    return this.outcome === 'ok'
      ? Promise.resolve({ providerJobId: `${this.route}-job` })
      : Promise.reject(this.outcome);
  }
  status(): Promise<VideoJobState> {
    return Promise.resolve({ state: 'pending' });
  }
}

const chain = [
  { route: 'openrouter', model: 'kling' },
  { route: 'higgsfield', model: 'kling-hf' },
];
const config = { get: () => chain } as unknown as ConfigService<Env, true>;
const brief = {
  keyframeUrl: 'https://img.example/k.png',
  camera: 'push_in' as const,
  action: 'She smiles.',
  durationSeconds: 2,
};

describe('VideoService', () => {
  it('submits to the first route, rounds short scenes up to the model minimum, and suffixes the key', async () => {
    const first = new FakeRoute('openrouter', 'ok');
    const service = new VideoService(
      new VideoRoutes([first, new FakeRoute('higgsfield', 'ok')]),
      config,
    );
    const submitted = await service.submitClip(brief, 0, 'take-1');
    expect(submitted).toMatchObject({
      attempt: 0,
      route: 'openrouter',
      seconds: 3,
      providerJobId: 'openrouter-job',
    });
    expect(first.submitted[0]).toMatchObject({ durationSeconds: 3, idempotencyKey: 'take-1-0' });
    expect(first.submitted[0]!.prompt).toContain('pushes in steadily');
  });

  it('moves to the next route when one is out of credit', async () => {
    const service = new VideoService(
      new VideoRoutes([
        new FakeRoute('openrouter', new LlmError('insufficient_credits', 'empty')),
        new FakeRoute('higgsfield', 'ok'),
      ]),
      config,
    );
    await expect(service.submitClip(brief, 0, 'take-1')).resolves.toMatchObject({
      attempt: 1,
      route: 'higgsfield',
    });
  });

  it('skips routes that are not set up and says when nothing is left to try', async () => {
    const service = new VideoService(new VideoRoutes([new FakeRoute('openrouter', 'ok')]), config);
    expect(service.canMoveOn(0, 'moderated')).toBe(false);
    const both = new VideoService(
      new VideoRoutes([new FakeRoute('openrouter', 'ok'), new FakeRoute('higgsfield', 'ok')]),
      config,
    );
    expect(both.canMoveOn(0, 'moderated')).toBe(true);
    expect(both.canMoveOn(0, 'cancelled')).toBe(false);
  });
});
