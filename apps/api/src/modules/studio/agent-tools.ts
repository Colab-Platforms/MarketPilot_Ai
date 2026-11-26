import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import {
  BRIEF_MAX_CHARS,
  BRIEF_MIN_CHARS,
  ErrorCode,
  BUTTON_TEXT_MAX_CHARS,
  HEADLINE_MAX_CHARS,
  IMAGE_DESIGNS,
  IMAGE_FORMATS,
  MAX_IMAGE_VARIANTS,
  SUBHEADING_MAX_CHARS,
  imageDesignSchema,
  imageFormatSchema,
  type ImageGeneration,
  type ImageGenerationBlock,
  type ProductItem,
} from '@marketpilot/contracts';
import { DomainError, type AgentToolSource, type AnyTool, type ReadToolDefinition, type ToolContext } from '@/common';
import { PrismaService } from '@/infra/prisma';
import { BrandCatalogueService } from '@/modules/brand';
import { GENERATE_ROLES, ImageGenerationService } from './images/image-generation.service';

const PRODUCT_NAMES_SHOWN = 20;

const generateArgs = z
  .object({
    brief: z
      .string()
      .trim()
      .min(BRIEF_MIN_CHARS)
      .max(BRIEF_MAX_CHARS)
      .describe(
        'What the image should show, in detail: subject, setting, mood, and the post idea it is for. ' +
          'Write it in English even if the owner writes in Hindi.',
      ),
    format: imageFormatSchema
      .default('square')
      .describe(IMAGE_FORMATS.map((f) => `${f.value}: ${f.use}`).join('; ')),
    product: z
      .string()
      .trim()
      .min(1)
      .max(200)
      .nullable()
      .default(null)
      .describe('Name of one of the owner\'s products to show, exactly as in their catalogue. Its real photos are used.'),
    headline: z
      .string()
      .trim()
      .max(HEADLINE_MAX_CHARS)
      .nullable()
      .default(null)
      .describe('The main line of text to print on the image, exactly as it should appear, in any script.'),
    subheading: z
      .string()
      .trim()
      .max(SUBHEADING_MAX_CHARS)
      .nullable()
      .default(null)
      .describe('A shorter supporting line under the headline. Not used for photo-first images.'),
    buttonText: z
      .string()
      .trim()
      .max(BUTTON_TEXT_MAX_CHARS)
      .nullable()
      .default(null)
      .describe('Call to action shown as a button, such as "Shop now". Only for designed ads.'),
    design: imageDesignSchema
      .nullable()
      .default(null)
      .describe(
        `Null to use the brand's saved preference. ${IMAGE_DESIGNS.map((d) => `${d.value}: ${d.hint}`).join('; ')}.`,
      ),
    showLogo: z
      .boolean()
      .nullable()
      .default(null)
      .describe('Null for the default (on unless photo-first). False only if the owner asks for no logo.'),
    variants: z
      .number()
      .int()
      .min(1)
      .max(MAX_IMAGE_VARIANTS)
      .default(1)
      .describe('How many different options to make. Leave at 1 unless the owner asks for options or choices.'),
  })
  .strict();

type GenerateArgs = z.infer<typeof generateArgs>;

function findProduct(products: ProductItem[], name: string): ProductItem | null {
  const wanted = name.toLowerCase();
  return (
    products.find((p) => p.name.toLowerCase() === wanted) ??
    products.find((p) => p.name.toLowerCase().includes(wanted) || wanted.includes(p.name.toLowerCase())) ??
    null
  );
}

// The studio as copilot tools (docs/COPILOT_AGENT.md section 5, kind `generate`): it starts a
// draft job and returns at once. The chat and the Create page both follow the same job.
@Injectable()
export class StudioAgentTools implements AgentToolSource {
  constructor(
    private readonly prisma: PrismaService,
    private readonly catalogue: BrandCatalogueService,
    private readonly images: ImageGenerationService,
  ) {}

  tools(): AnyTool[] {
    const generate: ReadToolDefinition<GenerateArgs, ImageGeneration> = {
      name: 'image.generate',
      domain: 'content',
      kind: 'generate',
      label: 'Starting your images',
      description:
        'Create post images in the brand\'s style, as drafts the owner reviews. Use only when the owner asks ' +
        'for an image, picture, photo, creative or visual. It starts a job that finishes in about a minute; ' +
        'the images appear in the chat and on the Create page by themselves. Not for captions or text-only ideas. ' +
        'For a designed ad, give a headline, a subheading and button text that fit the idea.',
      args: generateArgs,
      roles: GENERATE_ROLES,
      pages: ['/create'],
      run: (ctx, args) => this.start(ctx, args),
      summarize: (g) =>
        g.status === 'failed'
          ? `The images could not be started: ${g.message ?? 'unknown reason'}`
          : `Started creating ${g.variants === 1 ? 'one image' : `${g.variants} different options`}. Not ready yet: ` +
            'tell the owner they will appear below in this chat in about a minute, and also on the Create page. ' +
            'Do not describe them as if you had seen them.',
      render: (g): ImageGenerationBlock => ({
        type: 'image_generation',
        generationId: g.id,
        format: g.format,
        variants: g.variants,
      }),
    };
    return [generate];
  }

  private async start(ctx: ToolContext, args: GenerateArgs): Promise<ImageGeneration> {
    const productId = args.product ? await this.productId(ctx, args.product) : null;
    return this.images.create(
      { workspaceId: ctx.workspaceId, userId: ctx.userId, role: ctx.role },
      {
        brief: args.brief,
        format: args.format,
        productId,
        headline: args.headline || null,
        subheading: args.subheading || null,
        buttonText: args.buttonText || null,
        design: args.design,
        showLogo: args.showLogo,
        variants: args.variants,
      },
      ctx.idempotencyKey,
    );
  }

  private async productId(ctx: ToolContext, name: string): Promise<string> {
    const products = await this.prisma.withTenant(ctx.workspaceId, (tx) => this.catalogue.list(tx, ctx.brandId));
    const match = findProduct(products, name);
    if (match) return match.id;
    const known = products.slice(0, PRODUCT_NAMES_SHOWN).map((p) => p.name).join(', ');
    throw new DomainError(
      ErrorCode.Validation,
      known
        ? `No product called "${name}". Use one of these names exactly, or none: ${known}`
        : 'This business has no products in its catalogue. Call again without a product.',
      400,
    );
  }
}
