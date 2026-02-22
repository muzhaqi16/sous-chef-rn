import React from 'react';
import { View, Text } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { NutritionGoalProgress } from './NutritionGoalProgress';
import type { MealPlanFullFragment } from '#generated';

interface NutritionSummaryCardProps {
  nutritionSummary: NonNullable<MealPlanFullFragment['nutritionSummary']>;
  nutritionGoalProgress?: MealPlanFullFragment['nutritionGoalProgress'];
}

function MacroStat({ label, value, unit }: { label: string; value: number; unit: string }) {
  return (
    <View style={statStyles.container}>
      <Text style={statStyles.value}>{Math.round(value)}</Text>
      <Text style={statStyles.unit}>{unit}</Text>
      <Text style={statStyles.label}>{label}</Text>
    </View>
  );
}

export const NutritionSummaryCard: React.FC<NutritionSummaryCardProps> = ({
  nutritionSummary,
  nutritionGoalProgress,
}) => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Nutrition Summary</Text>

      {/* Daily averages */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Daily Averages</Text>
        <View style={styles.macroRow}>
          <MacroStat label="Calories" value={nutritionSummary.avgDailyCalories} unit="kcal" />
          <MacroStat label="Protein" value={nutritionSummary.avgDailyProtein} unit="g" />
          <MacroStat label="Carbs" value={nutritionSummary.avgDailyCarbs} unit="g" />
          <MacroStat label="Fat" value={nutritionSummary.avgDailyFat} unit="g" />
        </View>
      </View>

      {/* Plan totals */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Plan Totals</Text>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Total Meals</Text>
          <Text style={styles.infoValue}>{nutritionSummary.totalMeals}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Meals with Nutrition Data</Text>
          <Text style={styles.infoValue}>
            {nutritionSummary.mealsWithNutrition} ({Math.round(nutritionSummary.coveragePercentage)}%)
          </Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Total Calories</Text>
          <Text style={styles.infoValue}>{Math.round(nutritionSummary.totalCalories)} kcal</Text>
        </View>
      </View>

      {/* Goal progress */}
      {nutritionGoalProgress && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Goal Progress</Text>
          <NutritionGoalProgress
            overallScore={nutritionGoalProgress.overallScore}
            caloriesProgress={nutritionGoalProgress.caloriesProgress}
            proteinProgress={nutritionGoalProgress.proteinProgress}
            carbsProgress={nutritionGoalProgress.carbsProgress}
            fatProgress={nutritionGoalProgress.fatProgress}
          />
        </View>
      )}
    </View>
  );
};

NutritionSummaryCard.displayName = 'NutritionSummaryCard';

const styles = StyleSheet.create(theme => ({
  container: {
    gap: theme.spacing.lg,
  },
  title: {
    fontSize: theme.fonts.size.lg,
    fontWeight: theme.fonts.weight.bold,
    color: theme.colors.textPrimary,
  },
  section: {
    gap: theme.spacing.sm,
  },
  sectionTitle: {
    fontSize: theme.fonts.size.sm,
    fontWeight: theme.fonts.weight.semibold,
    color: theme.colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  macroRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  infoLabel: {
    fontSize: theme.fonts.size.sm,
    color: theme.colors.textSecondary,
  },
  infoValue: {
    fontSize: theme.fonts.size.sm,
    fontWeight: theme.fonts.weight.medium,
    color: theme.colors.textPrimary,
  },
}));

const statStyles = StyleSheet.create(theme => ({
  container: {
    alignItems: 'center',
    flex: 1,
    paddingVertical: theme.spacing.sm,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.md,
    marginHorizontal: 2,
  },
  value: {
    fontSize: theme.fonts.size.lg,
    fontWeight: theme.fonts.weight.bold,
    color: theme.colors.textPrimary,
  },
  unit: {
    fontSize: theme.fonts.size.xs,
    color: theme.colors.textTertiary,
  },
  label: {
    fontSize: theme.fonts.size.xs,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
}));
