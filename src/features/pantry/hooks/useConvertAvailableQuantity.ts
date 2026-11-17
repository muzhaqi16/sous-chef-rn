import { skipToken, useQuery } from '@apollo/client/react';
import { ConvertQuantityDocument } from '#operations/item/conversions.generated';
import { useApolloErrorLogger } from '#hooks/apollo/useApolloErrorLogger';

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

/** Only amounts expressed in the selected unit are usable as a deduction cap. */
export function useConvertAvailableQuantity({
  pantryItemId,
  selectedUnitId,
  trackingUnitId,
  availableInTrackingUnit,
  conversionRatio,
  remainingNetWeight,
  netWeightUnitId,
}: UseConvertAvailableQuantityOptions) {
  const dual = remainingNetWeight != null && netWeightUnitId != null;
  const fromUnitId = dual ? netWeightUnitId : trackingUnitId;
  const fromQuantity = dual ? remainingNetWeight : availableInTrackingUnit;
  const same = !!selectedUnitId && selectedUnitId === fromUnitId;
  const local = same
    ? fromQuantity
    : !dual && conversionRatio != null
    ? availableInTrackingUnit * conversionRatio
    : null;
  const request =
    local === null && pantryItemId && selectedUnitId && fromUnitId
      ? {
          pantryItemId,
          quantity: fromQuantity,
          fromUnitId,
          toUnitId: selectedUnitId,
        }
      : null;
  const { data, loading, error } = useQuery(
    ConvertQuantityDocument,
    request
      ? { variables: request, fetchPolicy: 'network-only', refetchOn: false }
      : skipToken,
  );
  useApolloErrorLogger(ConvertQuantityDocument, error);
  return {
    availableInSelectedUnit:
      local ?? (request ? data?.convertQuantity?.value ?? null : null),
    availableLoading: !!request && loading,
    conversionUnavailable:
      !!request && !loading && !error && data?.convertQuantity === null,
  };
}
