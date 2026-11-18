import { Body, Controller, Get, HttpCode, Param, Post, Put } from '@nestjs/common';
import { startScanSchema, type OnboardingState, type ScanResponse, type StartScanInput } from '@marketpilot/contracts';
import { ZodValidationPipe } from '@/common';
import { CurrentAuth, type AuthPrincipal } from '@/modules/identity';
import { OnboardingService } from './onboarding.service';

@Controller('onboarding')
export class OnboardingController {
  constructor(private readonly onboarding: OnboardingService) {}

  @Get()
  state(@CurrentAuth() principal: AuthPrincipal): Promise<OnboardingState> {
    return this.onboarding.getState(principal);
  }

  @HttpCode(200)
  @Post('scan')
  startScan(
    @CurrentAuth() principal: AuthPrincipal,
    @Body(new ZodValidationPipe(startScanSchema)) body: StartScanInput,
  ): Promise<ScanResponse> {
    return this.onboarding.startScan(principal, body.force);
  }

  @Get('scan')
  scan(@CurrentAuth() principal: AuthPrincipal): Promise<ScanResponse> {
    return this.onboarding.getScan(principal);
  }

  // PUT: saving a step is idempotent, so retries and back-navigation are safe.
  @Put('steps/:step')
  saveStep(
    @CurrentAuth() principal: AuthPrincipal,
    @Param('step') step: string,
    @Body() body: unknown,
  ): Promise<OnboardingState> {
    return this.onboarding.saveStep(principal, step, body);
  }

  @HttpCode(200)
  @Post('complete')
  complete(@CurrentAuth() principal: AuthPrincipal): Promise<OnboardingState> {
    return this.onboarding.complete(principal);
  }
}

