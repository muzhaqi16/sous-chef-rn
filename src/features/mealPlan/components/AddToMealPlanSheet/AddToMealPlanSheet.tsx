import React, { useState } from 'react';
import { useTranslation } from '#i18n';
import { StyleSheet } from 'react-native-unistyles';
import { parseISO, startOfDay } from 'date-fns';
import { Sheet } from '#components/templates/Sheet';
import { SheetHeader } from '#components/templates/SheetHeader';
import { SheetHeaderSlot } from '#components/templates/SheetHeaderSlot';
import { MealType } from '#graphql/generated/schemaTypes';
import {
  MEAL_TYPE_LABEL_KEYS,
  MEAL_TYPE_ORDER,
} from '#features/mealPlan/utils/mealPlanEnumLabels';
import { useAddRecipeToMealPlan } from '#features/mealPlan/hooks/useAddRecipeToMealPlan';
import { useMealPlanCalendar } from '#features/mealPlan/hooks/useMealPlanCalendar';
import { useMealPlans } from '#features/mealPlan/hooks/useMealPlans';
import { WeekStrip } from '#features/mealPlan/components/WeekStrip';
import { Text } from '#components/atoms/Text';
import {
  formatDateRange,
  formatFullWeekdayMonthDay,
} from '#utils/formatters/date';
import { Chip } from '#components/molecules/Chip';
import { ChipScrollRow } from '#components/molecules/ChipScrollRow';
import { SectionHeader } from '#components/atoms/SectionHeader';
import { useOpening } from '#hooks/ui/useOpening';

interface AddToMealPlanSheetProps {
  visible: boolean;
  onClose: () => void;
  recipeId: string;
  initialMealType?: MealType;
}

const SNAP_POINTS = ['65%'];

type AddToMealPlanFormProps = Omit<AddToMealPlanSheetProps, 'visible'>;

/** One opening: the plan, day and meal the recipe goes on. */
const AddToMealPlanForm: React.FC<AddToMealPlanFormProps> = ({
  onClose,
  recipeId,
  initialMealType,
}) => {
  const { t } = useTranslation();
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [selectedMealType, setSelectedMealType] = useState<MealType>(
    initialMealType ?? MealType.Dinner,
  );

  const {
    addRecipeToMealPlan,
    adding,
    hasPlan,
    mealPlans,
    activePlan,
    activePlanId,
    hasMorePlans,
    loadingMorePlans,
    loadMorePlans,
  } = useAddRecipeToMealPlan({ planId: selectedPlanId });

  const minDate = activePlan
    ? startOfDay(parseISO(activePlan.startDate))
    : undefined;
  const maxDate = activePlan
    ? startOfDay(parseISO(activePlan.endDate))
    : undefined;

  const calendar = useMealPlanCalendar({ minDate, maxDate });

  const handleConfirm = async () => {
    const success = await addRecipeToMealPlan({
      recipeId,
      mealType: selectedMealType,
      date: calendar.selectedDate,
    });
    if (success) {
      onClose();
    }
  };

  return (
    <>
      <SheetHeaderSlot>
        <SheetHeader
          title={t('addToMealPlan.title')}
          onClose={onClose}
          confirm={{
            onPress: () => {
              void handleConfirm();
            },
            accessibilityLabel: t('labels.add'),
            loading: adding,
            // The warning below says why.
            disabled: !hasPlan,
          }}
        />
      </SheetHeaderSlot>

      {!hasPlan && (
        <Text
          role="caption"
          tone="warning"
          align="center"
          style={styles.warningText}
        >
          {t('errors.noActiveMealPlan')}
        </Text>
      )}

      {hasPlan && (mealPlans.length > 1 || hasMorePlans) ? (
        <>
          <SectionHeader variant="overline" style={styles.sectionLabel}>
            {t('labels.mealPlan')}
          </SectionHeader>
          <ChipScrollRow
            options={mealPlans.map(plan => ({
              key: plan.id,
              label: plan.name,
              detail: formatDateRange(
                parseISO(plan.startDate),
                parseISO(plan.endDate),
              ),
            }))}
            selected={activePlanId}
            onSelect={setSelectedPlanId}
            edgeFadeColor="surface"
            style={styles.planChipScroll}
            trailing={
              hasMorePlans ? (
                <Chip
                  label={t('addToMealPlan.morePlans')}
                  onPress={loadMorePlans}
                  disabled={loadingMorePlans}
                />
              ) : null
            }
          />
        </>
      ) : null}

      {hasPlan ? (
        <>
          <SectionHeader variant="overline" style={styles.sectionLabel}>
            {t('addToMealPlan.dateLabel')}
          </SectionHeader>
          <WeekStrip
            weekDays={calendar.weekDays}
            selectedDate={calendar.selectedDate}
            onSelectDate={calendar.selectDate}
            onPrevWeek={calendar.goToPrevWeek}
            onNextWeek={calendar.goToNextWeek}
            canGoPrev={calendar.canGoPrevWeek}
            canGoNext={calendar.canGoNextWeek}
            minDate={minDate}
            maxDate={maxDate}
          />
          <Text
            role="bodyStrong"
            align="center"
            style={styles.selectedDateLabel}
          >
            {formatFullWeekdayMonthDay(calendar.selectedDate)}
          </Text>
        </>
      ) : null}

      <SectionHeader variant="overline" style={styles.sectionLabel}>
        {t('labels.mealType')}
      </SectionHeader>

      <ChipScrollRow
        options={MEAL_TYPE_ORDER.map(type => ({
          key: type,
          label: t(MEAL_TYPE_LABEL_KEYS[type]),
        }))}
        selected={selectedMealType}
        onSelect={setSelectedMealType}
        edgeFadeColor="surface"
        style={styles.mealTypeRow}
      />
    </>
  );
};

export const AddToMealPlanSheet: React.FC<AddToMealPlanSheetProps> = ({
  visible,
  ...form
}) => {
  // The plans are read while the sheet is closed too, so an opening finds them
  // held instead of saying there is no plan until they arrive.
  useMealPlans({ fetchPolicy: 'cache-first' });
  const opening = useOpening(visible);

  return (
    <Sheet
      mode="form"
      headerFromContent
      visible={visible}
      onDismiss={form.onClose}
      snapPoints={SNAP_POINTS}
    >
      {opening ? <AddToMealPlanForm key={opening.id} {...form} /> : null}
    </Sheet>
  );
};

const styles = StyleSheet.create(theme => ({
  warningText: {
    marginBottom: theme.spacing.md,
  },
  sectionLabel: {
    marginBottom: theme.spacing.sm,
  },
  selectedDateLabel: {
    marginBottom: theme.spacing.lg,
  },
  planChipScroll: {
    marginBottom: theme.spacing.md,
  },
  mealTypeRow: {
    marginBottom: theme.spacing.md,
  },
}));
