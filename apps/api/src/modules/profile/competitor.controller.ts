import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import {
  createCompetitorSchema,
  ErrorCode,
  updateCompetitorSchema,
  type CompetitorList,
  type CreateCompetitorInput,
  type UpdateCompetitorInput,
} from '@marketpilot/contracts';
import { DomainError, ZodValidationPipe } from '@/common';
import { PrismaService, type TenantTx } from '@/infra/prisma';
import { BrandProfileService } from '@/modules/brand';
import { CurrentAuth, type AuthPrincipal } from '@/modules/identity';
import { CompetitorDiscoveryService, CompetitorService, MemoryService } from '@/modules/memory';

const EDIT_ROLES = new Set(['owner', 'admin', 'manager']);

// The competitor list: found once by AI web search, then kept, edited, added or removed by the owner.
@Controller('brand/competitors')
export class CompetitorController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly profile: BrandProfileService,
    private readonly competitors: CompetitorService,
    private readonly discovery: CompetitorDiscoveryService,
    private readonly memory: MemoryService,
  ) {}

  @Get()
  list(@CurrentAuth() principal: AuthPrincipal): Promise<CompetitorList> {
    return this.read(principal);
  }

  // Runs once per workspace (only a failed run that found nothing may be retried).
  @HttpCode(200)
  @Post('discover')
  async discover(@CurrentAuth() principal: AuthPrincipal): Promise<CompetitorList> {
    this.assertCanEdit(principal);
    await this.discovery.start(principal.workspaceId, await this.brandId(principal));
    return this.read(principal);
  }

  @Post()
  async add(
    @CurrentAuth() principal: AuthPrincipal,
    @Body(new ZodValidationPipe(createCompetitorSchema)) body: CreateCompetitorInput,
  ): Promise<CompetitorList> {
    this.assertCanEdit(principal);
    return this.change(principal, (tx, brandId) => this.competitors.add(tx, this.actor(principal), brandId, body));
  }

  // Editing a suggestion, or sending `{ keep: true }`, keeps it.
  @Patch(':id')
  async update(
    @CurrentAuth() principal: AuthPrincipal,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(updateCompetitorSchema)) body: UpdateCompetitorInput,
  ): Promise<CompetitorList> {
    this.assertCanEdit(principal);
    return this.change(principal, (tx, brandId) => this.competitors.update(tx, this.actor(principal), brandId, id, body));
  }

  @Delete(':id')
  async remove(
    @CurrentAuth() principal: AuthPrincipal,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<CompetitorList> {
    this.assertCanEdit(principal);
    return this.change(principal, (tx, brandId) => this.competitors.remove(tx, brandId, id));
  }

  private async change(
    principal: AuthPrincipal,
    apply: (tx: TenantTx, brandId: string) => Promise<void>,
  ): Promise<CompetitorList> {
    const brandId = await this.brandId(principal);
    await this.prisma.withTenant(principal.workspaceId, (tx) => apply(tx, brandId));
    // After commit, so the index reads exactly what the owner kept.
    await this.memory.syncEntities(principal.workspaceId, brandId);
    return this.read(principal);
  }

  private read(principal: AuthPrincipal): Promise<CompetitorList> {
    return this.prisma.withTenant(principal.workspaceId, async (tx) =>
      this.competitors.list(tx, principal.workspaceId, await this.profile.brandIdOf(tx, principal.workspaceId)),
    );
  }

  private brandId(principal: AuthPrincipal): Promise<string> {
    return this.prisma.withTenant(principal.workspaceId, (tx) => this.profile.brandIdOf(tx, principal.workspaceId));
  }

  private actor(principal: AuthPrincipal) {
    return { workspaceId: principal.workspaceId, userId: principal.userId };
  }

  private assertCanEdit(principal: AuthPrincipal): void {
    if (!EDIT_ROLES.has(principal.role)) {
      throw new DomainError(ErrorCode.Forbidden, 'Only an owner, admin or manager can change competitors', 403);
    }
  }
}
