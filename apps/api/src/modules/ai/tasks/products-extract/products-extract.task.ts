import type { LlmPort, LlmUsage } from '@/infra/llm-providers';
import { MAX_OUTPUT_TOKENS } from '../profile-extract/profile-extract.task';
import { packEvidence, type EvidencePage } from '../profile-extract/evidence';
import { PRODUCT_PROMPT_VERSION, PRODUCT_SYSTEM_PROMPT, buildProductPrompt } from './product-prompt';
import { PRODUCT_ANSWER_SCHEMA, PRODUCT_SCHEMA_NAME } from './product-schema';
import { verifyProducts, type AiProduct } from './verify-products';

export interface ProductExtractResult {
  products: AiProduct[];
  usage: LlmUsage;
  promptVersion: string;
}

// Reads product listings from page text, for sites that publish no structured catalogue.
// Only pages that look like product, service or home pages are worth the cost.
export async function extractProducts(
  llm: LlmPort,
  model: string,
  input: { pages: EvidencePage[]; brandName: string },
): Promise<ProductExtractResult | null> {
  const relevant = input.pages.filter((page) => ['product', 'service', 'home'].includes(page.pageType));
  const pack = packEvidence(relevant);
  if (pack.pages.length === 0) return null;

  const response = await llm.generateStructured({
    task: 'products.extract',
    model,
    system: PRODUCT_SYSTEM_PROMPT,
    user: buildProductPrompt({ brandName: input.brandName, pack }),
    schemaName: PRODUCT_SCHEMA_NAME,
    jsonSchema: PRODUCT_ANSWER_SCHEMA,
    maxOutputTokens: MAX_OUTPUT_TOKENS,
  });
  return { products: verifyProducts(response.data, pack), usage: response.usage, promptVersion: PRODUCT_PROMPT_VERSION };
}
