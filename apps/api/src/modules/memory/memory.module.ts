import { Module } from '@nestjs/common';
import { MemoryAgentTools } from './agent-tools';
import { KnowledgeModule } from './knowledge/knowledge.module';
import { MemoryService } from './memory.service';

@Module({
  imports: [KnowledgeModule],
  providers: [MemoryService, MemoryAgentTools],
  exports: [KnowledgeModule, MemoryService, MemoryAgentTools],
})
export class MemoryModule {}
