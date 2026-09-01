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
