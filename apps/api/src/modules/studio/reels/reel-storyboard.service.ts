import { Injectable } from '@nestjs/common';
import {
  ErrorCode,
  MAX_SCENES,
  MIN_SCENES,
  reelSceneSpecSchema,
  type AddReelScene,
  type ReelProject,
  type ReelSceneSpec,
  type ReorderReelScenes,
  type RewriteReelScene,
  type UpdateReelCharacter,
  type UpdateReelScene,
} from '@marketpilot/contracts';
import { DomainError } from '@/common';
import { PrismaService, type TenantTx } from '@/infra/prisma';
import { AiService } from '@/modules/ai';
import {
  assertCanPlan,
  assertEditable,
  closeLost,
  readProject,
  type ReelActor,
} from './reel-access';
import { castOf, ideaDraftOf, sceneOf, type ProjectRow } from './reel.mapper';
import { ReelPresenter } from './reel.presenter';
import { ReelJobRunner, messageFor, usageData } from './reel-job.runner';

const NEW_SCENE_SECONDS = 3;
const NEW_SCENE_ACTION = 'Describe what happens in this scene';

// Owner edits to a storyboard. Text edits are free and immediate; only a rewrite calls a model.
@Injectable()
export class ReelStoryboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiService,
    private readonly runner: ReelJobRunner,
    private readonly presenter: ReelPresenter,
  ) {}

  updateScene(
    actor: ReelActor,
    id: string,
    sceneId: string,
    changes: UpdateReelScene,
  ): Promise<ReelProject> {
    return this.edit(actor, id, async (tx, row) => {
      const current = specOf(row, sceneId);
      const next = validSpec({ ...current, ...changes }, row);
      await tx.reelScene.update({ where: { id: sceneId }, data: { spec: next } });
    });
  }

  addScene(actor: ReelActor, id: string, input: AddReelScene): Promise<ReelProject> {
    return this.edit(actor, id, async (tx, row) => {
      if (row.scenes.length >= MAX_SCENES) {
        throw new DomainError(
          ErrorCode.Conflict,
          `A reel can have at most ${MAX_SCENES} scenes`,
          409,
        );
      }
      const order = row.scenes.map((s) => s.id);
      const at = input.afterSceneId === null ? 0 : order.indexOf(input.afterSceneId) + 1;
      if (at === 0 && input.afterSceneId !== null)
        throw new DomainError(ErrorCode.NotFound, 'Scene not found', 404);
      // A new scene starts where the one before it happens, so the owner only writes the action.
      const before = row.scenes[Math.max(at - 1, 0)];
      const neighbour = before ? sceneOf(before) : null;
      const spec: ReelSceneSpec = {
        durationSeconds: NEW_SCENE_SECONDS,
        shot: 'medium',
        camera: 'static',
        setting: neighbour?.setting ?? 'Describe the place and the light',
        action: NEW_SCENE_ACTION,
        characterIds: neighbour?.characterIds ?? [],
        showsProduct: true,
        onScreenText: null,
        voiceover: null,
      };
      const created = await tx.reelScene.create({
        data: { workspaceId: actor.workspaceId, projectId: id, position: at, spec },
      });
      order.splice(at, 0, created.id);
      await renumber(tx, order);
    });
  }

  deleteScene(actor: ReelActor, id: string, sceneId: string): Promise<ReelProject> {
    return this.edit(actor, id, async (tx, row) => {
      specOf(row, sceneId);
      if (row.scenes.length <= MIN_SCENES) {
        throw new DomainError(
          ErrorCode.Conflict,
          `A reel needs at least ${MIN_SCENES} scenes`,
          409,
        );
      }
      await tx.reelScene.delete({ where: { id: sceneId } });
      await renumber(
        tx,
        row.scenes.map((s) => s.id).filter((s) => s !== sceneId),
      );
    });
  }

  reorderScenes(actor: ReelActor, id: string, input: ReorderReelScenes): Promise<ReelProject> {
    return this.edit(actor, id, async (tx, row) => {
      const existing = new Set(row.scenes.map((s) => s.id));
      const sameSet =
        input.sceneIds.length === existing.size && input.sceneIds.every((s) => existing.has(s));
      if (!sameSet || new Set(input.sceneIds).size !== input.sceneIds.length) {
        throw new DomainError(
          ErrorCode.Validation,
          'Send every scene of this reel exactly once',
          400,
        );
      }
      await renumber(tx, input.sceneIds);
    });
  }

  updateCharacter(
    actor: ReelActor,
    id: string,
    characterId: string,
    changes: UpdateReelCharacter,
  ): Promise<ReelProject> {
    return this.edit(actor, id, async (tx, row) => {
      const cast = castOf(row);
      if (!cast.some((c) => c.id === characterId))
        throw new DomainError(ErrorCode.NotFound, 'Character not found', 404);
      const next = cast.map((c) => (c.id === characterId ? { ...c, ...changes } : c));
      await tx.reelProject.update({ where: { id }, data: { cast: next } });
    });
  }

  // Rewrites one scene from the owner's instruction. It sends only the idea, cast and the
  // scenes on either side, never the whole storyboard. A repeated key returns the reel as is.
  async rewriteScene(
    actor: ReelActor,
    id: string,
    sceneId: string,
    input: RewriteReelScene,
    actionKey: string,
  ): Promise<ReelProject> {
    assertCanPlan(actor);
    const row = await this.prisma.withTenant(actor.workspaceId, (tx) => readProject(tx, id));
    if (row.lastActionKey === actionKey) return this.presenter.present(row);
    assertEditable(row);
    const index = row.scenes.findIndex((s) => s.id === sceneId);
    const scene = specOf(row, sceneId);
    const ideaRow = row.ideas.find((i) => i.id === row.chosenIdeaId);
    const idea = ideaRow ? ideaDraftOf(ideaRow) : null;
    if (!idea)
      throw new DomainError(ErrorCode.Conflict, 'Choose an idea before rewriting scenes', 409);

    const inputs = await this.runner.inputsFor(actor.workspaceId, row);
    const neighbour = (at: number) => (row.scenes[at] ? sceneOf(row.scenes[at]) : null);
    let result: Awaited<ReturnType<AiService['rewriteReelScene']>>;
    try {
      result = await this.ai.rewriteReelScene({
        ...inputs,
        idea,
        cast: castOf(row),
        scene,
        previous: neighbour(index - 1),
        next: neighbour(index + 1),
        instruction: input.instruction,
      });
    } catch (error) {
      throw new DomainError(ErrorCode.Internal, messageFor(error), 502);
    }

    return this.edit(actor, id, async (tx, fresh) => {
      specOf(fresh, sceneId);
      await tx.reelScene.update({
        where: { id: sceneId },
        data: { spec: validSpec(result.scene, fresh) },
      });
      await tx.reelProject.update({
        where: { id },
        data: { lastActionKey: actionKey, ...usageData(result.usage) },
      });
    });
  }

  private edit(
    actor: ReelActor,
    id: string,
    change: (tx: TenantTx, row: ProjectRow) => Promise<void>,
  ): Promise<ReelProject> {
    assertCanPlan(actor);
    return this.prisma.withTenant(actor.workspaceId, async (tx) => {
      await closeLost(tx);
      const row = await readProject(tx, id);
      assertEditable(row);
      await change(tx, row);
      return this.presenter.present(await readProject(tx, id));
    });
  }
}

