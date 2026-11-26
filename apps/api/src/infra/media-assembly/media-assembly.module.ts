import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { Global, Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import ffmpegPath from 'ffmpeg-static';
import type { Env } from '@/config';
import { AssemblyPort } from './assembly.port';
import { FfmpegAssemblyAdapter } from './ffmpeg-assembly.adapter';
import { UnavailableAssembly } from './unavailable-assembly.adapter';

const FONT_FILE = 'Poppins-SemiBold.ttf';

@Global()
@Module({
  providers: [
    {
      provide: AssemblyPort,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>): AssemblyPort => {
        const fontFile = resolve(config.get('REEL_FONT_DIR', { infer: true }), FONT_FILE);
        if (!ffmpegPath || !existsSync(ffmpegPath) || !existsSync(fontFile)) {
          new Logger('MediaAssembly').warn(
            'Reel assembly is off: ffmpeg or the caption font is missing',
          );
          return new UnavailableAssembly();
        }
        return new FfmpegAssemblyAdapter(ffmpegPath, fontFile);
      },
    },
  ],
  exports: [AssemblyPort],
})
export class MediaAssemblyModule {}
