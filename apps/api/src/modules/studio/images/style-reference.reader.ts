import { Injectable } from '@nestjs/common';
import { imageDesignSchema, type ImageDesign } from '@marketpilot/contracts';
import type { TenantTx } from '@/infra/prisma';
import { AssetFeedbackService } from '@/modules/assets';
import { pickStyleReferences, type GeneratedTraits } from './style-references';

// Loads the owner's stars and likes and picks the images a new image should follow.
@Injectable()
export class StyleReferenceReader {
  constructor(private readonly feedback: AssetFeedbackService) {}

  async pick(
    tx: TenantTx,
    brandId: string,
    recentPostUrls: string[],
    target: { design: ImageDesign; productId: string | null },
  ): Promise<string[]> {
    const candidates = await this.feedback.styleCandidates(tx, brandId);
    const outputIds = [...candidates.starred, ...candidates.liked].flatMap((c) => (c.studioOutputId ? [c.studioOutputId] : []));
    const traits = await this.traitsOf(tx, outputIds);
    return pickStyleReferences({ candidates, recentPostUrls, traits, target });
  }

  // The design and product each past generated image was made with, from its studio job.
  private async traitsOf(tx: TenantTx, outputIds: string[]): Promise<Map<string, GeneratedTraits>> {
    if (outputIds.length === 0) return new Map();
    const outputs = await tx.studioOutput.findMany({
      where: { id: { in: outputIds } },
      select: { id: true, generation: { select: { input: true, productId: true } } },
    });
    return new Map(
      outputs.map((o) => {
        const design = imageDesignSchema.safeParse((o.generation.input as { design?: unknown } | null)?.design);
        return [o.id, { design: design.success ? design.data : null, productId: o.generation.productId }];
      }),
    );
  }
}
