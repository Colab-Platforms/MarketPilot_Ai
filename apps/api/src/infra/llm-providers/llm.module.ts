import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '@/config';
import { LlmPort } from './llm.port';
import { OpenRouterAdapter } from './openrouter.adapter';
import { UnavailableLlmAdapter } from './unavailable-llm.adapter';

@Global()
@Module({
  providers: [
    {
      provide: LlmPort,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>): LlmPort => {
        const apiKey = config.get('OPENROUTER_API_KEY', { infer: true });
        if (!apiKey) return new UnavailableLlmAdapter();
        const privacy = config.get('OPENROUTER_PRIVACY', { infer: true });
        if (privacy === 'standard' && config.get('NODE_ENV', { infer: true }) === 'production') {
          throw new Error('OPENROUTER_PRIVACY must be strict in production');
        }
        return new OpenRouterAdapter({
          apiKey,
          baseUrl: config.get('OPENROUTER_BASE_URL', { infer: true }).replace(/\/+$/, ''),
          strictPrivacy: privacy === 'strict',
        });
      },
    },
  ],
  exports: [LlmPort],
})
export class LlmModule {}
