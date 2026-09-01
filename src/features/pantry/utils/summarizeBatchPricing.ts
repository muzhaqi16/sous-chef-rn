import { BatchStatus } from '#/graphql/generated/schemaTypes';
import type { PantryItemBatchFragment } from '#features/pantry/graphql/pantryFragments.generated';

/** What the batches say ABOUT the item's own money fields, never a substitute. */
export interface BatchPricingSummary {
  /** Several priced batches back the rate, so it is a blend, not a price paid. */
  isAveraged: boolean;
  /**
   * Some remaining stock has no recorded cost. `PantryItem.totalCost` covers
   * only the priced part while `costPerUnit` spreads it over ALL units, so the
   * rate reads below anything actually paid — don't show it as a price.
   */
  isRateDiluted: boolean;
  /** The newest priced batch: what the last acquisition cost, and when. */
  lastPurchase: { date: string; totalCost: number | null } | null;
}

/**
 * `PantryItem.costPerUnit`/`totalCost` are the server's, derived from these same
 * batches — read them rather than re-deriving, since `unitCostBasis` prices a
 * weight-tracked stack off `remainingNetWeight` rather than quantity.
 */
export function summarizeBatchPricing(
  batches: readonly PantryItemBatchFragment[],
): BatchPricingSummary {
  const active = batches.filter(b => b.status === BatchStatus.Active);
  const priced = active.filter(b => b.costPerUnit != null && b.costPerUnit > 0);

  const newest =
    priced.length > 0
      ? priced.reduce((latest, b) =>
          b.createdAt > latest.createdAt ? b : latest,
        )
      : null;

  return {
    isAveraged: priced.length > 1,
    isRateDiluted: priced.length > 0 && priced.length < active.length,
    lastPurchase: newest
      ? { date: newest.createdAt, totalCost: newest.totalCost ?? null }
      : null,
  };
}
