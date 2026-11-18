import { createHash } from 'node:crypto';
import { chunkText } from '../chunker';
import type { EntityDocument } from './entity-documents';

export interface ExistingEntityChunk {
  id: string;
  entityType: string;
  entityId: string;
  state: 'active' | 'superseded' | 'deleted';
  version: number;
  entityHash: string | null;
}

export interface NewEntityChunk {
  entityType: string;
  entityId: string;
  ordinal: number;
  content: string;
  contentHash: string;
  tokenCount: number;
  version: number;
  entityHash: string;
  title: string;
}

export interface SyncPlan {
  supersedeChunkIds: string[];
  deleteChunkIds: string[];
  create: NewEntityChunk[];
}

const sha256 = (text: string) => createHash('sha256').update(text).digest('hex');
const keyOf = (entityType: string, entityId: string) => `${entityType}:${entityId}`;

// Compares what should be searchable now with what is indexed. An unchanged record costs
// nothing (no new chunk, no new embedding); a changed one is replaced under a new version;
// one that is gone or no longer approved stops being searchable.
export function planEntitySync(existing: ExistingEntityChunk[], documents: EntityDocument[]): SyncPlan {
  const byKey = new Map<string, ExistingEntityChunk[]>();
  for (const chunk of existing) {
    const key = keyOf(chunk.entityType, chunk.entityId);
    byKey.set(key, [...(byKey.get(key) ?? []), chunk]);
  }

  const plan: SyncPlan = { supersedeChunkIds: [], deleteChunkIds: [], create: [] };
  const wanted = new Set<string>();

  for (const doc of documents) {
    const key = keyOf(doc.entityType, doc.entityId);
    wanted.add(key);
    const chunks = byKey.get(key) ?? [];
    const active = chunks.filter((c) => c.state === 'active');
    const entityHash = sha256(doc.text);
    if (active.length > 0 && active.every((c) => c.entityHash === entityHash)) continue;

    plan.supersedeChunkIds.push(...active.map((c) => c.id));
    const version = Math.max(0, ...chunks.map((c) => c.version)) + 1;
    for (const chunk of chunkText(doc.text)) {
      plan.create.push({
        entityType: doc.entityType,
        entityId: doc.entityId,
        ordinal: chunk.ordinal,
        content: chunk.content,
        // Includes the entity, so two products with identical text still get their own chunk.
        contentHash: sha256(`${key}:${chunk.ordinal}:${chunk.content}`),
        tokenCount: chunk.tokenCount,
        version,
        entityHash,
        title: doc.title,
      });
    }
  }

  for (const [key, chunks] of byKey) {
    if (wanted.has(key)) continue;
    plan.deleteChunkIds.push(...chunks.filter((c) => c.state === 'active').map((c) => c.id));
  }
  return plan;
}
