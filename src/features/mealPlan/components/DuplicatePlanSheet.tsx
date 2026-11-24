import React from 'react';
import { View } from 'react-native';
import { Controller, useController, useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { number, object, string, type ObjectSchema } from 'yup';
import { useTranslation } from '#/i18n';
import { Pressable } from '#components/atoms/themedComponents';
import { Sheet } from '#components/templates/Sheet';
import { SheetHeader } from '#components/templates/SheetHeader';
import { SheetHeaderSlot } from '#components/templates/SheetHeaderSlot';
import { StyleSheet } from 'react-native-unistyles';
import { addDays, differenceInDays, parseISO } from 'date-fns';
import { FormInput } from '#components/atoms/FormInput';
import { Icon } from '#components/atoms/Icon';
import type { MealPlanDisplayFragment } from '#features/mealPlan/graphql/mealPlanFragments.generated';
import { Text } from '#components/atoms/Text';
import {
  formatMonthDay,
  formatMonthDayYear,
  formatWeekdayMonthDay,
} from '#/utils/formatters/date';
import { toDateKey } from '#/utils/dateUtils';
import { hitSlop } from '#/theme/foundations/sizes';
import { useOpening } from '#hooks/ui/useOpening';
import { lazyMessage, reportValidationErrors } from '#/utils/validation/common';

interface DuplicatePlanFormValues {
  name: string;
  /** Days the copy moves on from the day after the plan ends, a week a step. */
  startDateOffset: number;
}

const duplicatePlanSchema: ObjectSchema<DuplicatePlanFormValues> = object({
  name: string().trim().required(lazyMessage('mealPlan.nameRequiredMessage')),
  startDateOffset: number().defined(),
});

/** The copy's first and last day: as many days as the plan, after it ends. */
const copyRange = (mealPlan: MealPlanDisplayFragment, offset: number) => {
  const duration =
    !mealPlan.startDate || !mealPlan.endDate
      ? 7
      : differenceInDays(
          parseISO(mealPlan.endDate),
          parseISO(mealPlan.startDate),
        );
  const start = mealPlan.endDate
    ? addDays(parseISO(mealPlan.endDate), 1 + offset)
    : new Date();
  return { start, end: addDays(start, duration) };
};

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
}

type DuplicatePlanFormProps = Omit<
  DuplicatePlanSheetProps,
  'visible' | 'mealPlan'
> & { mealPlan: MealPlanDisplayFragment };

const DuplicatePlanForm: React.FC<DuplicatePlanFormProps> = ({
  mealPlan,
  onClose,
  onDuplicate,
  loading,
}) => {
  const { t } = useTranslation();
  const { control, handleSubmit } = useForm<DuplicatePlanFormValues>({
    resolver: yupResolver(duplicatePlanSchema),
    defaultValues: {
      name: t('labels.copyOfName', { name: mealPlan.name }),
      startDateOffset: 0,
    },
  });
  const { field: offset } = useController({
    control,
    name: 'startDateOffset',
  });
  const { start, end } = copyRange(mealPlan, offset.value);

  const duplicate = handleSubmit(({ name, startDateOffset }) => {
    const range = copyRange(mealPlan, startDateOffset);
    onDuplicate({
      mealPlanId: mealPlan.id,
      newName: name,
      newStartDate: toDateKey(range.start),
      newEndDate: toDateKey(range.end),
    });
  }, reportValidationErrors);

  return (
    <>
      <SheetHeaderSlot>
        <SheetHeader
          title={t('labels.duplicatePlan')}
          onClose={onClose}
          confirm={{
            onPress: () => {
              void duplicate();
            },
            accessibilityLabel: t('duplicatePlan.duplicate'),
            loading,
          }}
        />
      </SheetHeaderSlot>

      {!!mealPlan.startDate && !!mealPlan.endDate && (
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

      <Controller
        control={control}
        name="name"
        render={({ field, fieldState }) => (
          <FormInput
            label={t('duplicatePlan.newNameLabel')}
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            placeholder={t('duplicatePlan.newNamePlaceholder')}
            error={fieldState.error?.message}
            required
          />
        )}
      />

      {/* Date adjustment */}
      <View style={styles.section}>
        <Text role="label" tone="secondary">
          {t('labels.startDate')}
        </Text>
        <View style={styles.dateAdjust}>
          <Pressable
            onPress={() => offset.onChange(offset.value - 7)}
            accessibilityLabel={t('a11y.previousWeek')}
            style={styles.dateButton}
            hitSlop={hitSlop.md}
          >
            <Icon name="chevron-back" size={20} tone="primary" />
          </Pressable>
          <View style={styles.dateDisplay}>
            <Text role="bodyStrong">{formatWeekdayMonthDay(start)}</Text>
            <Text role="caption" tone="secondary" style={styles.dateSubtext}>
              {t('duplicatePlan.endDateSubtext', {
                date: formatWeekdayMonthDay(end),
              })}
            </Text>
          </View>
          <Pressable
            onPress={() => offset.onChange(offset.value + 7)}
            accessibilityLabel={t('a11y.nextWeek')}
            style={styles.dateButton}
            hitSlop={hitSlop.md}
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
    </>
  );
};

export const DuplicatePlanSheet: React.FC<DuplicatePlanSheetProps> = ({
  visible,
  mealPlan,
  ...form
}) => {
  const opening = useOpening(visible && mealPlan !== null, mealPlan);

  return (
    <Sheet
      visible={visible}
      onDismiss={form.onClose}
      snapPoints={['55%']}
      mode="form"
      headerFromContent
      style={styles.scrollView}
      contentContainerStyle={styles.contentContainer}
    >
      {opening?.payload ? (
        <DuplicatePlanForm
          key={opening.id}
          mealPlan={opening.payload}
          {...form}
        />
      ) : null}
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
    marginTop: theme.spacing['2xs'],
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
