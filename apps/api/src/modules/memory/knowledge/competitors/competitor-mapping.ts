import type { BrandCompetitor, CompetitorDiscovery as DiscoveryRow } from '@prisma/client';
import type { Competitor, CompetitorDiscovery } from '@marketpilot/contracts';

// A run lives in this process (no queue yet); one still "running" after this was lost to a restart.
export const DISCOVERY_STALE_AFTER_MS = 4 * 60_000;

export const isStale = (row: DiscoveryRow) =>
  row.status === 'running' && Date.now() - row.startedAt.getTime() > DISCOVERY_STALE_AFTER_MS;

export function toCompetitor(row: BrandCompetitor): Competitor {
  return {
    id: row.id,
    name: row.name,
    websiteUrl: row.websiteUrl,
    logoUrl: row.logoUrl,
    summary: row.summary,
    whySimilar: row.whySimilar,
    offerings: row.offerings,
    priceRange: row.priceRange,
    positioning: row.positioning,
    status: row.status === 'candidate' ? 'suggested' : 'kept',
    source: row.sourceType === 'user_stated' ? 'owner' : 'search',
  };
}

export function toDiscovery(row: DiscoveryRow | null): CompetitorDiscovery {
  if (!row) return { status: 'not_started', message: null, canStart: true };
  if (isStale(row)) {
    return { status: 'failed', message: 'Finding competitors did not finish. Try again.', canStart: true };
  }
  // Discovery is once per workspace; only a run that failed before finding anything can be retried.
  return { status: row.status, message: row.message, canStart: row.status === 'failed' && row.found === 0 };
}
