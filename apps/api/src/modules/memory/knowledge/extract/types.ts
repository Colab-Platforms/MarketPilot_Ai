import type { ScanProfileField, SocialProviderName } from '@marketpilot/contracts';

export interface ProductDraft {
  externalId?: string;
  name: string;
  description?: string;
  priceMinor?: number;
  currency?: string;
  imageUrl?: string;
  url?: string;
  sku?: string;
  category?: string;
  availability?: 'in_stock' | 'out_of_stock' | 'unknown';
}

interface CandidateBase {
  sourceUrl: string;
  // How it was found. Trust is rule-based on the method, never a model's self-rating.
  method: 'json_ld' | 'platform_api' | 'meta_tag' | 'page_link' | 'page_element';
  trust: number;
}

export type CandidateDraft =
  | (CandidateBase & { kind: 'business_profile'; field: ScanProfileField; value: string })
  | (CandidateBase & { kind: 'social_link'; provider: SocialProviderName; url: string })
  | (CandidateBase & { kind: 'product'; product: ProductDraft });

export const TRUST = {
  platformApi: 0.95,
  jsonLd: 0.9,
  pageLink: 0.8,
  // An image the site itself marks as its logo.
  pageElement: 0.75,
  metaTag: 0.7,
  // A favicon is the brand mark, but small and often cropped to an initial.
  siteIcon: 0.5,
} as const;
