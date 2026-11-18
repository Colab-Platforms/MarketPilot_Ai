import { toJsonSchema } from '@langchain/core/utils/json_schema';
import { z } from 'zod';
import type { WorkspaceRole } from '@marketpilot/contracts';
import { ALL_ROLES, type AgentToolSource, type AnyTool, type ReadToolDefinition } from '@/common';
import type { ToolSpec } from '@/modules/ai';
import { toModelToolName } from './tool-names';

const SEARCH_RESULTS = 5;

const searchArgs = z
  .object({ query: z.string().trim().min(2).max(200).describe('The capability you need, in plain words.') })
  .strict();

interface ToolMatch {
  name: string;
  description: string;
}

// Every tool the copilot can use, collected from the modules at boot.
export class ToolRegistry {
  private readonly byName = new Map<string, AnyTool>();
  private readonly specs = new Map<string, ToolSpec>();

  constructor(sources: AgentToolSource[]) {
    for (const tool of sources.flatMap((source) => source.tools())) this.register(tool);
    this.register(this.searchTool());
  }

  get(name: string): AnyTool | undefined {
    return this.byName.get(name);
  }

  // Only tools the role may use are ever shown to the model.
  forRole(role: WorkspaceRole): AnyTool[] {
    return [...this.byName.values()].filter((tool) => tool.roles.includes(role));
  }

  specsFor(names: readonly string[]): ToolSpec[] {
    return names.flatMap((name) => {
      const spec = this.specs.get(name);
      return spec ? [spec] : [];
    });
  }

  // Keyword match over names and descriptions. Good enough while the catalogue is small; the
  // selector's embedding rank covers paraphrases.
  search(query: string, role: WorkspaceRole, limit = SEARCH_RESULTS): ToolMatch[] {
    const terms = query.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length > 2);
    return this.forRole(role)
      .filter((tool) => tool.name !== 'tools.search')
      .map((tool) => {
        const haystack = `${tool.name} ${tool.domain} ${tool.description}`.toLowerCase();
        return { tool, score: terms.filter((term) => haystack.includes(term)).length };
      })
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(({ tool }) => ({ name: tool.name, description: tool.description }));
  }

  private register(tool: AnyTool): void {
    if (this.byName.has(tool.name)) throw new Error(`Two tools are named ${tool.name}`);
    this.byName.set(tool.name, tool);
    const parameters = { ...(toJsonSchema(tool.args) as Record<string, unknown>) };
    delete parameters.$schema;
    this.specs.set(tool.name, { name: toModelToolName(tool.name), description: tool.description, parameters });
  }

  // The escape hatch for 100+ tools: the model asks for a capability it was not given, and the
  // matches are bound on its next step. It can only find tools the role may already use.
  private searchTool(): ReadToolDefinition<z.infer<typeof searchArgs>, ToolMatch[]> {
    return {
      name: 'tools.search',
      domain: 'meta',
      kind: 'read',
      label: 'Looking for the right tool',
      description:
        'Find more tools when none of the tools you have can do what the owner asked. ' +
        'The tools found become available on your next step.',
      args: searchArgs,
      roles: ALL_ROLES,
      run: async (ctx, args) => this.search(args.query, ctx.role),
      summarize: (matches) =>
        matches.length === 0
          ? 'No tool does that yet. Tell the owner plainly that you cannot do it yet.'
          : `Now available:\n${matches.map((m) => `- ${m.name}: ${m.description}`).join('\n')}`,
    };
  }
}