function specOf(row: ProjectRow, sceneId: string): ReelSceneSpec {
  const sceneRow = row.scenes.find((s) => s.id === sceneId);
  const parsed = sceneRow ? reelSceneSpecSchema.safeParse(sceneRow.spec) : null;
  if (!parsed?.success) throw new DomainError(ErrorCode.NotFound, 'Scene not found', 404);
  return parsed.data;
}

// Scenes may only name people in this reel's cast.
function validSpec(candidate: unknown, row: ProjectRow): ReelSceneSpec {
  const parsed = reelSceneSpecSchema.safeParse(candidate);
  if (!parsed.success)
    throw new DomainError(ErrorCode.Validation, 'Check the scene details and try again', 400);
  const cast = new Set(castOf(row).map((c) => c.id));
  if (parsed.data.characterIds.some((c) => !cast.has(c))) {
    throw new DomainError(
      ErrorCode.Validation,
      "Only people in this reel's cast can appear in a scene",
      400,
      {
        fields: { characterIds: 'Choose people from the cast' },
      },
    );
  }
  return parsed.data;
}

// One statement at a time: an interactive transaction runs on a single connection.
async function renumber(tx: TenantTx, sceneIds: string[]): Promise<void> {
  for (const [position, sceneId] of sceneIds.entries()) {
    await tx.reelScene.update({ where: { id: sceneId }, data: { position } });
  }
}
