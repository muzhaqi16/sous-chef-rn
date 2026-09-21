import React from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import type { StaticScreenProps } from '@react-navigation/native';
import { NutritionSummary } from '#features/catalog/ui/NutritionSummary';
import { NutritionDetailList } from '#features/pantry/components/NutritionDetailList';
import { SubScreen } from '#components/templates/SubScreen';
import type { NutritionFactsValues } from '#domain/nutrition';

type NutritionScreenParams = {
  itemId: string;
  itemName: string;
  nutritionFacts: NutritionFactsValues;
};

export const NutritionScreen: React.FC<
  StaticScreenProps<NutritionScreenParams>
> = ({ route }) => {
  const { itemName, nutritionFacts } = route.params;

  return (
    <SubScreen title={itemName}>
      <View style={styles.content}>
        {/* Macro Summary at top (without navigation) */}
        <View style={styles.section}>
          <NutritionSummary nutritionFacts={nutritionFacts} showHighlights />
        </View>

        {/* Full nutrition list */}
        <View style={styles.section}>
          <NutritionDetailList nutritionFacts={nutritionFacts} />
        </View>
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
