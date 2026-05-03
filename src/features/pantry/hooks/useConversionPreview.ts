import { useState, useRef, useEffect } from 'react';
import { useLazyQuery } from '@apollo/client/react';
import { ConvertQuantityDocument } from '#operations/item/conversions.generated';
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
  conversionRatio,
}: UseConversionPreviewOptions): ConversionPreviewResult {
  const [previewText, setPreviewText] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [convertedValue, setConvertedValue] = useState<number | null>(null);

  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [convertQuantity] = useLazyQuery(ConvertQuantityDocument, {
    fetchPolicy: 'network-only',
  });

  const isSameUnit =
    selectedUnitId === trackingUnitId || !selectedUnitId || !trackingUnitId;
  const shouldShowPreview =
    !isSameUnit && inputQuantity != null && inputQuantity > 0;

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
      setConvertedValue(null);
    } else if (conversionRatio != null) {
      // Local computation — instant, no debounce
      const trackingValue = inputQuantity! / conversionRatio;
      setConvertedValue(trackingValue);
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
          setConvertedValue(converted.value);
        } else {
          setPreviewText(null);
          setConvertedValue(null);
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
    previewLoading,
    convertedValue,
  };
}
