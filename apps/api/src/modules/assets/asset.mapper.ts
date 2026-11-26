import type { AssetFeedback as FeedbackRow, Asset as AssetRow } from '@prisma/client';
import { feedbackReasonSchema, type Asset, type AssetFeedback } from '@marketpilot/contracts';

// `feedback` holds at most the viewer's own row.
export type AssetWithFeedback = AssetRow & { feedback?: FeedbackRow[] };

export function toFeedback(row: FeedbackRow | undefined): AssetFeedback | null {
  if (!row) return null;
  const reasons = row.reasons.flatMap((r) => {
    const parsed = feedbackReasonSchema.safeParse(r);
    return parsed.success ? [parsed.data] : [];
  });
  return { rating: row.rating, reasons };
}

export function toAsset(row: AssetWithFeedback): Asset {
  return {
    id: row.id,
    kind: row.kind,
    source: row.source,
    url: row.url,
    name: row.name,
    width: row.width,
    height: row.height,
    bytes: row.bytes,
    durationSeconds: row.durationSeconds,
    createdAt: row.createdAt.toISOString(),
    styleReference: row.styleReferenceAt !== null,
    feedback: toFeedback(row.feedback?.[0]),
  };
}

export interface AssetCursor {
  createdAt: Date;
  id: string;
}

// Newest first, with the id breaking ties between rows made in the same millisecond.
export function encodeCursor(row: AssetCursor): string {
  return Buffer.from(`${row.createdAt.toISOString()}|${row.id}`).toString('base64url');
}

export function decodeCursor(raw: string): AssetCursor | null {
  const [iso, id] = Buffer.from(raw, 'base64url').toString('utf8').split('|');
  if (!iso || !id) return null;
  const createdAt = new Date(iso);
  return Number.isNaN(createdAt.getTime()) ? null : { createdAt, id };
}
