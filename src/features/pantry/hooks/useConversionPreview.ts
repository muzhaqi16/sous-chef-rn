import { skipToken, useQuery } from '@apollo/client/react';
import {
  ConvertQuantityDocument,
  CanConvertDocument,
} from '#operations/item/conversions.generated';
import { useDebouncedValue } from '#hooks/utils/useDebouncedValue';
import { useApolloErrorLogger } from '#hooks/apollo/useApolloErrorLogger';
import {
  formatQuantityForDisplay,
  resolveQuantityNotation,
} from '#/utils/formatQuantity';

export interface UseConversionPreviewOptions {
  pantryItemId: string | undefined;
  /** Quantity the user typed (parsed as number) */
  inputQuantity: number | null;
  /** The unit the user selected */
  selectedUnitId: string | undefined;
  selectedUnitSymbol: string;
  /** Null when the unit's notation is unknown; a fraction then wins. */
  selectedDisplayAsFraction?: boolean | null;
  /** The item's tracking unit */
  trackingUnitId: string | undefined;
  trackingUnitSymbol: string;
  trackingDisplayAsFraction?: boolean | null;
  /** Conversion ratio: selectedUnit = trackingUnit * ratio */
  conversionRatio: number | null;
}

interface ConversionPreviewResult {
  /** e.g. "2 tbsp ≈ 29.57 mL" */
  previewText: string | null;
  /** Whether the input preview conversion is loading */
  previewLoading: boolean;
  /** Raw input quantity converted to tracking/net-weight units (from API or local ratio) */
  convertedValue: number | null;
  /**
   * How sure the server is of this conversion. Below 1 means it assumed a
   * property it does not know — water density, at 0.5 — so the preview says
   * approximate before the amount is recorded. Null when nothing was asked.
   */
  confidence: number | null;
}

const DEBOUNCE_MS = 500;

/** One side of "1 1/4 cup ≈ 295.74 mL", in its own unit's notation. */
const formatSide = (
  quantity: number,
  symbol: string,
  displayAsFraction: boolean | null | undefined,
): string =>
  `${formatQuantityForDisplay(quantity, {
    notation: resolveQuantityNotation(null, displayAsFraction),
  })} ${symbol}`;

export function useConversionPreview({
  pantryItemId,
  inputQuantity,
  selectedUnitId,
  selectedUnitSymbol,
  selectedDisplayAsFraction,
  trackingUnitId,
  trackingUnitSymbol,
  trackingDisplayAsFraction,
  conversionRatio,
}: UseConversionPreviewOptions): ConversionPreviewResult {
  const unitPair =
    selectedUnitId &&
    trackingUnitId &&
    selectedUnitId !== trackingUnitId &&
    inputQuantity != null &&
    inputQuantity > 0
      ? {
          pantryItemId,
          fromUnitId: selectedUnitId,
          toUnitId: trackingUnitId,
          quantity: inputQuantity,
        }
      : null;

  // Certainty rides on the unit pair alone, so it is asked once per pair
  // rather than per keystroke — and asked even when a local ratio makes the
  // preview itself free, since an assumed density is invisible in the number.
  const { data: certaintyData, error: certaintyError } = useQuery(
    CanConvertDocument,
    unitPair
      ? {
          variables: {
            pantryItemId,
            fromUnitId: unitPair.fromUnitId,
            toUnitId: unitPair.toUnitId,
          },
          fetchPolicy: 'cache-first',
          refetchOn: false,
        }
      : skipToken,
  );

  // The server converts only without a local ratio, and only once the input
  // has held still; a key still debouncing asks nothing.
  const serverRequest = unitPair && conversionRatio == null ? unitPair : null;
  const requestKey = serverRequest
    ? `${serverRequest.quantity}|${serverRequest.fromUnitId}|${serverRequest.toUnitId}`
    : null;
  const settledKey = useDebouncedValue(requestKey, DEBOUNCE_MS);
  const settledRequest = requestKey === settledKey ? serverRequest : null;

  const {
    data: convertData,
    loading: converting,
    error: convertError,
  } = useQuery(
    ConvertQuantityDocument,
    settledRequest
      ? {
          variables: settledRequest,
          fetchPolicy: 'network-only',
          refetchOn: false,
        }
      : skipToken,
  );

  useApolloErrorLogger(CanConvertDocument, certaintyError);
  useApolloErrorLogger(ConvertQuantityDocument, convertError);

  const availability = certaintyData?.canConvert;
  const confidence =
    unitPair && availability?.available ? availability.confidence : null;

  let convertedValue: number | null = null;
  let previewLoading = false;
  if (unitPair && conversionRatio != null) {
    convertedValue = unitPair.quantity / conversionRatio;
  } else if (serverRequest) {
    previewLoading = !settledRequest || converting;
    convertedValue = previewLoading
      ? null
      : convertData?.convertQuantity?.value ?? null;
  }

  const previewText =
    unitPair && convertedValue != null
      ? `${formatSide(
          unitPair.quantity,
          selectedUnitSymbol,
          selectedDisplayAsFraction,
        )} \u2248 ${formatSide(
          convertedValue,
          trackingUnitSymbol,
          trackingDisplayAsFraction,
        )}`
      : null;

  return {
    previewText,
    previewLoading,
    convertedValue,
    confidence,
  };
}
