import { useState, useRef, useEffect } from 'react';
import { useLazyQuery } from '@apollo/client/react';
import {
  ConvertQuantityDocument,
  CanConvertDocument,
} from '#operations/item/conversions.generated';
import { errorService } from '#/services/errorService';

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
  /**
   * How sure the server is of this conversion. Below 1 means it assumed a
   * property it does not know — water density, at 0.5 — so the preview says
   * approximate before the amount is recorded. Null when nothing was asked.
   */
  confidence: number | null;
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
  const [confidence, setConfidence] = useState<number | null>(null);

  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [convertQuantity] = useLazyQuery(ConvertQuantityDocument, {
    fetchPolicy: 'network-only',
  });
  // Cache-first: a conversion's certainty is a property of the unit pair, not
  // of the amount, so it does not change as the user types.
  const [checkConversion] = useLazyQuery(CanConvertDocument, {
    fetchPolicy: 'cache-first',
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
      setConfidence(null);
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

  // Certainty rides on the unit pair alone, so it is asked once per pair
  // rather than per keystroke — and asked even when a local ratio makes the
  // preview itself free, since an assumed density is invisible in the number.
  useEffect(() => {
    if (!shouldShowPreview) return;

    let cancelled = false;
    void (async () => {
      let result;
      try {
        result = await checkConversion({
          variables: {
            pantryItemId,
            fromUnitId: selectedUnitId!,
            toUnitId: trackingUnitId!,
          },
        });
      } catch (error) {
        errorService.reportError(error, {
          operation: 'Error checking conversion certainty:',
        });
      }
      if (cancelled) return;
      const availability = result?.data?.canConvert;
      setConfidence(availability?.available ? availability.confidence : null);
    })();

    return () => {
      cancelled = true;
    };
  }, [
    shouldShowPreview,
    pantryItemId,
    selectedUnitId,
    trackingUnitId,
    checkConversion,
  ]);

  // Debounced input preview conversion — network fallback only (skipped when local ratio available)
  useEffect(() => {
    if (!shouldShowPreview || conversionRatio != null) return;

    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    debounceTimer.current = setTimeout(async () => {
      let result: Awaited<ReturnType<typeof convertQuantity>> | undefined;
      try {
        result = await convertQuantity({
          variables: {
            pantryItemId: pantryItemId,
            quantity: inputQuantity!,
            fromUnitId: selectedUnitId!,
            toUnitId: trackingUnitId!,
          },
        });
      } catch (error) {
        // Leaving `result` undefined falls through to the cleared-preview
        // branch below, which also drops the loading flag.
        errorService.reportError(error, {
          operation: 'Error converting preview quantity:',
        });
      }

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
    confidence,
  };
}
