import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '@/config';
import { ImagePort } from './image.port';
import { LlmPort } from './llm.port';
import { OpenRouterAdapter } from './openrouter.adapter';
import type { OpenRouterSettings } from './openrouter-http';
import { OpenRouterImageAdapter } from './openrouter-image.adapter';
import { UnavailableImageAdapter } from './unavailable-image.adapter';
import { UnavailableLlmAdapter } from './unavailable-llm.adapter';
import { HiggsfieldVideoAdapter } from './higgsfield-video.adapter';
import { OpenRouterVideoAdapter } from './openrouter-video.adapter';
import { OpenRouterMusicAdapter } from './openrouter-music.adapter';
import { SarvamSpeechAdapter } from './sarvam-speech.adapter';
import { MusicPort, SpeechPort, UnavailableMusicAdapter, UnavailableSpeechAdapter } from './sound.port';
import { VideoRoutes } from './video-routes';

function openRouterSettings(config: ConfigService<Env, true>): OpenRouterSettings | null {
  const apiKey = config.get('OPENROUTER_API_KEY', { infer: true });
  if (!apiKey) return null;
  const privacy = config.get('OPENROUTER_PRIVACY', { infer: true });
  if (privacy === 'standard' && config.get('NODE_ENV', { infer: true }) === 'production') {
    throw new Error('OPENROUTER_PRIVACY must be strict in production');
  }
  return {
    apiKey,
    baseUrl: config.get('OPENROUTER_BASE_URL', { infer: true }).replace(/\/+$/, ''),
    strictPrivacy: privacy === 'strict',
  };
}

// The console copies the key as "keyId:secret"; a separate key id is accepted too.
function higgsfieldCredentials(config: ConfigService<Env, true>): string | null {
  const key = config.get('HIGGSFIELD_API_KEY', { infer: true });
  if (!key) return null;
  if (key.includes(':')) return key;
  const id = config.get('HIGGSFIELD_KEY_ID', { infer: true });
  return id ? `${id}:${key}` : null;
}

@Global()
@Module({
  providers: [
    {
      provide: LlmPort,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>): LlmPort => {
        const settings = openRouterSettings(config);
        return settings ? new OpenRouterAdapter(settings) : new UnavailableLlmAdapter();
      },
    },
    {
      provide: ImagePort,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>): ImagePort => {
        const settings = openRouterSettings(config);
        return settings ? new OpenRouterImageAdapter(settings) : new UnavailableImageAdapter();
      },
    },
    {
      provide: VideoRoutes,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>): VideoRoutes => {
        const settings = openRouterSettings(config);
        const higgsfield = higgsfieldCredentials(config);
        return new VideoRoutes([
          ...(settings ? [new OpenRouterVideoAdapter(settings)] : []),
          ...(higgsfield ? [new HiggsfieldVideoAdapter(higgsfield)] : []),
        ]);
      },
    },
    {
      provide: MusicPort,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>): MusicPort => {
        const settings = openRouterSettings(config);
        return settings ? new OpenRouterMusicAdapter(settings) : new UnavailableMusicAdapter();
      },
    },
    {
      provide: SpeechPort,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>): SpeechPort => {
        const key = config.get('SARVAM_API_KEY', { infer: true });
        return key ? new SarvamSpeechAdapter(key) : new UnavailableSpeechAdapter();
      },
    },
  ],
  exports: [LlmPort, ImagePort, VideoRoutes, MusicPort, SpeechPort],
})
export class LlmModule {}
