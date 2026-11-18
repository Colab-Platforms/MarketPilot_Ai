import { Controller, Get, Inject } from '@nestjs/common';
import type Redis from 'ioredis';
import { PrismaService } from '@/infra/prisma';
import { REDIS } from '@/infra/redis';
import { Public } from '@/modules/identity';

@Public()
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(REDIS) private readonly redis: Redis | null,
  ) {}

  @Get()
  async check() {
    const [database, cache] = await Promise.allSettled([
      this.prisma.$queryRaw`SELECT 1`,
      this.redis ? this.redis.ping() : Promise.resolve(null),
    ]);
    const databaseUp = database.status === 'fulfilled';
    // `null` means Redis is not configured, which is not a failure.
    const cacheUp = this.redis ? cache.status === 'fulfilled' : null;
    return {
      status: databaseUp && cacheUp !== false ? 'ok' : 'degraded',
      database: databaseUp,
      cache: cacheUp,
    };
  }
}
