import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post, Put, Query } from '@nestjs/common';
import {
  assetListQuerySchema,
  assetUploadTicketRequestSchema,
  createAssetSchema,
  updateAssetFeedbackSchema,
  updateStyleReferenceSchema,
  type Asset,
  type AssetList,
  type AssetListQuery,
  type AssetUploadTicketRequest,
  type CreateAsset,
  type MediaUploadTicket,
  type UpdateAssetFeedback,
  type UpdateStyleReference,
} from '@marketpilot/contracts';
import { ZodValidationPipe } from '@/common';
import { CurrentAuth, type AuthPrincipal } from '@/modules/identity';
import { AssetFeedbackService } from './asset-feedback.service';
import { AssetsService } from './assets.service';

// Everyone in the workspace can browse the library; uploading and removing take a creating role.
@Controller('assets')
export class AssetsController {
  constructor(
    private readonly assets: AssetsService,
    private readonly feedback: AssetFeedbackService,
  ) {}

  @Get()
  list(
    @CurrentAuth() principal: AuthPrincipal,
    @Query(new ZodValidationPipe(assetListQuerySchema)) query: AssetListQuery,
  ): Promise<AssetList> {
    return this.assets.list(principal, query);
  }

  // The browser uploads the file straight to storage with this ticket, then saves it with POST /assets.
  @HttpCode(200)
  @Post('upload-ticket')
  uploadTicket(
    @CurrentAuth() principal: AuthPrincipal,
    @Body(new ZodValidationPipe(assetUploadTicketRequestSchema)) body: AssetUploadTicketRequest,
  ): MediaUploadTicket {
    return this.assets.uploadTicket(principal, body.kind);
  }

  @Post()
  create(
    @CurrentAuth() principal: AuthPrincipal,
    @Body(new ZodValidationPipe(createAssetSchema)) body: CreateAsset,
  ): Promise<Asset> {
    return this.assets.create(principal, body);
  }

  // The viewer's like or dislike (with reasons) on a generated image; a null rating clears it.
  @Put(':id/feedback')
  setFeedback(
    @CurrentAuth() principal: AuthPrincipal,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(updateAssetFeedbackSchema)) body: UpdateAssetFeedback,
  ): Promise<Asset> {
    return this.feedback.setFeedback(principal, id, body);
  }

  // Stars an image so new images follow its look.
  @Put(':id/style-reference')
  setStyleReference(
    @CurrentAuth() principal: AuthPrincipal,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(updateStyleReferenceSchema)) body: UpdateStyleReference,
  ): Promise<Asset> {
    return this.feedback.setStyleReference(principal, id, body.styleReference);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@CurrentAuth() principal: AuthPrincipal, @Param('id', new ParseUUIDPipe()) id: string): Promise<void> {
    return this.assets.remove(principal, id);
  }
}
