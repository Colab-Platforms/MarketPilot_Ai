import type { VideoPort } from './video.port';

// The video providers that are set up, by route name. Which model runs on which route, and in
// what order, is VIDEO_MODELS (ADR 0011).
export class VideoRoutes {
  private readonly byName: ReadonlyMap<string, VideoPort>;

  constructor(ports: readonly VideoPort[]) {
    this.byName = new Map(ports.map((p) => [p.route, p]));
  }

  get(route: string): VideoPort | null {
    return this.byName.get(route) ?? null;
  }

  get any(): boolean {
    return this.byName.size > 0;
  }
}
