import React from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { useTranslation } from '#/i18n';
import { Text } from '#components/atoms/Text';
import { NutritionSummary } from '#features/catalog/ui/NutritionSummary';
import { hasNutritionData, type NutritionFactsValues } from '#domain/nutrition';
import { barcodeTestIDs } from '#features/barcode/testIDs';

interface ScanNutritionSectionProps {
  nutritionFacts: NutritionFactsValues | undefined;
  /** Opens every nutrient the facts state. */
  onOpenDetails?: () => void;
}

/** The scanned product's calories and macros; nothing when no source states any. */
export const ScanNutritionSection: React.FC<ScanNutritionSectionProps> = ({
  nutritionFacts,
  onOpenDetails,
}) => {
  const { t } = useTranslation();
  const facts = nutritionFacts ?? null;
  if (!hasNutritionData(facts)) return null;

  return (
    <View style={styles.section} testID={barcodeTestIDs.productNutrition}>
      <Text role="bodyStrong">{t('barcode.nutrition.title')}</Text>
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
