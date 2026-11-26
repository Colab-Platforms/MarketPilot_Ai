export interface BrandSnapshot {
  id: string;
  name: string;
  websiteUrl: string | null;
  city: string | null;
  language: string;
  known: Record<string, string>;
}

export interface BrandBasicsInput {
  name: string;
  websiteUrl?: string;
  city?: string;
  // Left out, the brand keeps its languages (the setup Voice step sets them).
  language?: string;
}

// A profile column value the owner has approved, from their own input or a website scan.
export interface VerifiedField {
  column: string;
  value: string;
  sourceType: 'user_stated' | 'crawled';
  sourceUrl?: string;
  sourceTrust?: number;
}

// Values the owner stated directly. `columns` keys are BrandProfile columns and
// `attributes` keys go into the JSONB map; both come from the contracts question
// registry, never from request input.
export interface ProfilePatch {
  columns: Record<string, unknown>;
  attributes: Record<string, unknown>;
}
