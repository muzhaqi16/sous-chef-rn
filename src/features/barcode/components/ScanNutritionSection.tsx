import React from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { useTranslation } from '#/i18n';
import { AppPressable } from '#components/atoms/AppPressable';
import { Card } from '#components/atoms/Card';
import { Icon } from '#components/atoms/Icon';
import { Text } from '#components/atoms/Text';
import {
  extractMacroSummary,
  formatCalories,
  formatNutritionValue,
  hasNutritionData,
  type ShownNutritionValues,
} from '#domain/nutrition';
import { barcodeTestIDs } from '#features/barcode/testIDs';

interface ScanNutritionSectionProps {
  nutrition: ShownNutritionValues | undefined;
  /** Opens every nutrient the facts state. */
  onOpenDetails?: () => void;
}

/**
 * The scanned product's calories and macros as one line of text, or its
 * concept's typical ones titled as such; nothing when neither states any.
 * "Details" opens every nutrient.
 */
export const ScanNutritionSection: React.FC<ScanNutritionSectionProps> = ({
  nutrition,
  onOpenDetails,
}) => {
  const { t } = useTranslation();
  const facts = nutrition?.facts ?? null;
  if (!hasNutritionData(facts)) return null;
  const typicalOf = nutrition?.typicalOf;
  const macros = extractMacroSummary(facts);

  const calories =
    macros.calories === null
      ? null
      : macros.servingSize
      ? t('barcode.nutrition.caloriesPer', {
          calories: formatCalories(macros.calories),
          serving: macros.servingSize,
        })
      : t('barcode.nutrition.calories', {
          calories: formatCalories(macros.calories),
        });
  const grams = (amount: number) => formatNutritionValue(amount, '');
  const macroLine = [
    macros.protein === null
      ? null
      : t('barcode.nutrition.protein', { value: grams(macros.protein) }),
    macros.carbs === null
      ? null
      : t('barcode.nutrition.carbs', { value: grams(macros.carbs) }),
    macros.fat === null
      ? null
      : t('barcode.nutrition.fat', { value: grams(macros.fat) }),
  ]
    .filter(part => part !== null)
    // A macro never splits ("46.7 g" / "fat"); the line breaks only at a dot.
    .map(part => part.replace(/ /g, ' '))
    .join(' · ');

  return (
    <Card testID={barcodeTestIDs.productNutrition}>
      <AppPressable
        onPress={onOpenDetails}
        disabled={!onOpenDetails}
        accessibilityRole="button"
        style={styles.summary}
      >
        <View style={styles.summaryText}>
          <Text role="caption" tone="secondary">
            {typicalOf
              ? t('labels.typicalFor', { concept: typicalOf })
              : t('barcode.nutrition.title')}
          </Text>
          {calories ? <Text role="bodyStrong">{calories}</Text> : null}
          {macroLine ? (
            <Text
              role={calories ? 'body' : 'bodyStrong'}
              tone={calories ? 'secondary' : undefined}
            >
              {macroLine}
            </Text>
          ) : null}
        </View>
        {onOpenDetails ? (
          <>
            <Text role="label" tone="accent">
              {t('labels.details')}
            </Text>
            <Icon name="chevron-forward" size={16} tone="primary" />
          </>
        ) : null}
      </AppPressable>
    </Card>
  );
};

const styles = StyleSheet.create(theme => ({
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  summaryText: {
    flex: 1,
    gap: theme.spacing.xs,
  },
}));
