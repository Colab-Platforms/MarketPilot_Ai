import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
} from '@nestjs/common';
import {
  ErrorCode,
  addReelSceneSchema,
  createReelSchema,
  drawReelVisualsSchema,
  type DrawReelVisuals,
  reorderReelScenesSchema,
  rewriteReelSceneSchema,
  updateReelCharacterSchema,
  updateReelSceneSchema,
  type AddReelScene,
  type CreateReel,
  type ReelList,
  type ReelProject,
  type ReorderReelScenes,
  type RewriteReelScene,
  type UpdateReelCharacter,
  type UpdateReelScene,
} from '@marketpilot/contracts';
import { DomainError, ZodValidationPipe } from '@/common';
import { CurrentAuth, type AuthPrincipal } from '@/modules/identity';
import { ReelProjectService } from './reel-project.service';
import { ReelStoryboardService } from './reel-storyboard.service';
import { ReelAssemblyService } from './assembly/reel-assembly.service';
import { ReelVisualService } from './visuals/reel-visual.service';

const IDEMPOTENCY_KEY = /^[A-Za-z0-9_-]{8,100}$/;
const CHARACTER_ID = /^c[1-9]$/;
const uuid = () => new ParseUUIDPipe();

// Steps that call a model cost money, so they need a key: a retried request returns the reel
// as it is instead of paying twice.
function requireKey(key: string | undefined): string {
  if (!key || !IDEMPOTENCY_KEY.test(key)) {
    throw new DomainError(
      ErrorCode.Validation,
      'Idempotency-Key must be 8 to 100 letters, digits, - or _',
      400,
    );
  }
  return key;
}

@Controller('studio/reels')
export class ReelsController {
  constructor(
    private readonly projects: ReelProjectService,
    private readonly storyboards: ReelStoryboardService,
    private readonly visuals: ReelVisualService,
    private readonly assembly: ReelAssemblyService,
  ) {}

  @Get()
  list(@CurrentAuth() principal: AuthPrincipal): Promise<ReelList> {
    return this.projects.list(principal);
  }

  @Get(':id')
  get(
    @CurrentAuth() principal: AuthPrincipal,
    @Param('id', uuid()) id: string,
  ): Promise<ReelProject> {
    return this.projects.get(principal, id);
  }

  // Starts planning and answers at once; poll GET :id until the status rests.
  @Post()
  @HttpCode(202)
  create(
    @CurrentAuth() principal: AuthPrincipal,
    @Body(new ZodValidationPipe(createReelSchema)) body: CreateReel,
    @Headers('idempotency-key') key: string | undefined,
  ): Promise<ReelProject> {
    return this.projects.create(principal, body, requireKey(key));
  }

  @Post(':id/ideas')
  @HttpCode(202)
  moreIdeas(
    @CurrentAuth() principal: AuthPrincipal,
    @Param('id', uuid()) id: string,
    @Headers('idempotency-key') key: string | undefined,
  ): Promise<ReelProject> {
    return this.projects.moreIdeas(principal, id, requireKey(key));
  }

  @Post(':id/ideas/:ideaId/choose')
  @HttpCode(202)
  chooseIdea(
    @CurrentAuth() principal: AuthPrincipal,
    @Param('id', uuid()) id: string,
    @Param('ideaId', uuid()) ideaId: string,
    @Headers('idempotency-key') key: string | undefined,
  ): Promise<ReelProject> {
    return this.projects.chooseIdea(principal, id, ideaId, requireKey(key));
  }

  @Post(':id/scenes')
  addScene(
    @CurrentAuth() principal: AuthPrincipal,
    @Param('id', uuid()) id: string,
    @Body(new ZodValidationPipe(addReelSceneSchema)) body: AddReelScene,
  ): Promise<ReelProject> {
    return this.storyboards.addScene(principal, id, body);
  }

  @Put(':id/scenes/order')
  reorderScenes(
    @CurrentAuth() principal: AuthPrincipal,
    @Param('id', uuid()) id: string,
    @Body(new ZodValidationPipe(reorderReelScenesSchema)) body: ReorderReelScenes,
  ): Promise<ReelProject> {
    return this.storyboards.reorderScenes(principal, id, body);
  }

  @Patch(':id/scenes/:sceneId')
  updateScene(
    @CurrentAuth() principal: AuthPrincipal,
    @Param('id', uuid()) id: string,
    @Param('sceneId', uuid()) sceneId: string,
    @Body(new ZodValidationPipe(updateReelSceneSchema)) body: UpdateReelScene,
  ): Promise<ReelProject> {
    return this.storyboards.updateScene(principal, id, sceneId, body);
  }

