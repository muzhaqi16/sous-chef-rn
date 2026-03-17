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
}

interface UseConvertAvailableQuantityResult {
  /** Available quantity expressed in the selected unit (null if same unit or failed) */
  availableInSelectedUnit: number | null;
  /** Whether the conversion is still loading */
  availableLoading: boolean;
}

/**
 * Converts the item's available quantity from tracking units into the selected unit.
 *
 * Uses local `conversionRatio` when available, otherwise falls back to the
 * `convertQuantity` GraphQL query. Extracted from `useConversionPreview` so
 * `PantryActionModal` can share the result with both display and validation.
 */
export function useConvertAvailableQuantity({
  pantryItemId,
  selectedUnitId,
  trackingUnitId,
  availableInTrackingUnit,
  conversionRatio,
}: UseConvertAvailableQuantityOptions): UseConvertAvailableQuantityResult {
  const [availableInSelectedUnit, setAvailableInSelectedUnit] = useState<
    number | null
  >(null);
  const [availableLoading, setAvailableLoading] = useState(false);

  const [convertQuantity] = useConvertQuantityLazyQuery({
    fetchPolicy: 'network-only',
  });

  const isSameUnit =
    selectedUnitId === trackingUnitId || !selectedUnitId || !trackingUnitId;

  // Convert available quantity when selected unit changes (render-time state update)
  const [prevUnitId, setPrevUnitId] = useState(selectedUnitId);
  if (selectedUnitId !== prevUnitId) {
    setPrevUnitId(selectedUnitId);

    if (isSameUnit) {
      setAvailableInSelectedUnit(null);
      setAvailableLoading(false);
    } else if (conversionRatio != null) {
      // Local conversion — instant, no network call
      setAvailableInSelectedUnit(availableInTrackingUnit * conversionRatio);
      setAvailableLoading(false);
    } else {
      // Network fallback
      setAvailableLoading(true);
      queueMicrotask(() => {
        executeQuery(
          () =>
            convertQuantity({
              variables: {
                pantryItemId: pantryItemId,
                quantity: availableInTrackingUnit,
                fromUnitId: trackingUnitId!,
                toUnitId: selectedUnitId!,
              },
            }),
          'Error converting available quantity:',
        ).then(result => {
          const value = result?.data?.convertQuantity?.value ?? null;
          setAvailableInSelectedUnit(value);
          setAvailableLoading(false);
        });
      });
    }
  }

  return {
    availableInSelectedUnit,
    availableLoading,
  };
}
