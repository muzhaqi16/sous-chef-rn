import { useState } from 'react';
import { useConvertQuantityLazyQuery } from '#generated';
import { executeQuery } from '#/utils/compilerSafeWrappers';

interface UseConvertAvailableQuantityOptions {
  pantryItemId: string | undefined;
  /** The unit the user selected */
  selectedUnitId: string | undefined;
  /** The item's tracking unit */
  trackingUnitId: string | undefined;
  /** The item's current quantity in tracking units */
  availableInTrackingUnit: number;
  /** Conversion ratio: selectedUnit = trackingUnit * ratio */
  conversionRatio: number | null;
  /** For dual-tracked items: remaining quantity in the net weight unit */
  remainingNetWeight?: number | null;
  /** For dual-tracked items: the net weight unit ID */
  netWeightUnitId?: string;
}

interface UseConvertAvailableQuantityResult {
  /** Available quantity expressed in the selected unit (null if same unit or failed) */
  availableInSelectedUnit: number | null;
  /** Whether the conversion is still loading */
  availableLoading: boolean;
}

/**
 * Converts the item's available quantity into the selected unit.
 *
 * For dual-tracked items, converts from `remainingNetWeight` (accurate).
 * For simple items, uses local `conversionRatio` when available,
 * otherwise falls back to the `convertQuantity` API.
 */
export function useConvertAvailableQuantity({
  pantryItemId,
  selectedUnitId,
  trackingUnitId,
  availableInTrackingUnit,
  conversionRatio,
  remainingNetWeight,
  netWeightUnitId,
}: UseConvertAvailableQuantityOptions): UseConvertAvailableQuantityResult {
  const [availableInSelectedUnit, setAvailableInSelectedUnit] = useState<
    number | null
  >(null);
  const [availableLoading, setAvailableLoading] = useState(false);

  const [convertQuantity] = useConvertQuantityLazyQuery({
    fetchPolicy: 'network-only',
  });

  // For dual-tracked items, the authoritative remaining is in net weight units
  const isDualTracked = remainingNetWeight != null && netWeightUnitId != null;
  const fromUnitId = isDualTracked ? netWeightUnitId : trackingUnitId;
  const fromQuantity = isDualTracked
    ? remainingNetWeight!
    : availableInTrackingUnit;
  const isSameUnit =
    selectedUnitId === fromUnitId || !selectedUnitId || !fromUnitId;

  // Re-convert when selected unit changes (render-time state update)
  const [prevUnitId, setPrevUnitId] = useState(selectedUnitId);
  if (selectedUnitId !== prevUnitId) {
    setPrevUnitId(selectedUnitId);

    if (isSameUnit) {
      setAvailableInSelectedUnit(null);
      setAvailableLoading(false);
    } else if (conversionRatio != null && !isDualTracked) {
      // Local ratio (tracking→selected) — only for non-dual-tracked items
      setAvailableInSelectedUnit(availableInTrackingUnit * conversionRatio);
      setAvailableLoading(false);
    } else {
      // Let the API handle the conversion
      setAvailableLoading(true);
      queueMicrotask(() => {
        executeQuery(
          () =>
            convertQuantity({
              variables: {
                pantryItemId,
                quantity: fromQuantity,
                fromUnitId: fromUnitId!,
                toUnitId: selectedUnitId!,
              },
            }),
          'Error converting available quantity:',
        ).then(result => {
          setAvailableInSelectedUnit(
            result?.data?.convertQuantity?.value ?? null,
          );
          setAvailableLoading(false);
        });
      });
    }
  }

  // When selected unit matches the source, return the quantity directly
  if (isSameUnit && isDualTracked) {
    return { availableInSelectedUnit: fromQuantity, availableLoading: false };
  }

  return {
    availableInSelectedUnit,
    availableLoading,
  };
}