  @Delete(':id/scenes/:sceneId')
  deleteScene(
    @CurrentAuth() principal: AuthPrincipal,
    @Param('id', uuid()) id: string,
    @Param('sceneId', uuid()) sceneId: string,
  ): Promise<ReelProject> {
    return this.storyboards.deleteScene(principal, id, sceneId);
  }

  @Post(':id/scenes/:sceneId/rewrite')
  rewriteScene(
    @CurrentAuth() principal: AuthPrincipal,
    @Param('id', uuid()) id: string,
    @Param('sceneId', uuid()) sceneId: string,
    @Body(new ZodValidationPipe(rewriteReelSceneSchema)) body: RewriteReelScene,
    @Headers('idempotency-key') key: string | undefined,
  ): Promise<ReelProject> {
    return this.storyboards.rewriteScene(principal, id, sceneId, body, requireKey(key));
  }

  // Draws every portrait or keyframe that is missing or outdated; the rest are kept.
  @Post(':id/visuals')
  @HttpCode(202)
  drawVisuals(
    @CurrentAuth() principal: AuthPrincipal,
    @Param('id', uuid()) id: string,
    @Body(new ZodValidationPipe(drawReelVisualsSchema)) body: DrawReelVisuals,
    @Headers('idempotency-key') key: string | undefined,
  ): Promise<ReelProject> {
    return this.visuals.drawMissing(principal, id, body.kind, requireKey(key));
  }

  @Post(':id/cast/:characterId/portrait')
  @HttpCode(202)
  redrawPortrait(
    @CurrentAuth() principal: AuthPrincipal,
    @Param('id', uuid()) id: string,
    @Param('characterId') characterId: string,
    @Headers('idempotency-key') key: string | undefined,
  ): Promise<ReelProject> {
    if (!CHARACTER_ID.test(characterId))
      throw new DomainError(ErrorCode.NotFound, 'Character not found', 404);
    return this.visuals.redraw(principal, id, 'portrait', characterId, requireKey(key));
  }

  @Post(':id/scenes/:sceneId/keyframe')
  @HttpCode(202)
  redrawKeyframe(
    @CurrentAuth() principal: AuthPrincipal,
    @Param('id', uuid()) id: string,
    @Param('sceneId', uuid()) sceneId: string,
    @Headers('idempotency-key') key: string | undefined,
  ): Promise<ReelProject> {
    return this.visuals.redraw(principal, id, 'keyframe', sceneId, requireKey(key));
  }

  @Post(':id/scenes/:sceneId/clip')
  @HttpCode(202)
  rerenderClip(
    @CurrentAuth() principal: AuthPrincipal,
    @Param('id', uuid()) id: string,
    @Param('sceneId', uuid()) sceneId: string,
    @Headers('idempotency-key') key: string | undefined,
  ): Promise<ReelProject> {
    return this.visuals.redraw(principal, id, 'clip', sceneId, requireKey(key));
  }

  // Puts the finished reel together from its clips; nothing is paid to a provider.
  @Post(':id/assemble')
  @HttpCode(202)
  assemble(
    @CurrentAuth() principal: AuthPrincipal,
    @Param('id', uuid()) id: string,
    @Headers('idempotency-key') key: string | undefined,
  ): Promise<ReelProject> {
    return this.assembly.assemble(principal, id, requireKey(key));
  }

  // Switching back to an earlier picture is free.
  @Put(':id/takes/:takeId/select')
  selectTake(
    @CurrentAuth() principal: AuthPrincipal,
    @Param('id', uuid()) id: string,
    @Param('takeId', uuid()) takeId: string,
  ): Promise<ReelProject> {
    return this.visuals.select(principal, id, takeId);
  }

  @Patch(':id/cast/:characterId')
  updateCharacter(
    @CurrentAuth() principal: AuthPrincipal,
    @Param('id', uuid()) id: string,
    @Param('characterId') characterId: string,
    @Body(new ZodValidationPipe(updateReelCharacterSchema)) body: UpdateReelCharacter,
  ): Promise<ReelProject> {
    if (!CHARACTER_ID.test(characterId))
      throw new DomainError(ErrorCode.NotFound, 'Character not found', 404);
    return this.storyboards.updateCharacter(principal, id, characterId, body);
  }
}
