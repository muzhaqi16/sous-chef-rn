import React from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { Text } from '#components/atoms/Text';
import { GoalStatus, type GoalProgress } from '#/graphql/generated/schemaTypes';

interface NutritionGoalProgressProps {
  overallScore: number;
  caloriesProgress: GoalProgress | null | undefined;
  proteinProgress: GoalProgress | null | undefined;
  carbsProgress: GoalProgress | null | undefined;
  fatProgress: GoalProgress | null | undefined;
}

const STATUS_LABELS: Record<GoalStatus, string> = {
  [GoalStatus.OnTarget]: 'On Target',
  [GoalStatus.UnderTarget]: 'Under',
  [GoalStatus.OverTarget]: 'Over',
};

function MacroProgressBar({
  label,
  progress,
}: {
  label: string;
  progress: GoalProgress | null | undefined;
}) {
  barStyles.useVariants({ status: progress?.status });
  if (!progress) return null;

  const percentage = Math.min(progress.percentage, 100);

  return (
    <View style={barStyles.container}>
      <View style={barStyles.labelRow}>
        <Text size="sm" weight="medium">
          {label}
        </Text>
        <Text size="xs" weight="semibold" style={barStyles.statusLabel}>
          {STATUS_LABELS[progress.status]}
        </Text>
      </View>
      <View style={barStyles.barBackground}>
        <View style={[barStyles.barFill, { width: `${percentage}%` }]} />
      </View>
      <View style={barStyles.valueRow}>
        <Text size="xs" tone="secondary">
          {Math.round(progress.current)} / {Math.round(progress.target)}
        </Text>
        <Text size="xs" tone="tertiary">
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
        <Text size="md" weight="semibold">
          Overall Score
        </Text>
        <Text size="lg" weight="bold" tone="accent">
          {Math.round(overallScore)}/100
        </Text>
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
  barsContainer: {
    gap: theme.spacing.sm,
  },
}));

const barStyles = StyleSheet.create(theme => ({
  container: {
    gap: theme.spacing.xs,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
    variants: {
      status: {
        [GoalStatus.OnTarget]: { backgroundColor: theme.colors.success },
        [GoalStatus.UnderTarget]: { backgroundColor: theme.colors.warning },
        [GoalStatus.OverTarget]: { backgroundColor: theme.colors.error },
      },
    },
  },
  statusLabel: {
    variants: {
      status: {
        [GoalStatus.OnTarget]: { color: theme.colors.success },
        [GoalStatus.UnderTarget]: { color: theme.colors.warning },
        [GoalStatus.OverTarget]: { color: theme.colors.error },
      },
    },
  },
  valueRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
}));
