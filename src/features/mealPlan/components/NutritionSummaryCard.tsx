import React, { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from '#/i18n';
import { Pressable } from '#components/atoms/themedComponents';
import { StyleSheet } from 'react-native-unistyles';
import { Icon } from '#utils/iconUtils';
import { NutritionGoalProgress } from './NutritionGoalProgress';
import { Text } from '#components/atoms/Text';
import { type GoalProgress } from '#/graphql/generated/schemaTypes';

// Structural prop types — only the fields the card actually renders. Keeps
// the component reusable across MealPlanMain and MealPlanSettingsSheet
// fragment shapes (which select different subsets of nutritionSummary).
interface NutritionSummaryShape {
  totalCalories: number;
  avgDailyCalories: number;
  avgDailyProtein: number;
  avgDailyCarbs: number;
  avgDailyFat: number;
  totalMeals: number;
  mealsWithNutrition: number;
  coveragePercentage: number;
}

interface NutritionGoalProgressShape {
  overallScore: number;
  caloriesProgress: GoalProgress | null;
  proteinProgress: GoalProgress | null;
  carbsProgress: GoalProgress | null;
  fatProgress: GoalProgress | null;
}

interface NutritionSummaryCardProps {
  nutritionSummary: NutritionSummaryShape;
  nutritionGoalProgress?: NutritionGoalProgressShape | null;
}

function MacroStat({
  label,
  value,
  unit,
}: {
  label: string;
  value: number;
  unit: string;
}) {
  return (
    <View style={statStyles.container}>
      <Text size="lg" weight="bold">
        {Math.round(value)}
      </Text>
      <Text size="xs" tone="tertiary">
        {unit}
      </Text>
      <Text size="xs" tone="secondary" style={statStyles.label}>
        {label}
      </Text>
    </View>
  );
}

export const NutritionSummaryCard: React.FC<NutritionSummaryCardProps> = ({
  nutritionSummary,
  nutritionGoalProgress,
}) => {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);

  const toggle = () => setExpanded(prev => !prev);

  return (
    <View style={styles.container}>
      <Pressable onPress={toggle} style={styles.header}>
        <Text size="md" weight="semibold">
          {t('nutritionSummary.title')}
        </Text>
        <View style={styles.headerRight}>
          {!expanded ? (
            <Text size="sm" tone="secondary">
              {t('nutritionSummary.kcalPerDay', {
                count: Math.round(nutritionSummary.avgDailyCalories),
              })}
            </Text>
          ) : null}
          <Icon
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={20}
            tone="textTertiary"
          />
        </View>
      </Pressable>

      {expanded ? (
        <View style={styles.body}>
          {/* Daily averages */}
          <View style={styles.section}>
            <Text
              size="sm"
              weight="semibold"
              tone="secondary"
              style={styles.sectionTitle}
            >
              {t('nutritionSummary.dailyAverages')}
            </Text>
            <View style={styles.macroRow}>
              <MacroStat
                label={t('labels.calories')}
                value={nutritionSummary.avgDailyCalories}
                unit={t('nutritionSummary.unitKcal')}
              />
              <MacroStat
                label={t('nutritionSummary.macroProtein')}
                value={nutritionSummary.avgDailyProtein}
                unit={t('nutritionSummary.unitGrams')}
              />
              <MacroStat
                label={t('labels.carbs')}
                value={nutritionSummary.avgDailyCarbs}
                unit={t('nutritionSummary.unitGrams')}
              />
              <MacroStat
                label={t('nutritionSummary.macroFat')}
                value={nutritionSummary.avgDailyFat}
                unit={t('nutritionSummary.unitGrams')}
              />
            </View>
          </View>

          {/* Plan totals */}
          <View style={styles.section}>
            <Text
              size="sm"
              weight="semibold"
              tone="secondary"
              style={styles.sectionTitle}
            >
              {t('nutritionSummary.planTotals')}
            </Text>
            <View style={styles.infoRow}>
              <Text size="sm" tone="secondary">
                {t('nutritionSummary.totalMeals')}
              </Text>
              <Text size="sm" weight="medium">
                {nutritionSummary.totalMeals}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Text size="sm" tone="secondary">
                {t('nutritionSummary.mealsWithNutritionData')}
              </Text>
              <Text size="sm" weight="medium">
                {t('nutritionSummary.coverage', {
                  count: nutritionSummary.mealsWithNutrition,
                  percent: Math.round(nutritionSummary.coveragePercentage),
                })}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Text size="sm" tone="secondary">
                {t('nutritionSummary.totalCalories')}
              </Text>
              <Text size="sm" weight="medium">
                {t('nutritionSummary.caloriesValue', {
                  count: Math.round(nutritionSummary.totalCalories),
                })}
              </Text>
            </View>
          </View>

          {/* Goal progress */}
          {!!nutritionGoalProgress && (
            <View style={styles.section}>
              <Text
                size="sm"
                weight="semibold"
                tone="secondary"
                style={styles.sectionTitle}
              >
                {t('nutritionSummary.goalProgress')}
              </Text>
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
      ) : null}
    </View>
  );
};

NutritionSummaryCard.displayName = 'NutritionSummaryCard';

const styles = StyleSheet.create(theme => ({
  container: {},
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: theme.spacing.sm,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  body: {
    gap: theme.spacing.lg,
    paddingBottom: theme.spacing.md,
  },
  section: {
    gap: theme.spacing.sm,
  },
  sectionTitle: {
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
    paddingVertical: theme.spacing.xs,
  },
}));

const statStyles = StyleSheet.create(theme => ({
  container: {
    alignItems: 'center',
    flex: 1,
    paddingVertical: theme.spacing.sm,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.md,
    borderCurve: 'continuous',
    marginHorizontal: 2,
  },
  label: {
    marginTop: 2,
  },
}));
