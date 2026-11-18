import { Injectable } from '@nestjs/common';
import type { OnboardingSession, Prisma } from '@prisma/client';
import {
  basicsStepSchema,
  ErrorCode,
  nextStep,
  ONBOARDING_STEPS,
  onboardingStepSchema,
  onboardingStepsFor,
  questionStepSchema,
  reviewStepSchema,
  typeStepSchema,
  type OnboardingState,
  type ScanResponse,
  type OnboardingStep,
} from '@marketpilot/contracts';
import { DomainError, parseWithSchema } from '@/common';
import { PrismaService, type TenantTx } from '@/infra/prisma';
import type { AuthPrincipal } from '@/modules/identity';
import { BrandService, type BrandSnapshot } from '@/modules/brand';
import { ScanReviewService, ScanService } from '@/modules/memory';
import { buildProfilePatch } from './profile-patch';

const OWNER_ROLES = new Set(['owner', 'admin']);

@Injectable()
export class OnboardingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly brands: BrandService,
    private readonly scans: ScanService,
    private readonly review: ScanReviewService,
  ) {}

  getState(principal: AuthPrincipal): Promise<OnboardingState> {
    return this.inTenant(principal, async (tx) => {
      const { session, brand } = await this.ensureSession(tx, principal);
      return toState(session, brand);
    });
  }

  async startScan(principal: AuthPrincipal, force: boolean): Promise<ScanResponse> {
    const { session, brand } = await this.inTenant(principal, (tx) => this.ensureSession(tx, principal));
    if (session.track !== 'business') {
      throw new DomainError(ErrorCode.Conflict, 'Website scanning is only for business accounts', 409);
    }
    return { scan: await this.scans.start(principal.workspaceId, brand.id, force) };
  }

  async getScan(principal: AuthPrincipal): Promise<ScanResponse> {
    const { brand } = await this.inTenant(principal, (tx) => this.ensureSession(tx, principal));
    return { scan: await this.scans.latest(principal.workspaceId, brand.id) };
  }

  saveStep(principal: AuthPrincipal, rawStep: string, body: unknown): Promise<OnboardingState> {
    const step = parseWithSchema(onboardingStepSchema, rawStep);

    return this.inTenant(principal, async (tx) => {
      const { session, brand } = await this.ensureSession(tx, principal);
      this.assertEditable(session);
      const stepsBefore = stepsOf(session.track, brand);
      if (!stepsBefore.includes(step)) {
        throw new DomainError(ErrorCode.Conflict, 'This step does not apply to your account', 409);
      }
      this.assertPriorStepsDone(session, step, stepsBefore);

      let track = session.track;
      let completed = completedOf(session);
      let currentBrand = brand;
      const stepAnswers = await this.applyStep(tx, principal, session, brand, step, body);
      if (stepAnswers.track && stepAnswers.track !== track) {
        track = stepAnswers.track;
        completed = completed.filter((s) => s === 'type' || s === 'basics');
      }
      if (stepAnswers.brand) currentBrand = stepAnswers.brand;
      // A different website means the scan results no longer describe this business.
      if (step === 'basics' && brand.websiteUrl !== currentBrand.websiteUrl) {
        completed = completed.filter((s) => s !== 'review');
      }

      completed = [...new Set([...completed, step])];
      const updated = await tx.onboardingSession.update({
        where: { id: session.id },
        data: {
          track,
          completedSteps: completed,
          currentStep: nextStep(completed, stepsOf(track, currentBrand)) ?? 'goals',
          answers: { ...asRecord(session.answers), [step]: stepAnswers.stored } as Prisma.InputJsonValue,
        },
      });
      return toState(updated, currentBrand);
    });
  }

  complete(principal: AuthPrincipal): Promise<OnboardingState> {
    return this.inTenant(principal, async (tx) => {
      const { session, brand } = await this.ensureSession(tx, principal);
      if (session.status === 'completed') return toState(session, brand);

      const missing = stepsOf(session.track, brand).filter((step) => !completedOf(session).includes(step));
      if (missing.length > 0) {
        throw new DomainError(ErrorCode.Conflict, 'Finish the remaining steps first', 409, { missing });
      }

      const updated = await tx.onboardingSession.update({
        where: { id: session.id },
        data: { status: 'completed', completedAt: new Date() },
      });
      await tx.outboxEvent.create({
        data: {
          workspaceId: principal.workspaceId,
          brandId: brand.id,
          type: 'onboarding.completed',
          payload: { sessionId: session.id },
          idempotencyKey: `onboarding.completed:${session.id}`,
        },
      });
      return toState(updated, brand);
    });
  }

  private async applyStep(
    tx: TenantTx,
    principal: AuthPrincipal,
    session: OnboardingSession,
    brand: BrandSnapshot,
    step: OnboardingStep,
    body: unknown,
  ): Promise<{ stored: unknown; track?: OnboardingSession['track']; brand?: BrandSnapshot }> {
    switch (step) {
      case 'type': {
        const input = parseWithSchema(typeStepSchema, body);
        await tx.workspace.update({
          where: { id: principal.workspaceId },
          data: { accountType: input.accountType },
        });
        return { stored: input, track: input.accountType };
      }
      case 'basics': {
        const input = parseWithSchema(basicsStepSchema, body);
        const updated = await this.brands.applyBasics(tx, principal.workspaceId, brand.id, {
          name: input.brandName,
          websiteUrl: input.websiteUrl,
          city: input.city,
          language: input.language,
        });
        await tx.workspace.update({ where: { id: principal.workspaceId }, data: { name: input.brandName } });
        return { stored: input, brand: updated };
      }
      case 'review': {
        const input = parseWithSchema(reviewStepSchema, body);
        if ('skipped' in input) return { stored: { skipped: true } };
        const result = await this.review.apply(
          tx,
          { workspaceId: principal.workspaceId, brandId: brand.id, userId: principal.userId },
          input.decisions,
        );
        return { stored: result, brand: await this.brands.snapshot(tx, brand.id) };
      }
      case 'about':
      case 'goals': {
        const answers = parseWithSchema(questionStepSchema(step, session.track), body);
        await this.brands.applyProfile(
          tx,
          principal.workspaceId,
          brand.id,
          buildProfilePatch(step, session.track, answers),
        );
        return { stored: answers };
      }
    }
  }

  private inTenant<T>(principal: AuthPrincipal, work: (tx: TenantTx) => Promise<T>): Promise<T> {
    if (!OWNER_ROLES.has(principal.role)) {
      throw new DomainError(ErrorCode.Forbidden, 'Only an owner or admin can set up the workspace', 403);
    }
    return this.prisma.withTenant(principal.workspaceId, work);
  }

  private async ensureSession(
    tx: TenantTx,
    principal: AuthPrincipal,
  ): Promise<{ session: OnboardingSession; brand: BrandSnapshot }> {
    // Serialises first-visit creation so two tabs cannot create two brands.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${principal.workspaceId}))`;

    const workspace = await tx.workspace.findUniqueOrThrow({ where: { id: principal.workspaceId } });
    const brand = await this.brands.ensureInitialBrand(tx, workspace);
    const existing = await tx.onboardingSession.findFirst({
      where: { brandId: brand.id },
      orderBy: { createdAt: 'desc' },
    });
    if (existing) return { session: existing, brand };

    const session = await tx.onboardingSession.create({
      data: {
        workspaceId: principal.workspaceId,
        brandId: brand.id,
        userId: principal.userId,
        track: workspace.accountType,
        currentStep: ONBOARDING_STEPS[0],
      },
    });
    return { session, brand };
  }

  private assertEditable(session: OnboardingSession): void {
    if (session.status === 'completed') {
      throw new DomainError(ErrorCode.Conflict, 'Onboarding is already complete', 409);
    }
  }

  private assertPriorStepsDone(
    session: OnboardingSession,
    step: OnboardingStep,
    steps: readonly OnboardingStep[],
  ): void {
    const done = completedOf(session);
    const prior = steps.slice(0, steps.indexOf(step));
    const missing = prior.filter((s) => !done.includes(s));
    if (missing.length > 0) {
      throw new DomainError(ErrorCode.Conflict, 'Complete the earlier steps first', 409, { missing });
    }
  }
}

function stepsOf(track: OnboardingSession['track'], brand: BrandSnapshot): OnboardingStep[] {
  return onboardingStepsFor(track, Boolean(brand.websiteUrl));
}

function completedOf(session: OnboardingSession): OnboardingStep[] {
  return session.completedSteps.filter((s): s is OnboardingStep =>
    (ONBOARDING_STEPS as readonly string[]).includes(s),
  );
}

function asRecord(value: Prisma.JsonValue): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? { ...value } : {};
}

function toState(session: OnboardingSession, brand: BrandSnapshot): OnboardingState {
  return {
    sessionId: session.id,
    status: session.status,
    track: session.track,
    currentStep: session.status === 'completed' ? null : (session.currentStep as OnboardingStep),
    steps: stepsOf(session.track, brand),
    completedSteps: completedOf(session),
    brand,
    answers: asRecord(session.answers),
    known: brand.known,
  };
}
