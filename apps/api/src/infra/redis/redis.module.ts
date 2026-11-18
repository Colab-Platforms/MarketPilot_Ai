import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import type { Env } from '@/config';

export const REDIS = Symbol('REDIS');

@Global()
@Module({
  providers: [
    {
      provide: REDIS,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>): Redis | null => {
        const url = config.get('REDIS_URL', { infer: true });
        return url ? new Redis(url, { maxRetriesPerRequest: null }) : null;
      },
    },
  ],
  exports: [REDIS],
})
export class RedisModule {}
