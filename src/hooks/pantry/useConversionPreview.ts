import { useState, useRef, useEffect } from 'react';
import { useConvertQuantityLazyQuery } from '#generated';
import { executeQuery } from '#/utils/compilerSafeWrappers';

interface UseConversionPreviewOptions {
  pantryItemId: string | undefined;
  /** Quantity the user typed (parsed as number) */
  inputQuantity: number | null;
  /** The unit the user selected */
  selectedUnitId: string | undefined;
  selectedUnitSymbol: string;
  /** The item's tracking unit */
  trackingUnitId: string | undefined;
  trackingUnitSymbol: string;
  /** The item's current quantity in tracking units */
  availableInTrackingUnit: number;
  /** Ratio from compatibleUnitsForItem: selectedUnit = trackingUnit * ratio */
  conversionRatio: number | null;
}

interface ConversionPreviewResult {
  /** e.g. "2 tbsp ≈ 29.57 mL" */
  previewText: string | null;
  /** Available quantity expressed in the selected unit */
  availableInSelectedUnit: number | null;
  /** Whether the input preview conversion is loading */
  previewLoading: boolean;
  /** Whether the available quantity conversion is loading */
  availableLoading: boolean;
}

const DEBOUNCE_MS = 500;

/**
 * Generates a stable "request key" for debounce identity.
 * When this key changes, a new debounced conversion fires.
 */
function makePreviewKey(
  shouldShow: boolean,
  inputQuantity: number | null,
  selectedUnitId: string | undefined,
  trackingUnitId: string | undefined,
): string {
  if (!shouldShow) return '';
  return `${inputQuantity}|${selectedUnitId}|${trackingUnitId}`;
}

export function useConversionPreview({
  pantryItemId,
  inputQuantity,
  selectedUnitId,
  selectedUnitSymbol,
  trackingUnitId,
  trackingUnitSymbol,
  availableInTrackingUnit,
  conversionRatio,
}: UseConversionPreviewOptions): ConversionPreviewResult {
  const [previewText, setPreviewText] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [availableInSelectedUnit, setAvailableInSelectedUnit] = useState<
    number | null
  >(null);
  const [availableLoading, setAvailableLoading] = useState(false);

  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [convertQuantity] = useConvertQuantityLazyQuery({
    fetchPolicy: 'network-only',
  });

  const isSameUnit =
    selectedUnitId === trackingUnitId || !selectedUnitId || !trackingUnitId;
  const shouldShowPreview =
    !isSameUnit && inputQuantity != null && inputQuantity > 0;

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

  // Track preview request key to detect when a new conversion is needed (render-time state update)
  const currentKey = makePreviewKey(
    shouldShowPreview,
    inputQuantity,
    selectedUnitId,
    trackingUnitId,
  );
  const [prevKey, setPrevKey] = useState(currentKey);
  if (currentKey !== prevKey) {
    setPrevKey(currentKey);
    if (!shouldShowPreview) {
      // Clearing — no conversion needed
      setPreviewText(null);
      setPreviewLoading(false);
    } else if (conversionRatio != null) {
      // Local computation — instant, no debounce
      const trackingValue = inputQuantity! / conversionRatio;
      const formattedValue = Number.isInteger(trackingValue)
        ? trackingValue.toString()
        : trackingValue.toFixed(2).replace(/\.?0+$/, '');
      setPreviewText(
        `${inputQuantity} ${selectedUnitSymbol} \u2248 ${formattedValue} ${trackingUnitSymbol}`,
      );
      setPreviewLoading(false);
    } else {
      // Mark as loading, effect will debounce the actual fetch
      setPreviewLoading(true);
    }
  }

  // Debounced input preview conversion — network fallback only (skipped when local ratio available)
  useEffect(() => {
    if (!shouldShowPreview || conversionRatio != null) return;

    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    debounceTimer.current = setTimeout(() => {
      executeQuery(
        () =>
          convertQuantity({
            variables: {
              pantryItemId: pantryItemId,
              quantity: inputQuantity!,
              fromUnitId: selectedUnitId!,
              toUnitId: trackingUnitId!,
            },
          }),
        'Error converting preview quantity:',
      ).then(result => {
        const converted = result?.data?.convertQuantity;
        if (converted) {
          const formattedValue = Number.isInteger(converted.value)
            ? converted.value.toString()
            : converted.value.toFixed(2).replace(/\.?0+$/, '');
          setPreviewText(
            `${inputQuantity} ${selectedUnitSymbol} \u2248 ${formattedValue} ${trackingUnitSymbol}`,
          );
        } else {
          setPreviewText(null);
        }
        setPreviewLoading(false);
      });
    }, DEBOUNCE_MS);

    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, [
    shouldShowPreview,
    inputQuantity,
    selectedUnitId,
    trackingUnitId,
    selectedUnitSymbol,
    trackingUnitSymbol,
    pantryItemId,
    convertQuantity,
    conversionRatio,
  ]);

  return {
    previewText,
    availableInSelectedUnit,
    previewLoading,
    availableLoading,
  };
}
