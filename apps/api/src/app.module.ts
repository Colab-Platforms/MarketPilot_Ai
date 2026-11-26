import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { AppConfigModule } from '@/config';
import { AllExceptionsFilter } from '@/common';
import { EmailModule } from '@/infra/email';
import { LlmModule } from '@/infra/llm-providers';
import { MediaAssemblyModule } from '@/infra/media-assembly';
import { PrismaModule } from '@/infra/prisma';
import { RedisModule } from '@/infra/redis';
import { StorageModule } from '@/infra/storage';
import { HealthModule } from '@/health/health.module';
import { IdentityModule } from '@/modules/identity';
import { BrandModule } from '@/modules/brand';
import { OnboardingModule } from '@/modules/onboarding';
import { ProfileModule } from '@/modules/profile';
import { MemoryModule } from '@/modules/memory';
import { AiModule } from '@/modules/ai';
import { StudioModule } from '@/modules/studio';
import { AssetsModule } from '@/modules/assets';
import { CalendarModule } from '@/modules/calendar';
import { PublishingModule } from '@/modules/publishing';
import { AnalyticsModule } from '@/modules/analytics';
import { AgentsModule } from '@/modules/agents';
import { BillingModule } from '@/modules/billing';
import { NotificationsModule } from '@/modules/notifications';
import { AdminModule } from '@/modules/admin';

@Module({
  imports: [
    AppConfigModule,
    PrismaModule,
    EmailModule,
    LlmModule,
    MediaAssemblyModule,
    RedisModule,
    StorageModule,
    HealthModule,
    IdentityModule,
    BrandModule,
    OnboardingModule,
    ProfileModule,
    MemoryModule,
    AiModule,
    StudioModule,
    AssetsModule,
    CalendarModule,
    PublishingModule,
    AnalyticsModule,
    AgentsModule,
    BillingModule,
    NotificationsModule,
    AdminModule,
  ],
  providers: [{ provide: APP_FILTER, useClass: AllExceptionsFilter }],
})
export class AppModule {}
