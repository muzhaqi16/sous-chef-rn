import React, { useState } from 'react';
import { View, ScrollView } from 'react-native';
import { useTranslation } from '#/i18n';
import { Pressable } from '#components/atoms/themedComponents';
import { StyleSheet } from 'react-native-unistyles';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { BottomSheetModal } from '#hooks/useStandardBottomSheet';
import { parseISO, startOfDay } from 'date-fns';
import { useStandardBottomSheet } from '#hooks/useStandardBottomSheet';
import { BottomSheetHeader } from '#components/molecules/BottomSheetHeader';
import { MealType } from '#/graphql/generated/schemaTypes';
import { useAddRecipeToMealPlan } from '#features/mealPlan/hooks/useAddRecipeToMealPlan';
import { useMealPlanCalendar } from '#features/mealPlan/hooks/useMealPlanCalendar';
import { WeekStrip } from '#features/mealPlan/components/WeekStrip';
import { Text } from '#components/atoms/Text';
import {
  formatFullWeekdayMonthDay,
  formatMonthDay,
} from '#/utils/formatters/date';
import { SectionHeader } from '#components/atoms/SectionHeader';

interface AddToMealPlanSheetProps {
  visible: boolean;
  onClose: () => void;
  recipeId: string;
  initialMealType?: MealType;
}

const MEAL_TYPE_KEYS: { type: MealType; labelKey: string }[] = [
  { type: MealType.Breakfast, labelKey: 'labels.breakfast' },
  { type: MealType.Brunch, labelKey: 'labels.brunch' },
  { type: MealType.Lunch, labelKey: 'labels.lunch' },
  { type: MealType.Snack, labelKey: 'usagePurpose.SNACK' },
  { type: MealType.Dinner, labelKey: 'labels.dinner' },
  { type: MealType.Dessert, labelKey: 'labels.dessert' },
];

export const AddToMealPlanSheet: React.FC<AddToMealPlanSheetProps> = ({
  visible,
  onClose,
  recipeId,
  initialMealType,
}) => {
  const { t } = useTranslation();
  const { ref, modalProps, contentContainerStyle } = useStandardBottomSheet({
    visible,
    onDismiss: onClose,
    snapPoints: ['65%'],
  });

  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [selectedMealType, setSelectedMealType] = useState<MealType>(
    initialMealType ?? MealType.Dinner,
  );

  // Reset state when sheet opens (render-time conditional state update)
  const [prevVisible, setPrevVisible] = useState(visible);
  const [prevInitialMealType, setPrevInitialMealType] =
    useState(initialMealType);
  if (visible !== prevVisible || initialMealType !== prevInitialMealType) {
    setPrevVisible(visible);
    setPrevInitialMealType(initialMealType);
    if (visible) {
      setSelectedPlanId(null);
      setSelectedMealType(initialMealType ?? MealType.Dinner);
    }
  }

  const { addRecipeToMealPlan, adding, hasPlan, mealPlans, activePlanId } =
    useAddRecipeToMealPlan({ planId: selectedPlanId });

  const activePlan = mealPlans.find(p => p.id === activePlanId) ?? null;

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
    <BottomSheetModal ref={ref} {...modalProps}>
      <BottomSheetScrollView
        contentContainerStyle={[styles.content, contentContainerStyle]}
      >
        <BottomSheetHeader
          title={t('addToMealPlan.title')}
          onCancel={onClose}
          onConfirm={handleConfirm}
          confirmLabel={t('labels.add')}
          confirmDisabled={adding || !hasPlan}
          confirmColor="primary"
        />

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

        {hasPlan && mealPlans.length > 1 ? (
          <>
            <SectionHeader variant="overline" style={styles.sectionLabel}>
              {t('labels.mealPlan')}
            </SectionHeader>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.planChipRow}
              style={styles.planChipScroll}
            >
              {mealPlans.map(plan => {
                const isSelected = plan.id === activePlanId;
                return (
                  <Pressable
                    key={plan.id}
                    onPress={() => setSelectedPlanId(plan.id)}
                    style={[
                      styles.planChip,
                      isSelected && styles.planChipSelected,
                    ]}
                  >
                    <Text
                      role="label"
                      style={[
                        styles.planChipText,
                        isSelected && styles.planChipTextSelected,
                      ]}
                      numberOfLines={1}
                    >
                      {plan.name}
                    </Text>
                    <Text
                      role="caption"
                      style={[
                        styles.planChipDate,
                        isSelected && styles.planChipDateSelected,
                      ]}
                      numberOfLines={1}
                    >
                      {formatMonthDay(parseISO(plan.startDate))} –{' '}
                      {formatMonthDay(parseISO(plan.endDate))}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
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

        <View style={styles.mealTypeRow}>
          {MEAL_TYPE_KEYS.map(({ type, labelKey }) => (
            <Pressable
              key={type}
              onPress={() => setSelectedMealType(type)}
              style={[
                styles.mealTypeChip,
                selectedMealType === type && styles.mealTypeChipSelected,
              ]}
            >
              <Text
                role="caption"
                style={[
                  styles.mealTypeText,
                  selectedMealType === type && styles.mealTypeTextSelected,
                ]}
              >
                {t(labelKey)}
              </Text>
            </Pressable>
          ))}
        </View>
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
};

const styles = StyleSheet.create(theme => ({
  content: {
    paddingHorizontal: theme.spacing.lg,
  },
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
  planChipRow: {
    gap: theme.spacing.sm,
    paddingRight: theme.spacing.md,
  },
  planChip: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radii.lg,
    borderCurve: 'continuous',
    borderWidth: theme.borderWidth.hairline,
    borderColor: theme.colors.border,
  },
  planChipSelected: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  planChipText: {
    color: theme.colors.textPrimary,
  },
  planChipTextSelected: {
    color: theme.colors.onPrimary,
  },
  planChipDate: {
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  planChipDateSelected: {
    color: theme.colors.onPrimary,
    opacity: 0.8,
  },
  mealTypeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.xs,
    marginBottom: theme.spacing.md,
  },
  mealTypeChip: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.radii.lg,
    borderCurve: 'continuous',
    backgroundColor: theme.colors.surface,
    borderWidth: theme.borderWidth.hairline,
    borderColor: theme.colors.border,
  },
  // Selected = primary outline + primary label, matching the shared
  // ChipScrollRow active style the other meal-type pickers use — not a filled
  // pill — so the two selectors read the same.
  mealTypeChipSelected: {
    borderColor: theme.colors.primary,
  },
  mealTypeText: {
    color: theme.colors.textSecondary,
  },
  mealTypeTextSelected: {
    color: theme.colors.primary,
  },
}));
