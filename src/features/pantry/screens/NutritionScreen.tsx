import React from 'react';
import { View, ScrollView } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import type { StaticScreenProps } from '@react-navigation/native';
import { Header } from '#components/molecules/Header';
import { NutritionSummary } from '#components/molecules/NutritionSummary';
import { NutritionDetailList } from '#features/pantry/components/NutritionDetailList';
import { useAppNavigation } from '#hooks/navigation/useAppNavigation';
import { commonStyles } from '#/styles/commonStyles';

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
    <View style={commonStyles.container}>
      <Header title={itemName} centerTitle onBack={goBack} />

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
    </View>
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
