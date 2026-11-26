import { Body, Controller, Get, Headers, HttpCode, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import {
  ErrorCode,
  createImageGenerationSchema,
  type CreateImageGeneration,
  type ImageGeneration,
  type ImageGenerationList,
} from '@marketpilot/contracts';
import { DomainError, ZodValidationPipe } from '@/common';
import { CurrentAuth, type AuthPrincipal } from '@/modules/identity';
import { ImageGenerationService } from './images/image-generation.service';

const IDEMPOTENCY_KEY = /^[A-Za-z0-9_-]{8,100}$/;

@Controller('studio')
export class StudioController {
  constructor(private readonly images: ImageGenerationService) {}

  @Get('images')
  listImages(@CurrentAuth() principal: AuthPrincipal): Promise<ImageGenerationList> {
    return this.images.list(principal);
  }

  @Get('images/:id')
  getImage(
    @CurrentAuth() principal: AuthPrincipal,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<ImageGeneration> {
    return this.images.get(principal, id);
  }

  // Starts a background job and answers at once; poll GET images/:id until it settles.
  // Generating costs money, so the key is required: a retried request returns the first job.
  @Post('images')
  @HttpCode(202)
  createImage(
    @CurrentAuth() principal: AuthPrincipal,
    @Body(new ZodValidationPipe(createImageGenerationSchema)) body: CreateImageGeneration,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
  ): Promise<ImageGeneration> {
    if (!idempotencyKey || !IDEMPOTENCY_KEY.test(idempotencyKey)) {
      throw new DomainError(ErrorCode.Validation, 'Idempotency-Key must be 8 to 100 letters, digits, - or _', 400);
    }
    return this.images.create(principal, body, idempotencyKey);
  }
}
