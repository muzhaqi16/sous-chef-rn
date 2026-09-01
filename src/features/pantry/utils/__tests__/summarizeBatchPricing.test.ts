import { BatchStatus } from '#/graphql/generated/schemaTypes';
import type { PantryItemBatchFragment } from '#features/pantry/graphql/pantryFragments.generated';
import { summarizeBatchPricing } from '#features/pantry/utils/summarizeBatchPricing';

const batch = (
  overrides: Partial<PantryItemBatchFragment> & { id: string },
): PantryItemBatchFragment =>
  ({
    __typename: 'PantryItemBatch',
    batchNumber: 1,
    quantity: 1,
    status: BatchStatus.Active,
    expiresAt: null,
    expiresAtIsManual: false,
    costPerUnit: null,
    totalCost: null,
    notes: null,
    isOpened: false,
    openedAt: null,
    depletedAt: null,
    remainingNetWeight: null,
    createdAt: '2026-08-01T00:00:00Z',
    updatedAt: '2026-08-01T00:00:00Z',
    wasteReason: null,
    pantryItemId: 'pi1',
    store: null,
    ...overrides,
  } as PantryItemBatchFragment);

describe('summarizeBatchPricing', () => {
  it('calls the rate an average once two priced batches back it', () => {
    const summary = summarizeBatchPricing([
      batch({ id: 'b1', quantity: 5, costPerUnit: 0.59 }),
      batch({ id: 'b2', quantity: 3, costPerUnit: 1 }),
    ]);

    expect(summary.isAveraged).toBe(true);
    expect(summary.isRateDiluted).toBe(false);
  });

  it('does not call a single priced batch an average', () => {
    expect(
      summarizeBatchPricing([
        batch({ id: 'b1', quantity: 5, costPerUnit: 0.59 }),
      ]).isAveraged,
    ).toBe(false);
  });

  it('flags a rate diluted by stock that cost nothing on record', () => {
    // The server's totalCost covers only the priced batch, but its costPerUnit
    // spreads that over all 8 units — below anything actually paid.
    const summary = summarizeBatchPricing([
      batch({ id: 'paid', quantity: 5, costPerUnit: 0.59 }),
      batch({ id: 'gifted', quantity: 3, costPerUnit: null }),
    ]);

    expect(summary.isRateDiluted).toBe(true);
  });

  it('does not flag dilution when nothing is priced at all', () => {
    // Then the server reports null and there is no rate to mislead with.
    const summary = summarizeBatchPricing([
      batch({ id: 'b1', quantity: 5, costPerUnit: null }),
    ]);

    expect(summary.isRateDiluted).toBe(false);
    expect(summary.lastPurchase).toBeNull();
  });

  it('ignores batches that are no longer active', () => {
    const summary = summarizeBatchPricing([
      batch({ id: 'b1', quantity: 5, costPerUnit: 0.59 }),
      batch({
        id: 'b2',
        quantity: 3,
        costPerUnit: 1,
        status: BatchStatus.Merged,
      }),
      batch({
        id: 'b3',
        quantity: 2,
        costPerUnit: 9,
        status: BatchStatus.Depleted,
      }),
    ]);

    expect(summary.isAveraged).toBe(false);
    expect(summary.isRateDiluted).toBe(false);
  });

  it('names the newest priced batch as the last purchase', () => {
    // `PantryItem.purchase` is the FIRST acquisition, so the batch is the only
    // place a restock's cost is recorded.
    const summary = summarizeBatchPricing([
      batch({
        id: 'b1',
        costPerUnit: 0.59,
        totalCost: 2.95,
        createdAt: '2026-08-01T00:00:00Z',
      }),
      batch({
        id: 'b2',
        costPerUnit: 1,
        totalCost: 3,
        createdAt: '2026-08-31T00:00:00Z',
      }),
    ]);

    expect(summary.lastPurchase).toEqual({
      date: '2026-08-31T00:00:00Z',
      totalCost: 3,
    });
  });

  it('reports nothing for an item with no batches', () => {
    expect(summarizeBatchPricing([])).toEqual({
      isAveraged: false,
      isRateDiluted: false,
      lastPurchase: null,
    });
  });
});

describe('a batch recorded at zero cost', () => {
  // `costPerUnit` is a nullable Float, so 0.00 is a recordable price — a gift or
  // a sample. Treating it as UNPRICED makes a fully-known set look partial.
  it('counts as priced, not as unknown', () => {
    const summary = summarizeBatchPricing([
      batch({ id: 'b1', quantity: 5, costPerUnit: 2 }),
      batch({ id: 'b2', quantity: 1, costPerUnit: 0 }),
    ]);

    expect(summary.isRateDiluted).toBe(false);
  });

  it('still dilutes when a batch has no recorded cost at all', () => {
    const summary = summarizeBatchPricing([
      batch({ id: 'b1', quantity: 5, costPerUnit: 2 }),
      batch({ id: 'b2', quantity: 1, costPerUnit: null }),
    ]);

    expect(summary.isRateDiluted).toBe(true);
  });
});

describe('which acquisition is the newest', () => {
  it('compares timestamps as instants, not as text', () => {
    // Same moment, two ISO spellings the API may both emit. Lexicographically
    // '.' (0x2E) sorts below 'Z' (0x5A), so the millisecond form loses.
    const summary = summarizeBatchPricing([
      batch({
        id: 'older',
        costPerUnit: 1,
        totalCost: 10,
        createdAt: '2026-08-20T00:00:00Z',
      }),
      batch({
        id: 'newer',
        costPerUnit: 2,
        totalCost: 99,
        createdAt: '2026-08-20T00:00:00.500Z',
      }),
    ]);

    expect(summary.lastPurchase?.totalCost).toBe(99);
  });

  it('does not move backwards when the newest batch is consumed', () => {
    // A summary that walks back to an older acquisition reports a purchase that
    // did not happen — an earlier date and a smaller total than a moment ago.
    const older = batch({
      id: 'older',
      costPerUnit: 1,
      totalCost: 10,
      createdAt: '2026-08-01T00:00:00Z',
    });
    const newest = batch({
      id: 'newest',
      costPerUnit: 2,
      totalCost: 40,
      createdAt: '2026-08-28T00:00:00Z',
    });

    const before = summarizeBatchPricing([older, newest]);
    const after = summarizeBatchPricing([
      older,
      { ...newest, status: BatchStatus.Depleted },
    ]);

    expect(after.lastPurchase?.date).toBe(before.lastPurchase?.date);
    expect(after.lastPurchase?.totalCost).toBe(before.lastPurchase?.totalCost);
  });
});
