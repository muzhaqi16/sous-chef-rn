import React from 'react';
import { View, ScrollView } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { RouteProp, useRoute } from '@react-navigation/native';
import { Header } from '#components/molecules/Header';
import { NutritionSummary, NutritionDetailList } from '#components/molecules';
import { useAppNavigation } from '#hooks';
import { commonStyles } from '#styles';
import type { PantryStackParamList } from '#navigation/stacks/PantryStack';

type NutritionScreenRouteProp = RouteProp<PantryStackParamList, 'NutritionScreen'>;

export const NutritionScreen: React.FC = () => {
  const { goBack } = useAppNavigation();
  const route = useRoute<NutritionScreenRouteProp>();
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
