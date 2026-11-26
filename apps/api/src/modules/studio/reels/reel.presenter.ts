import { Injectable } from '@nestjs/common';
import type { ReelProject } from '@marketpilot/contracts';
import { AssemblyPort } from '@/infra/media-assembly';
import { MediaStoragePort } from '@/infra/storage';
import { AiService, SoundService, VideoService } from '@/modules/ai';
import type { SoundAvailability } from './assembly/assembly-inputs';
import { toRenderView } from './assembly/render.mapper';
import { toReelProject, type ProjectRow } from './reel.mapper';
import { toVisuals } from './visuals/visuals.mapper';

// Turns a reel row into what the API returns, including what can be drawn, rendered and
// assembled on this server.
@Injectable()
export class ReelPresenter {
  constructor(
    private readonly ai: AiService,
    private readonly video: VideoService,
    private readonly storage: MediaStoragePort,
    private readonly assembly: AssemblyPort,
    private readonly sound: SoundService,
  ) {}

  get soundAvailable(): SoundAvailability {
    return { music: this.sound.musicAvailable, voice: this.sound.voiceAvailable };
  }

  get picturesAvailable(): boolean {
    return this.ai.imagesAvailable && this.storage.isAvailable();
  }

  get videoAvailable(): boolean {
    return this.video.available && this.storage.isAvailable();
  }

  get assemblyAvailable(): boolean {
    return this.assembly.available && this.storage.isAvailable();
  }

  present(row: ProjectRow): ReelProject {
    const visuals = toVisuals(row, {
      pictures: this.picturesAvailable,
      video: this.videoAvailable,
    });
    return toReelProject(row, { visuals, ...toRenderView(row, this.assemblyAvailable, this.soundAvailable) });
  }
}
