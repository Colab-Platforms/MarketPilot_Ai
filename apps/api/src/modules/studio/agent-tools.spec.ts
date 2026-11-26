import type { ImageGeneration, ProductItem } from '@marketpilot/contracts';
import type { ReadToolDefinition, ToolContext } from '@/common';
import type { PrismaService } from '@/infra/prisma';
import type { BrandCatalogueService } from '@/modules/brand';
import { ToolRegistry } from '../agents/runtime/tool-registry';
import { StudioAgentTools } from './agent-tools';
import type { ImageGenerationService } from './images/image-generation.service';

const product = (id: string, name: string): ProductItem => ({
  id,
  name,
  description: null,
  category: null,
  priceMinor: null,
  currency: 'INR',
  availability: 'unknown',
  url: null,
  imageUrl: null,
  imageUrls: [],
  featured: false,
  source: 'owner',
});

const started: ImageGeneration = {
  id: '0193a000-0000-7000-8000-000000000001',
  status: 'queued',
  brief: 'x',
  format: 'portrait',
  productId: null,
  productName: null,
  headline: null,
  subheading: null,
  buttonText: null,
  design: 'designed',
  showLogo: true,
  variants: 2,
  images: [],
  message: null,
  createdAt: new Date(0).toISOString(),
  finishedAt: null,
};

const ctx: ToolContext = {
  workspaceId: 'w1',
  brandId: 'b1',
  userId: 'u1',
  role: 'owner',
  runId: 'r1',
  idempotencyKey: 'a'.repeat(64),
  signal: new AbortController().signal,
};

function setup(products: ProductItem[]) {
  const create = jest.fn().mockResolvedValue(started);
  const prisma = { withTenant: (_w: string, work: (tx: unknown) => unknown) => work({}) } as unknown as PrismaService;
  const catalogue = { list: jest.fn().mockResolvedValue(products) } as unknown as BrandCatalogueService;
  const source = new StudioAgentTools(prisma, catalogue, { create } as unknown as ImageGenerationService);
  const tool = source.tools()[0] as ReadToolDefinition<unknown, ImageGeneration>;
  return { source, tool, create };
}

describe('image.generate tool', () => {
  it('registers with a schema the model can use', () => {
    const { source } = setup([]);
    const registry = new ToolRegistry([source]);
    expect(registry.get('image.generate')?.kind).toBe('generate');
    expect(registry.forRole('analyst').map((t) => t.name)).not.toContain('image.generate');
  });

  it('resolves a product by name and passes the run key through', async () => {
    const { tool, create } = setup([product('p1', 'Skin, Hair & Nail Gummies'), product('p2', 'Dreamy Sleep Gummies')]);
    const args = tool.args.parse({ brief: 'A calm bedtime scene with the gummies pack', format: 'portrait', product: 'dreamy sleep gummies' });
    await tool.run(ctx, args);
    expect(create).toHaveBeenCalledWith(
      { workspaceId: 'w1', userId: 'u1', role: 'owner' },
      {
        brief: 'A calm bedtime scene with the gummies pack',
        format: 'portrait',
        productId: 'p2',
        headline: null,
        subheading: null,
        buttonText: null,
        design: null,
        showLogo: null,
        variants: 1,
      },
      ctx.idempotencyKey,
    );
  });

  it('tells the model the real product names when the name does not match', async () => {
    const { tool, create } = setup([product('p1', 'Dreamy Sleep Gummies')]);
    const args = tool.args.parse({ brief: 'A bright morning scene', product: 'Vitamin C serum' });
    await expect(tool.run(ctx, args)).rejects.toThrow('Dreamy Sleep Gummies');
    expect(create).not.toHaveBeenCalled();
  });

  it('shows the job in chat and tells the model it is not ready yet', () => {
    const { tool } = setup([]);
    expect(tool.render?.(started)).toEqual({ type: 'image_generation', generationId: started.id, format: 'portrait', variants: 2 });
    expect(tool.summarize(started)).toContain('2 different options. Not ready yet');
  });
});
