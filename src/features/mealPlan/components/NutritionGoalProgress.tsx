import React from 'react';
import { View } from 'react-native';
import { useTranslation, type TranslationKey } from '#/i18n';
import { StyleSheet } from 'react-native-unistyles';
import { Text, type TextTone } from '#components/atoms/Text';
import { GoalStatus, type GoalProgress } from '#/graphql/generated/schemaTypes';
import { ProgressBar } from '#components/atoms/ProgressBar';

interface NutritionGoalProgressProps {
  overallScore: number;
  caloriesProgress: GoalProgress | null | undefined;
  proteinProgress: GoalProgress | null | undefined;
  carbsProgress: GoalProgress | null | undefined;
  fatProgress: GoalProgress | null | undefined;
}

const STATUS_LABEL_KEYS: Record<GoalStatus, TranslationKey> = {
  [GoalStatus.OnTarget]: 'nutritionGoal.statusOnTarget',
  [GoalStatus.UnderTarget]: 'nutritionGoal.statusUnder',
  [GoalStatus.OverTarget]: 'nutritionGoal.statusOver',
};

const STATUS_BAR_TONE: Record<GoalStatus, 'success' | 'warning' | 'error'> = {
  [GoalStatus.OnTarget]: 'success',
  [GoalStatus.UnderTarget]: 'warning',
  [GoalStatus.OverTarget]: 'error',
};

const STATUS_TEXT_TONE: Record<GoalStatus, TextTone> = {
  [GoalStatus.OnTarget]: 'success',
  [GoalStatus.UnderTarget]: 'warning',
  [GoalStatus.OverTarget]: 'danger',
};

function MacroProgressBar({
  label,
  progress,
}: {
  label: string;
  progress: GoalProgress | null | undefined;
}) {
  const { t } = useTranslation();
  if (!progress) return null;

  const percentage = Math.min(progress.percentage, 100);

  return (
    <View style={barStyles.container}>
      <View style={barStyles.labelRow}>
        <Text role="label">{label}</Text>
        <Text role="label" tone={STATUS_TEXT_TONE[progress.status]}>
          {t(STATUS_LABEL_KEYS[progress.status])}
        </Text>
      </View>
      <ProgressBar
        value={percentage / 100}
        tone={STATUS_BAR_TONE[progress.status]}
        accessibilityLabel={label}
      />
      <View style={barStyles.valueRow}>
        <Text role="caption" tone="secondary">
          {Math.round(progress.current)} / {Math.round(progress.target)}
        </Text>
        <Text role="caption" tone="tertiary">
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
  const { t } = useTranslation();
  return (
    <View style={styles.container}>
      <View style={styles.scoreRow}>
        <Text role="bodyStrong">{t('nutritionGoal.overallScore')}</Text>
        <Text role="heading" tone="accent">
          {t('nutritionGoal.scoreFormat', {
            score: Math.round(overallScore),
          })}
        </Text>
      </View>

      <View style={styles.barsContainer}>
        <MacroProgressBar
          label={t('labels.calories')}
          progress={caloriesProgress}
        />
        <MacroProgressBar
          label={t('labels.proteinG')}
          progress={proteinProgress}
        />
        <MacroProgressBar label={t('labels.carbsG')} progress={carbsProgress} />
        <MacroProgressBar
          label={t('nutritionGoal.labelFatG')}
          progress={fatProgress}
        />
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
  valueRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
}));
