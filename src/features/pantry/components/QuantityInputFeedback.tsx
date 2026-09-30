import React from 'react';
import { View } from 'react-native';
import { ConversionPreview } from '#features/pantry/components/ConversionPreview';
import { FractionQuickSelect } from '#features/pantry/components/FractionQuickSelect';
import { formatQuantityForDisplay } from '#/utils/formatQuantity';
import { useTranslation } from '#/i18n';
import { commonStyles } from '#/styles/commonStyles';
import { Text } from '#components/atoms/Text';
import type { ShownQuantity } from '#features/pantry/components/modals/PantryActionModal';

interface QuantityInputFeedbackProps {
  /** What is left after the input, as it will read (null = no valid input) */
  remaining: ShownQuantity | null;
  /** What is available, for the "exceeds" message */
  available: ShownQuantity | null;
  /** Unit symbol for quick-select chips (the consumption unit, e.g. "c") */
  consumeUnitSymbol: string;
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
  available,
  isConvertedUnit,
  previewText,
  previewLoading,
  conversionConfidence,
  consumeUnitSymbol,
  commonFractions,
  onFractionSelect,
  selectedFractionValue,
}) => {
  const { t } = useTranslation();
  const showConversion = isConvertedUnit;
  const showRemaining = remaining !== null;

  return (
    <>
      {commonFractions != null && commonFractions.length > 0 ? (
        <FractionQuickSelect
          fractions={commonFractions}
          onSelect={onFractionSelect}
          selectedValue={selectedFractionValue}
          unitSymbol={consumeUnitSymbol}
          displayAsFraction
        />
      ) : null}
      {showRemaining || showConversion ? (
        <View style={commonStyles.bottomSheetInfoRow}>
          {showRemaining ? (
            <Text
              role={remaining.quantity < 0 ? 'error' : 'caption'}
              tone={remaining.quantity < 0 ? 'error' : 'secondary'}
            >
              {remaining.quantity >= 0 || available === null
                ? t('deduction.remainingAfter', {
                    amount: formatQuantityForDisplay(remaining.quantity),
                    unit: remaining.unitSymbol,
                  })
                : t('deduction.exceedsAvailable', {
                    amount: formatQuantityForDisplay(available.quantity),
                    unit: available.unitSymbol,
                  })}
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
