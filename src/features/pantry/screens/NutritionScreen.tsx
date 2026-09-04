import React from 'react';
import { View, ScrollView } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import type { StaticScreenProps } from '@react-navigation/native';
import { NutritionSummary } from '#features/catalog/ui/NutritionSummary';
import { NutritionDetailList } from '#features/pantry/components/NutritionDetailList';
import { useAppNavigation } from '#hooks/navigation/useAppNavigation';
import { Screen } from '#components/templates/Screen';

type NutritionScreenParams = {
  itemId: string;
  itemName: string;
  nutritions: unknown;
  actualServingGrams?: number;
};

export const NutritionScreen: React.FC<
  StaticScreenProps<NutritionScreenParams>
> = ({ route }) => {
  const { goBack } = useAppNavigation();
  const { itemName, nutritions, actualServingGrams } = route.params;

  return (
    <Screen
      header={{ title: itemName, back: goBack, centerTitle: true }}
      scroll="list"
      gutter="none"
    >
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Macro Summary at top (without navigation) */}
        <View style={styles.section}>
          <NutritionSummary
            nutritions={nutritions}
            actualServingGrams={actualServingGrams}
            showHighlights
          />
        </View>

        {/* Full nutrition list */}
        <View style={styles.section}>
          <NutritionDetailList
            nutritions={nutritions}
            actualServingGrams={actualServingGrams}
          />
        </View>
      </ScrollView>
    </Screen>
  );
};

const styles = StyleSheet.create(theme => ({
  scrollView: {
    flex: 1,
  },
  content: {
    padding: theme.spacing.md,
    paddingBottom: theme.spacing['2xl'],
  },
  section: {
    marginBottom: theme.spacing.lg,
  },
}));
