import { Body, Controller, Get, HttpCode, Param, Post, Put } from '@nestjs/common';
import {
  applyReviewSchema,
  ErrorCode,
  startScanSchema,
  updateProfileSchema,
  updateSectionSchema,
  uploadTicketRequestSchema,
  type ApplyReviewInput,
  type MediaUploadTicket,
  type ProductList,
  type ServiceList,
  type ProfileResponse,
  type ScanResponse,
  type StartScanInput,
  type UpdateProfileInput,
  type UpdateSectionInput,
  type UploadTicketRequest,
} from '@marketpilot/contracts';
import { DomainError, ZodValidationPipe } from '@/common';
import { PrismaService } from '@/infra/prisma';
import { BrandCatalogueService, BrandMediaService, BrandProfileService } from '@/modules/brand';
import { CurrentAuth, type AuthPrincipal } from '@/modules/identity';
import { MemoryService, ScanReviewService, ScanService } from '@/modules/memory';

// Everyone in the workspace can read the profile; changing it takes an editing role.
const EDIT_ROLES = new Set(['owner', 'admin', 'manager']);

@Controller('brand')
export class ProfileController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly profile: BrandProfileService,
    private readonly catalogue: BrandCatalogueService,
    private readonly media: BrandMediaService,
    private readonly scans: ScanService,
    private readonly reviews: ScanReviewService,
    private readonly memory: MemoryService,
  ) {}

  @Get('profile')
  getProfile(@CurrentAuth() principal: AuthPrincipal): Promise<ProfileResponse> {
    return this.prisma.withTenant(principal.workspaceId, (tx) => this.profile.read(tx, principal.workspaceId));
  }

  // The one write path for everything about the business. Sends only what changed: profile
  // `values` (a null clears one), and `products` / `services` entries to create, edit or remove.
  @Put('profile')
  async updateProfile(
    @CurrentAuth() principal: AuthPrincipal,
    @Body(new ZodValidationPipe(updateProfileSchema)) body: UpdateProfileInput,
  ): Promise<ProfileResponse> {
    this.assertCanEdit(principal);
    const actor = { workspaceId: principal.workspaceId, userId: principal.userId };
    const saved = await this.prisma.withTenant(principal.workspaceId, async (tx) => {
      if (Object.keys(body.values).length > 0) await this.profile.update(tx, actor, body.values);
      if (body.products.length > 0 || body.services.length > 0) {
        const brandId = await this.profile.brandIdOf(tx, principal.workspaceId);
        await this.catalogue.apply(tx, brandId, actor, { products: body.products, services: body.services });
      }
      return this.profile.read(tx, principal.workspaceId);
    });
    await this.reindex(principal);
    return saved;
  }

  // Switches a section off as not relevant (it stops counting toward completeness), or back on.
  @Put('profile/sections/:id')
  updateSection(
    @CurrentAuth() principal: AuthPrincipal,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateSectionSchema)) body: UpdateSectionInput,
  ): Promise<ProfileResponse> {
    this.assertCanEdit(principal);
    const actor = { workspaceId: principal.workspaceId, userId: principal.userId };
    return this.prisma.withTenant(principal.workspaceId, (tx) => this.profile.setSectionSkipped(tx, actor, id, body.skipped));
  }

  @Get('products')
  async products(@CurrentAuth() principal: AuthPrincipal): Promise<ProductList> {
    return this.prisma.withTenant(principal.workspaceId, async (tx) => ({
      products: await this.catalogue.list(tx, await this.profile.brandIdOf(tx, principal.workspaceId)),
    }));
  }

  // A short-lived ticket the browser uses to upload one image (a product photo or the logo)
  // straight to storage. The resulting URL is then saved through PUT /brand/profile.
  @HttpCode(200)
  @Post('media/upload-ticket')
  uploadTicket(
    @CurrentAuth() principal: AuthPrincipal,
    @Body(new ZodValidationPipe(uploadTicketRequestSchema)) body: UploadTicketRequest,
  ): MediaUploadTicket {
    this.assertCanEdit(principal);
    return this.media.uploadTicket(principal.workspaceId, body.purpose);
  }

  @Get('services')
  async services(@CurrentAuth() principal: AuthPrincipal): Promise<ServiceList> {
    return this.prisma.withTenant(principal.workspaceId, async (tx) => ({
      services: await this.catalogue.listServices(tx, await this.profile.brandIdOf(tx, principal.workspaceId)),
    }));
  }

  // Reading the website again: start, watch, then approve what was found.
  @HttpCode(200)
  @Post('profile/scan')
  async startScan(
    @CurrentAuth() principal: AuthPrincipal,
    @Body(new ZodValidationPipe(startScanSchema)) body: StartScanInput,
  ): Promise<ScanResponse> {
    this.assertCanEdit(principal);
    const brandId = await this.brandId(principal);
    return { scan: await this.scans.start(principal.workspaceId, brandId, body.force) };
  }

  @Get('profile/scan')
  async scan(@CurrentAuth() principal: AuthPrincipal): Promise<ScanResponse> {
    const brandId = await this.brandId(principal);
    return { scan: await this.scans.latest(principal.workspaceId, brandId) };
  }

  @HttpCode(200)
  @Post('profile/scan/review')
  async reviewScan(
    @CurrentAuth() principal: AuthPrincipal,
    @Body(new ZodValidationPipe(applyReviewSchema)) body: ApplyReviewInput,
  ): Promise<ProfileResponse> {
    this.assertCanEdit(principal);
    const saved = await this.prisma.withTenant(principal.workspaceId, async (tx) => {
      const brandId = await this.profile.brandIdOf(tx, principal.workspaceId);
      await this.reviews.apply(
        tx,
        { workspaceId: principal.workspaceId, brandId, userId: principal.userId },
        body.decisions,
      );
      return this.profile.read(tx, principal.workspaceId);
    });
    await this.reindex(principal);
    return saved;
  }

  // After a save has committed, so the index reads what the owner just approved.
  private async reindex(principal: AuthPrincipal): Promise<void> {
    await this.memory.syncEntities(principal.workspaceId, await this.brandId(principal));
  }

  private brandId(principal: AuthPrincipal): Promise<string> {
    return this.prisma.withTenant(principal.workspaceId, (tx) => this.profile.brandIdOf(tx, principal.workspaceId));
  }

  private assertCanEdit(principal: AuthPrincipal): void {
    if (!EDIT_ROLES.has(principal.role)) {
      throw new DomainError(ErrorCode.Forbidden, 'Only an owner, admin or manager can change the brand profile', 403);
    }
  }
}
