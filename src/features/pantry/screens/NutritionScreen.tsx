import React from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import type { StaticScreenProps } from '@react-navigation/native';
import { NutritionSummary } from '#features/catalog/ui/NutritionSummary';
import { NutritionDetailList } from '#features/pantry/components/NutritionDetailList';
import { SubScreen } from '#components/templates/SubScreen';
import { DataAttributionNotices } from '#components/molecules/DataAttributionNotices';
import type { DataAttributionValue } from '#/types/attribution';
import type { NutritionFactsValues } from '#domain/nutrition';
import { useTranslation } from '#/i18n';
import { Text } from '#components/atoms/Text';

type NutritionScreenParams = {
  itemId: string;
  itemName: string;
  nutritionFacts: NutritionFactsValues;
  /** The concept these values are typical of; absent for the item's own. */
  typicalOf?: string | null;
  dataAttributions: readonly DataAttributionValue[];
};

export const NutritionScreen: React.FC<
  StaticScreenProps<NutritionScreenParams>
> = ({ route }) => {
  const { t } = useTranslation();
  const { itemName, nutritionFacts, typicalOf, dataAttributions } =
    route.params;

  return (
    <SubScreen title={itemName}>
      <View style={styles.content}>
        {!!typicalOf && (
          <Text role="bodyStrong" style={styles.section}>
            {t('labels.typicalFor', { concept: typicalOf })}
          </Text>
        )}
        {/* Macro Summary at top (without navigation). Typical values make no
            health claim for the product. */}
        <View style={styles.section}>
          <NutritionSummary
            nutritionFacts={nutritionFacts}
            showHighlights={!typicalOf}
          />
        </View>

        {/* Full nutrition list */}
        <View style={styles.section}>
          <NutritionDetailList nutritionFacts={nutritionFacts} />
        </View>

        {dataAttributions.length > 0 && (
          <View style={styles.section}>
            <DataAttributionNotices attributions={dataAttributions} />
          </View>
        )}
      </View>
    </SubScreen>
  );
};

const styles = StyleSheet.create(theme => ({
  content: {
    paddingTop: theme.spacing.md,
  },
  section: {
    marginBottom: theme.spacing.lg,
  },
}));
