import React, { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from '#/i18n';
import { Pressable } from '#components/atoms/themedComponents';
import { Sheet } from '#components/templates/Sheet';
import { StyleSheet } from 'react-native-unistyles';
import { addDays, differenceInDays, parseISO } from 'date-fns';
import { BottomSheetHeader } from '#components/molecules/BottomSheetHeader';
import { FormInput } from '#components/atoms/FormInput';
import { Icon } from '#utils/iconUtils';
import { type MealPlanDisplayFragment } from '#features/mealPlan/graphql/mealPlanFragments.generated';
import { Text } from '#components/atoms/Text';
import {
  formatMonthDay,
  formatMonthDayYear,
  formatWeekdayMonthDay,
} from '#/utils/formatters/date';

interface DuplicatePlanSheetProps {
  visible: boolean;
  mealPlan: MealPlanDisplayFragment | null;
  onClose: () => void;
  onDuplicate: (input: {
    mealPlanId: string;
    newName: string;
    newStartDate: string;
    newEndDate: string;
  }) => void;
  loading: boolean;
  /** Server unreachable (offline / API down) — disables confirm (no replay path). */
  disabled?: boolean;
}

export const DuplicatePlanSheet: React.FC<DuplicatePlanSheetProps> = ({
  visible,
  mealPlan,
  onClose,
  onDuplicate,
  loading,
  disabled = false,
}) => {
  const { t } = useTranslation();

  const [name, setName] = useState('');
  const [startDateOffset, setStartDateOffset] = useState(0);

  // Reset state when sheet opens (render-time conditional state update)
  const [prevVisible, setPrevVisible] = useState(visible);
  const [prevMealPlan, setPrevMealPlan] = useState(mealPlan);
  if (visible !== prevVisible || mealPlan !== prevMealPlan) {
    setPrevVisible(visible);
    setPrevMealPlan(mealPlan);
    if (visible && mealPlan) {
      setName(t('duplicatePlan.copySuffix', { name: mealPlan.name }));
      setStartDateOffset(0);
    }
  }

  const duration = (() => {
    if (!mealPlan?.startDate || !mealPlan?.endDate) return 7;
    return differenceInDays(
      parseISO(mealPlan.endDate),
      parseISO(mealPlan.startDate),
    );
  })();

  const newStartDate = (() => {
    if (!mealPlan?.endDate) return new Date();
    return addDays(parseISO(mealPlan.endDate), 1 + startDateOffset);
  })();

  const newEndDate = (() => {
    return addDays(newStartDate, duration);
  })();

  const handleDuplicate = () => {
    if (!mealPlan || !name.trim()) return;
    onDuplicate({
      mealPlanId: mealPlan.id,
      newName: name.trim(),
      newStartDate: newStartDate.toISOString(),
      newEndDate: newEndDate.toISOString(),
    });
  };

  return (
    <Sheet
      visible={visible}
      onDismiss={onClose}
      snapPoints={['55%']}
      mode="form"
      style={styles.scrollView}
      contentContainerStyle={styles.contentContainer}
    >
      <BottomSheetHeader
        title={t('labels.duplicatePlan')}
        onCancel={onClose}
        onConfirm={handleDuplicate}
        confirmLabel={
          loading
            ? t('duplicatePlan.duplicating')
            : t('duplicatePlan.duplicate')
        }
        confirmDisabled={loading || disabled || !name.trim()}
        confirmColor="primary"
      />

      {!!mealPlan && !!mealPlan.startDate && !!mealPlan.endDate && (
        <View style={styles.currentInfo}>
          <Text role="caption" tone="secondary" style={styles.currentLabel}>
            {t('duplicatePlan.currentPlanLabel')}
          </Text>
          <Text role="bodyStrong">
            {formatMonthDay(parseISO(mealPlan.startDate))} -{' '}
            {formatMonthDayYear(parseISO(mealPlan.endDate))}
          </Text>
        </View>
      )}

      <FormInput
        label={t('duplicatePlan.newNameLabel')}
        value={name}
        onChangeText={setName}
        placeholder={t('duplicatePlan.newNamePlaceholder')}
        required
      />

      {/* Date adjustment */}
      <View style={styles.section}>
        <Text role="label" tone="secondary">
          {t('labels.startDate')}
        </Text>
        <View style={styles.dateAdjust}>
          <Pressable
            onPress={() => setStartDateOffset(prev => prev - 7)}
            accessibilityLabel={t('a11y.previousWeek')}
            style={styles.dateButton}
            hitSlop={8}
          >
            <Icon name="chevron-back" size={20} tone="primary" />
          </Pressable>
          <View style={styles.dateDisplay}>
            <Text role="bodyStrong">{formatWeekdayMonthDay(newStartDate)}</Text>
            <Text role="caption" tone="secondary" style={styles.dateSubtext}>
              {t('duplicatePlan.endDateSubtext', {
                date: formatWeekdayMonthDay(newEndDate),
              })}
            </Text>
          </View>
          <Pressable
            onPress={() => setStartDateOffset(prev => prev + 7)}
            accessibilityLabel={t('a11y.nextWeek')}
            style={styles.dateButton}
            hitSlop={8}
          >
            <Icon name="chevron-forward" size={20} tone="primary" />
          </Pressable>
        </View>
      </View>

      <View style={styles.infoCard}>
        <Icon
          name="information-circle-outline"
          size={18}
          tone="textSecondary"
        />
        <Text role="caption" style={styles.infoText}>
          {t('duplicatePlan.infoText')}
        </Text>
      </View>
    </Sheet>
  );
};

const styles = StyleSheet.create(theme => ({
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    padding: theme.spacing.md,
    gap: theme.spacing.md,
  },
  currentInfo: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.md,
    borderCurve: 'continuous',
    padding: theme.spacing.md,
  },
  currentLabel: {
    marginBottom: theme.spacing.xs,
  },
  section: {
    gap: theme.spacing.sm,
  },
  dateAdjust: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.md,
    borderCurve: 'continuous',
    padding: theme.spacing.sm,
  },
  dateButton: {
    padding: theme.spacing.sm,
    borderRadius: theme.radii.full,
    backgroundColor: theme.colors.background,
  },
  dateDisplay: {
    alignItems: 'center',
    flex: 1,
  },
  dateSubtext: {
    marginTop: 2,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    padding: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.md,
    borderCurve: 'continuous',
  },
  infoText: {
    flex: 1,
    color: theme.colors.textSecondary,
  },
}));
