import { Module } from '@nestjs/common';
import { BrandModule } from '@/modules/brand';
import { MemoryModule } from '@/modules/memory';
import { ProfileAgentTools } from './agent-tools';
import { CompetitorController } from './competitor.controller';
import { ProfileController } from './profile.controller';

@Module({
  imports: [BrandModule, MemoryModule],
  controllers: [ProfileController, CompetitorController],
  providers: [ProfileAgentTools],
  exports: [ProfileAgentTools],
})
export class ProfileModule {}
