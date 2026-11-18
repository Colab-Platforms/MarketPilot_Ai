import { Module } from '@nestjs/common';
import { BrandModule } from '@/modules/brand';
import { MemoryModule } from '@/modules/memory';
import { OnboardingController } from './onboarding.controller';
import { OnboardingService } from './onboarding.service';

@Module({
  imports: [BrandModule, MemoryModule],
  controllers: [OnboardingController],
  providers: [OnboardingService],
})
export class OnboardingModule {}
