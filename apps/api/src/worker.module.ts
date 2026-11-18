import { Module } from '@nestjs/common';
import { AppConfigModule } from '@/config';
import { PrismaModule } from '@/infra/prisma';
import { RedisModule } from '@/infra/redis';

@Module({
  imports: [AppConfigModule, PrismaModule, RedisModule],
})
export class WorkerModule {}
