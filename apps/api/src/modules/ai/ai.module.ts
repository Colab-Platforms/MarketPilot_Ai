import { Module } from '@nestjs/common';
import { AiService } from './ai.service';
import { SoundService } from './sound.service';
import { VideoService } from './video.service';

@Module({
  providers: [AiService, VideoService, SoundService],
  exports: [AiService, VideoService, SoundService],
})
export class AiModule {}
