import { Module } from '@nestjs/common';
import { AiModule } from '@/modules/ai';
import { BrandModule } from '@/modules/brand';
import { MemoryAgentTools, MemoryModule } from '@/modules/memory';
import { ProfileAgentTools, ProfileModule } from '@/modules/profile';
import { ConversationStore } from './conversations/conversation-store';
import { Summariser } from './conversations/summariser';
import { CopilotController } from './copilot/copilot.controller';
import { CopilotService } from './copilot/copilot.service';
import { RunDriver } from './copilot/run-driver';
import { ExecutionGate } from './runtime/execution-gate';
import { ExecutionService } from './runtime/execution.service';
import { RunStore } from './runtime/run-store';
import { ToolRanker } from './runtime/tool-ranker';
import { ToolRegistry } from './runtime/tool-registry';
import { ToolRunner } from './runtime/tool-runner';

// Every module that contributes copilot tools is listed here (docs/COPILOT_AGENT.md section 2).
@Module({
  imports: [AiModule, BrandModule, MemoryModule, ProfileModule],
  controllers: [CopilotController],
  providers: [
    {
      provide: ToolRegistry,
      inject: [MemoryAgentTools, ProfileAgentTools],
      useFactory: (memory: MemoryAgentTools, profile: ProfileAgentTools) => new ToolRegistry([memory, profile]),
    },
    ToolRanker,
    ExecutionGate,
    ExecutionService,
    RunStore,
    ToolRunner,
    ConversationStore,
    Summariser,
    RunDriver,
    CopilotService,
  ],
})
export class AgentsModule {}
