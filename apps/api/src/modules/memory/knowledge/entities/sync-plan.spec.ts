import type { EntityDocument } from './entity-documents';
import { planEntitySync, type ExistingEntityChunk } from './sync-plan';

const doc = (id: string, text: string, entityType = 'product'): EntityDocument => ({
  entityType,
  entityId: id,
  title: 'T',
  text,
});

const indexed = (id: string, hashOf: EntityDocument, overrides: Partial<ExistingEntityChunk> = {}): ExistingEntityChunk => {
  const first = planEntitySync([], [hashOf]).create[0]!;
  return {
    id: `chunk-${id}`,
    entityType: hashOf.entityType,
    entityId: hashOf.entityId,
    state: 'active',
    version: 1,
    entityHash: first.entityHash,
    ...overrides,
  };
};

describe('planEntitySync', () => {
  it('creates chunks for a new record', () => {
    const plan = planEntitySync([], [doc('a', 'Product: Gummies. Herbal wellness gummies.')]);
    expect(plan.create).toHaveLength(1);
    expect(plan.create[0]).toMatchObject({ entityType: 'product', entityId: 'a', version: 1 });
    expect(plan.supersedeChunkIds).toEqual([]);
  });

  it('does nothing for an unchanged record', () => {
    const d = doc('a', 'Product: Gummies');
    expect(planEntitySync([indexed('a', d)], [d])).toEqual({ supersedeChunkIds: [], deleteChunkIds: [], create: [] });
  });

  it('replaces a changed record under a new version', () => {
    const before = doc('a', 'Product: Gummies');
    const plan = planEntitySync([indexed('a', before)], [doc('a', 'Product: Gummies. Now sugar free.')]);
    expect(plan.supersedeChunkIds).toEqual(['chunk-a']);
    expect(plan.create[0]).toMatchObject({ version: 2 });
  });

  it('keeps climbing versions past superseded chunks', () => {
    const d = doc('a', 'Product: Gummies v3');
    const old = indexed('a', doc('a', 'old'), { id: 'old', state: 'superseded', version: 4 });
    expect(planEntitySync([old], [d]).create[0]).toMatchObject({ version: 5 });
  });

  it('stops serving a record that is no longer approved', () => {
    const d = doc('gone', 'Product: Old');
    const plan = planEntitySync([indexed('gone', d)], []);
    expect(plan.deleteChunkIds).toEqual(['chunk-gone']);
    expect(plan.create).toEqual([]);
  });

  it('gives identical text on two records its own chunk each', () => {
    const plan = planEntitySync([], [doc('a', 'Same text'), doc('b', 'Same text')]);
    expect(new Set(plan.create.map((c) => c.contentHash)).size).toBe(2);
  });
});
