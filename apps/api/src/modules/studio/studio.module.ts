import { Module } from '@nestjs/common';
import { AiModule } from '@/modules/ai';
import { AssetsModule } from '@/modules/assets';
import { BrandModule } from '@/modules/brand';
import { MemoryModule } from '@/modules/memory';
import { StudioAgentTools } from './agent-tools';
import { ImageGenerationService } from './images/image-generation.service';
import { ImageJobRunner } from './images/image-job.runner';
import { StyleReferenceReader } from './images/style-reference.reader';
import { ReelJobRunner } from './reels/reel-job.runner';
import { ReelProjectService } from './reels/reel-project.service';
import { ReelStoryboardService } from './reels/reel-storyboard.service';
import { ReelPresenter } from './reels/reel.presenter';
import { ReelTrendService } from './reels/reel-trend.service';
import { ReelVisualService } from './reels/visuals/reel-visual.service';
import { AssemblyScanner } from './reels/assembly/assembly.scanner';
import { ReelAssemblyService } from './reels/assembly/reel-assembly.service';
import { ReelSoundMaker } from './reels/assembly/reel-sound.maker';
import { ClipScanner } from './reels/visuals/clip.scanner';
import { VisualRunner } from './reels/visuals/visual.runner';
import { ReelsController } from './reels/reels.controller';
import { StudioController } from './studio.controller';

@Module({
  imports: [AiModule, AssetsModule, BrandModule, MemoryModule],
  controllers: [StudioController, ReelsController],
  providers: [
    ImageGenerationService,
    ImageJobRunner,
    StyleReferenceReader,
    StudioAgentTools,
    ReelProjectService,
    ReelStoryboardService,
    ReelJobRunner,
    ReelTrendService,
    ReelPresenter,
    ReelVisualService,
    VisualRunner,
    ClipScanner,
    ReelAssemblyService,
    AssemblyScanner,
    ReelSoundMaker,
  ],
  exports: [ImageGenerationService, StudioAgentTools],
})
export class StudioModule {}
