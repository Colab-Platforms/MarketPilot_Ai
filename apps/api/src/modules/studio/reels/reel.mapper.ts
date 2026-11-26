import type {
  Prisma,
  ReelIdea as ReelIdeaRow,
  ReelProject as ReelProjectRow,
  ReelScene as ReelSceneRow,
  ReelRender as ReelRenderRow,
  ReelTake as ReelTakeRow,
} from '@prisma/client';
import { z } from 'zod';
import {
  MAX_IDEA_BATCHES,
  createReelSchema,
  reelCharacterSchema,
  reelIdeaSchema,
  reelSceneSpecSchema,
  type CreateReel,
  type ReelCharacter,
  type ReelIdea,
  type ReelProject,
  type ReelScene,
  type ReelStatus,
  type ReelSummary,
  type ReelAssembly,
  type ReelRender,
  type ReelVisuals,
} from '@marketpilot/contracts';
import type { ReelIdeaDraft } from '@/modules/ai';

export const PROJECT_INCLUDE = {
  ideas: { orderBy: [{ batch: 'asc' }, { position: 'asc' }] },
  scenes: { orderBy: [{ position: 'asc' }, { createdAt: 'asc' }] },
  takes: { orderBy: { createdAt: 'desc' } },
  // Only the latest assembly is shown; older ones stay for history.
  renders: { orderBy: { createdAt: 'desc' }, take: 1 },
} as const satisfies Prisma.ReelProjectInclude;

export type ProjectRow = ReelProjectRow & {
  ideas: ReelIdeaRow[];
  scenes: ReelSceneRow[];
  takes: ReelTakeRow[];
  renders: ReelRenderRow[];
};

const ideaContentSchema = reelIdeaSchema.omit({ id: true });
const castSchema = z.array(reelCharacterSchema);

// Stored JSON was validated on the way in; anything unreadable is left out rather than failing the page.
export function briefOf(row: ReelProjectRow): CreateReel {
  return createReelSchema.parse(row.brief);
}

export function ideaOf(row: ReelIdeaRow): ReelIdea | null {
  const parsed = ideaContentSchema.safeParse(row.content);
  return parsed.success ? { id: row.id, ...parsed.data } : null;
}

export function ideaDraftOf(row: ReelIdeaRow): ReelIdeaDraft | null {
  const parsed = ideaContentSchema.safeParse(row.content);
  return parsed.success ? parsed.data : null;
}

export function castOf(row: ReelProjectRow): ReelCharacter[] {
  const parsed = castSchema.safeParse(row.cast);
  return parsed.success ? parsed.data : [];
}

export function sceneOf(row: ReelSceneRow): ReelScene | null {
  const parsed = reelSceneSpecSchema.safeParse(row.spec);
  return parsed.success ? { id: row.id, position: row.position, ...parsed.data } : null;
}

// The state a reel rests in when no step is running: a chosen idea means a storyboard exists.
export const restingStatus = (row: Pick<ReelProjectRow, 'chosenIdeaId'>): ReelStatus =>
  row.chosenIdeaId ? 'storyboard_ready' : 'ideas_ready';

export const isResting = (status: ReelStatus) =>
  status === 'ideas_ready' || status === 'storyboard_ready';

export const batchesOf = (row: ProjectRow) => new Set(row.ideas.map((i) => i.batch)).size;

export interface ReelExtras {
  visuals: ReelVisuals;
  render: ReelRender | null;
  assembly: ReelAssembly;
}

export function toReelProject(row: ProjectRow, extras: ReelExtras): ReelProject {
  const brief = briefOf(row);
  return {
    id: row.id,
    status: row.status,
    goal: brief.goal,
    lengthSeconds: brief.lengthSeconds,
    language: brief.language,
    audience: brief.audience,
    notes: brief.notes,
    productId: row.productId,
    productName: row.productName,
    ideas: row.ideas.flatMap((i) => ideaOf(i) ?? []),
    canAskForMoreIdeas: isResting(row.status) && batchesOf(row) < MAX_IDEA_BATCHES,
    chosenIdeaId: row.chosenIdeaId,
    cast: castOf(row),
    scenes: row.scenes.flatMap((s) => sceneOf(s) ?? []),
    ...extras,
    message: row.message,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toReelSummary(row: ProjectRow): ReelSummary {
  const chosen = row.ideas.find((i) => i.id === row.chosenIdeaId);
  return {
    id: row.id,
    status: row.status,
    title: chosen ? (ideaOf(chosen)?.title ?? null) : null,
    productName: row.productName,
    sceneCount: row.scenes.length,
    createdAt: row.createdAt.toISOString(),
  };
}
