import { Injectable, Logger } from '@nestjs/common';
import type { AnyTool } from '@/common';
import { AiService } from '@/modules/ai';

function cosine(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i += 1) {
    const x = a[i] ?? 0;
    const y = b[i] ?? 0;
    dot += x * y;
    normA += x * x;
    normB += y * y;
  }
  return normA && normB ? dot / Math.sqrt(normA * normB) : 0;
}

// Ranks tool descriptions against the owner's message. Descriptions are embedded once per
// process; only needed once the catalogue outgrows the per-step cap.
@Injectable()
export class ToolRanker {
  private readonly logger = new Logger(ToolRanker.name);
  private readonly vectors = new Map<string, number[]>();

  constructor(private readonly ai: AiService) {}

  // Best first. Empty when embeddings are unavailable; selection then relies on domains.
  async rank(message: string, tools: readonly AnyTool[]): Promise<string[]> {
    if (!this.ai.available) return [];
    try {
      const missing = tools.filter((tool) => !this.vectors.has(tool.name));
      const { vectors } = await this.ai.embed([message, ...missing.map((t) => `${t.name}: ${t.description}`)]);
      missing.forEach((tool, i) => {
        const vector = vectors[i + 1];
        if (vector) this.vectors.set(tool.name, vector);
      });
      const query = vectors[0];
      if (!query) return [];
      return tools
        .map((tool) => ({ name: tool.name, score: cosine(query, this.vectors.get(tool.name) ?? []) }))
        .sort((a, b) => b.score - a.score)
        .map(({ name }) => name);
    } catch (error) {
      this.logger.warn(`Tool ranking failed: ${error instanceof Error ? error.message : 'unknown'}`);
      return [];
    }
  }
}
