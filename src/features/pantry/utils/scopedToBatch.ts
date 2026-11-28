import type {
  PantryActionSharedState,
  UsedBatch,
} from '#features/pantry/types';

/**
 * The stock a use or a waste from one batch reads: what that batch holds, so
 * its cap, what is left and "use all" are the batch's. A converted unit's
 * figure moves in proportion, as conversions are linear.
 */
export const scopedToBatch = (
  shared: PantryActionSharedState,
  batch: UsedBatch,
): PantryActionSharedState => {
  const others = shared.trackingQuantity - batch.quantity;
  return {
    ...shared,
    trackingQuantity: batch.quantity,
    availableInSelectedUnit:
      shared.availableInSelectedUnit != null && shared.trackingQuantity > 0
        ? shared.availableInSelectedUnit *
          (batch.quantity / shared.trackingQuantity)
        : shared.availableInSelectedUnit,
    leftAfter: drawn => shared.leftAfter(drawn + others),
    remainingNetWeight: batch.remainingNetWeight ?? shared.remainingNetWeight,
  };
};
