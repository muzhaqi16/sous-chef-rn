import React from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { useTranslation } from '#/i18n';
import { Text } from '#components/atoms/Text';
import { NutritionSummary } from '#features/catalog/ui/NutritionSummary';
import { hasNutritionData, type ShownNutritionValues } from '#domain/nutrition';
import { barcodeTestIDs } from '#features/barcode/testIDs';

interface ScanNutritionSectionProps {
  nutrition: ShownNutritionValues | undefined;
  /** Opens every nutrient the facts state. */
  onOpenDetails?: () => void;
}

/**
 * The scanned product's calories and macros, or its concept's typical ones
 * titled as such; nothing when neither states any.
 */
export const ScanNutritionSection: React.FC<ScanNutritionSectionProps> = ({
  nutrition,
  onOpenDetails,
}) => {
  const { t } = useTranslation();
  const facts = nutrition?.facts ?? null;
  if (!hasNutritionData(facts)) return null;
  const typicalOf = nutrition?.typicalOf;

  return (
    <View style={styles.section} testID={barcodeTestIDs.productNutrition}>
      <Text role="bodyStrong">
        {typicalOf
          ? t('labels.typicalFor', { concept: typicalOf })
          : t('barcode.nutrition.title')}
      </Text>
      <NutritionSummary
        nutritionFacts={facts}
        showHighlights={false}
        onPress={onOpenDetails}
      />
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  section: {
    gap: theme.spacing.sm,
  },
}));
