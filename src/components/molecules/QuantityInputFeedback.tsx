import React from 'react';
import { View, Text } from 'react-native';
import { ConversionPreview } from '#components/atoms/ConversionPreview';
import { FractionQuickSelect } from '#components/atoms/FractionQuickSelect';
import { formatQuantity } from '#/utils/formatQuantity';
import { commonStyles } from '#/styles/commonStyles';

interface QuantityInputFeedbackProps {
  /** Remaining quantity after subtracting user input (null = no valid input) */
  remaining: number | null;
  /** Available quantity in the active unit (for the "exceeds" message) */
  availableInUnit: number | null;
  /** Unit symbol for remaining display (e.g. "g" for dual-tracked, or same as consumeUnitSymbol) */
  activeUnitSymbol: string;
  /** Unit symbol for quick-select chips (the consumption unit, e.g. "c") */
  consumeUnitSymbol?: string;
  /** Whether a converted (non-tracking) unit is selected */
  isConvertedUnit: boolean;
  /** Conversion preview text (e.g. "0.25 c ≈ 0.03 bag") */
  previewText: string | null;
  /** Whether the conversion preview is loading */
  previewLoading: boolean;
  /** Conversion confidence (for approx label) */
  conversionConfidence: number | null;
  /** Quick-select fraction values */
  commonFractions: number[] | null;
  /** Called when a quick-select chip is pressed */
  onFractionSelect: (value: number) => void;
  /** Currently selected fraction value (highlights the chip) */
  selectedFractionValue?: number;
}

/**
 * Shows conversion preview + remaining quantity on one row,
 * followed by quick-select fraction chips.
 *
 * Used below FractionInput in consume / waste modals.
 */
export const QuantityInputFeedback: React.FC<QuantityInputFeedbackProps> = ({
  remaining,
  availableInUnit,
  activeUnitSymbol,
  isConvertedUnit,
  previewText,
  previewLoading,
  conversionConfidence,
  consumeUnitSymbol,
  commonFractions,
  onFractionSelect,
  selectedFractionValue,
}) => {
  const showConversion = isConvertedUnit;
  const showRemaining = remaining !== null;
  const chipUnitSymbol = consumeUnitSymbol ?? activeUnitSymbol;

  return (
    <>
      {commonFractions != null && commonFractions.length > 0 ? (
        <FractionQuickSelect
          fractions={commonFractions}
          onSelect={onFractionSelect}
          selectedValue={selectedFractionValue}
          unitSymbol={chipUnitSymbol}
          displayAsFraction
        />
      ) : null}
      {showRemaining || showConversion ? (
        <View style={commonStyles.bottomSheetInfoRow}>
          {showRemaining ? (
            <Text
              style={[
                commonStyles.bottomSheetHelperText,
                { marginTop: 0 },
                remaining < 0 && commonStyles.bottomSheetHelperTextError,
              ]}
            >
              {remaining >= 0
                ? `Remaining: ${formatQuantity(remaining)} ${activeUnitSymbol}`
                : `Exceeds available (${formatQuantity(
                    availableInUnit!,
                  )} ${activeUnitSymbol})`}
            </Text>
          ) : null}
          {showConversion ? (
            <ConversionPreview
              previewText={previewText}
              loading={previewLoading}
              confidence={conversionConfidence}
            />
          ) : null}
        </View>
      ) : null}
    </>
  );
};
