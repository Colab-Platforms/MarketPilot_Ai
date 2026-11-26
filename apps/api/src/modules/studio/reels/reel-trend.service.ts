import { Injectable, Logger } from '@nestjs/common';
import { z } from 'zod';
import { PrismaService } from '@/infra/prisma';
import { AiService, type ReelTrend } from '@/modules/ai';
import type { ReelContext } from '@/modules/memory';

const FRESH_FOR_MS = 7 * 24 * 60 * 60_000;
// An empty search is retried sooner, in case it was a bad day for the search engine.
const EMPTY_FRESH_FOR_MS = 24 * 60 * 60_000;

const storedTrendsSchema = z.array(
  z.object({ name: z.string(), kind: z.string(), detail: z.string() }),
);

const normalise = (text: string) => text.toLowerCase().replace(/\s+/g, ' ').trim();

// Reel trends for a category and market. They are public and the same for every brand in that
// market, so one web search a week serves every workspace that asks.
@Injectable()
export class ReelTrendService {
  private readonly logger = new Logger(ReelTrendService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiService,
  ) {}

  async trendsFor(context: ReelContext): Promise<ReelTrend[]> {
    if (!context.category) return [];
    const topicKey = `${normalise(context.category)}|${normalise(context.market.area)}`;
    // trend_digest holds no tenant data, so it is read outside a tenant transaction.
    const cached = await this.prisma.trendDigest.findUnique({ where: { topicKey } });
    const cachedTrends = cached ? readTrends(cached.items) : [];
    if (cached && cached.expiresAt > new Date()) return cachedTrends;

    try {
      const found = await this.ai.findReelTrends({
        category: context.category,
        area: context.market.area,
        today: new Date(),
      });
      const trends = found.trends.map(({ name, kind, detail }) => ({ name, kind, detail }));
      const expiresAt = new Date(
        Date.now() + (trends.length > 0 ? FRESH_FOR_MS : EMPTY_FRESH_FOR_MS),
      );
      const data = {
        items: trends,
        sources: found.sources,
        promptVersion: found.promptVersion,
        expiresAt,
      };
      await this.prisma.trendDigest.upsert({
        where: { topicKey },
        create: { topicKey, ...data },
        update: data,
      });
      return trends;
    } catch (error) {
      // Ideas still work without trends; a stale digest beats none.
      this.logger.warn(
        `Reel trend search failed (${error instanceof Error ? error.message : 'unknown'})`,
      );
      return cachedTrends;
    }
  }
}

function readTrends(items: unknown): ReelTrend[] {
  const parsed = storedTrendsSchema.safeParse(items);
  return parsed.success ? parsed.data : [];
}
