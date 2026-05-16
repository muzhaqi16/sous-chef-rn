import React, { useState } from 'react';
import { View, ScrollView } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Pressable } from '#components/atoms/themedComponents';
import { StyleSheet } from 'react-native-unistyles';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { BottomSheetModal } from '#hooks/useStandardBottomSheet';
import { format, parseISO, startOfDay } from 'date-fns';
import { useStandardBottomSheet } from '#hooks/useStandardBottomSheet';
import { BottomSheetHeader } from '#components/atoms/BottomSheetHeader';
import { MealType } from '#/graphql/generated/schemaTypes';
import { useAddRecipeToMealPlan } from '#features/mealPlan/hooks/useAddRecipeToMealPlan';
import { useMealPlanCalendar } from '#features/mealPlan/hooks/useMealPlanCalendar';
import { WeekStrip } from '#features/mealPlan/components/WeekStrip';
import { Text } from '#components/atoms/Text';

interface AddToMealPlanSheetProps {
  visible: boolean;
  onClose: () => void;
  recipeId: string;
  initialMealType?: MealType;
}

const MEAL_TYPE_KEYS: { type: MealType; labelKey: string }[] = [
  { type: MealType.Breakfast, labelKey: 'addToMealPlan.mealBreakfast' },
  { type: MealType.Brunch, labelKey: 'addToMealPlan.mealBrunch' },
  { type: MealType.Lunch, labelKey: 'addToMealPlan.mealLunch' },
  { type: MealType.Snack, labelKey: 'addToMealPlan.mealSnack' },
  { type: MealType.Dinner, labelKey: 'addToMealPlan.mealDinner' },
  { type: MealType.Dessert, labelKey: 'addToMealPlan.mealDessert' },
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
      ref.current?.dismiss();
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
          confirmLabel={t('addToMealPlan.add')}
          confirmDisabled={adding || !hasPlan}
          confirmColor="primary"
        />

        {!hasPlan && (
          <Text
            size="sm"
            tone="warning"
            align="center"
            style={styles.warningText}
          >
            {t('addToMealPlan.noActivePlan')}
          </Text>
        )}

        {hasPlan && mealPlans.length > 1 ? (
          <>
            <Text
              size="sm"
              weight="medium"
              tone="secondary"
              style={styles.sectionLabel}
            >
              {t('addToMealPlan.mealPlanLabel')}
            </Text>
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
                      size="sm"
                      weight="medium"
                      style={[
                        styles.planChipText,
                        isSelected && styles.planChipTextSelected,
                      ]}
                      numberOfLines={1}
                    >
                      {plan.name}
                    </Text>
                    <Text
                      size="xs"
                      style={[
                        styles.planChipDate,
                        isSelected && styles.planChipDateSelected,
                      ]}
                      numberOfLines={1}
                    >
                      {format(parseISO(plan.startDate), 'MMM d')} –{' '}
                      {format(parseISO(plan.endDate), 'MMM d')}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </>
        ) : null}

        {hasPlan ? (
          <>
            <Text
              size="sm"
              weight="medium"
              tone="secondary"
              style={styles.sectionLabel}
            >
              {t('addToMealPlan.dateLabel')}
            </Text>
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
              size="md"
              weight="semibold"
              align="center"
              style={styles.selectedDateLabel}
            >
              {format(calendar.selectedDate, 'EEEE, MMMM d')}
            </Text>
          </>
        ) : null}

        <Text
          size="sm"
          weight="medium"
          tone="secondary"
          style={styles.sectionLabel}
        >
          {t('addToMealPlan.mealTypeLabel')}
        </Text>

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
                size="sm"
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
    borderWidth: 1,
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
    color: theme.colors.white,
  },
  planChipDate: {
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  planChipDateSelected: {
    color: theme.colors.white,
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
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  mealTypeChipSelected: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  mealTypeText: {
    color: theme.colors.textSecondary,
  },
  mealTypeTextSelected: {
    color: theme.colors.white,
    fontWeight: theme.fonts.weight.medium,
  },
}));
