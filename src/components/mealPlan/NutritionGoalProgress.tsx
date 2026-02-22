import React from 'react';
import { View, Text } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { GoalStatus, type GoalProgress } from '#generated';

interface NutritionGoalProgressProps {
  overallScore: number;
  caloriesProgress: GoalProgress | null | undefined;
  proteinProgress: GoalProgress | null | undefined;
  carbsProgress: GoalProgress | null | undefined;
  fatProgress: GoalProgress | null | undefined;
}

const STATUS_CONFIG: Record<GoalStatus, { label: string; colorKey: 'success' | 'warning' | 'error' }> = {
  [GoalStatus.OnTarget]: { label: 'On Target', colorKey: 'success' },
  [GoalStatus.UnderTarget]: { label: 'Under', colorKey: 'warning' },
  [GoalStatus.OverTarget]: { label: 'Over', colorKey: 'error' },
};

function MacroProgressBar({
  label,
  progress,
}: {
  label: string;
  progress: GoalProgress | null | undefined;
}) {
  const { theme } = useUnistyles();

  if (!progress) return null;

  const config = STATUS_CONFIG[progress.status];
  const barColor = theme.colors[config.colorKey];
  const percentage = Math.min(progress.percentage, 100);

  return (
    <View style={barStyles.container}>
      <View style={barStyles.labelRow}>
        <Text style={barStyles.label}>{label}</Text>
        <Text style={[barStyles.statusText, { color: barColor }]}>
          {config.label}
        </Text>
      </View>
      <View style={barStyles.barBackground}>
        <View
          style={[
            barStyles.barFill,
            { width: `${percentage}%`, backgroundColor: barColor },
          ]}
        />
      </View>
      <View style={barStyles.valueRow}>
        <Text style={barStyles.valueText}>
          {Math.round(progress.current)} / {Math.round(progress.target)}
        </Text>
        <Text style={barStyles.percentText}>
          {Math.round(progress.percentage)}%
        </Text>
      </View>
    </View>
  );
}

export const NutritionGoalProgress: React.FC<NutritionGoalProgressProps> = ({
  overallScore,
  caloriesProgress,
  proteinProgress,
  carbsProgress,
  fatProgress,
}) => {
  return (
    <View style={styles.container}>
      <View style={styles.scoreRow}>
        <Text style={styles.scoreLabel}>Overall Score</Text>
        <Text style={styles.scoreValue}>{Math.round(overallScore)}/100</Text>
      </View>

      <View style={styles.barsContainer}>
        <MacroProgressBar label="Calories" progress={caloriesProgress} />
        <MacroProgressBar label="Protein (g)" progress={proteinProgress} />
        <MacroProgressBar label="Carbs (g)" progress={carbsProgress} />
        <MacroProgressBar label="Fat (g)" progress={fatProgress} />
      </View>
    </View>
  );
};

NutritionGoalProgress.displayName = 'NutritionGoalProgress';

const styles = StyleSheet.create(theme => ({
  container: {
    gap: theme.spacing.md,
  },
  scoreRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  scoreLabel: {
    fontSize: theme.fonts.size.md,
    fontWeight: theme.fonts.weight.semibold,
    color: theme.colors.textPrimary,
  },
  scoreValue: {
    fontSize: theme.fonts.size.lg,
    fontWeight: theme.fonts.weight.bold,
    color: theme.colors.primary,
  },
  barsContainer: {
    gap: theme.spacing.sm,
  },
}));

const barStyles = StyleSheet.create(theme => ({
  container: {
    gap: 4,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    fontSize: theme.fonts.size.sm,
    fontWeight: theme.fonts.weight.medium,
    color: theme.colors.textPrimary,
  },
  statusText: {
    fontSize: theme.fonts.size.xs,
    fontWeight: theme.fonts.weight.semibold,
  },
  barBackground: {
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.colors.border,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 3,
  },
  valueRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  valueText: {
    fontSize: theme.fonts.size.xs,
    color: theme.colors.textSecondary,
  },
  percentText: {
    fontSize: theme.fonts.size.xs,
    color: theme.colors.textTertiary,
  },
}));
