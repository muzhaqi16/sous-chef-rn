import React, { useState, useEffect } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { BottomSheetModal, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { format, parseISO, startOfDay } from 'date-fns';
import { useStandardBottomSheet } from '#hooks/useStandardBottomSheet';
import { BottomSheetHeader } from '#components/atoms/BottomSheetHeader';
import { MealType } from '#generated';
import { useAddRecipeToMealPlan } from '#hooks/mealPlan/useAddRecipeToMealPlan';
import { useMealPlanCalendar } from '#hooks/mealPlan/useMealPlanCalendar';
import { WeekStrip } from '#components/mealPlan/WeekStrip';

interface AddToMealPlanSheetProps {
  visible: boolean;
  onClose: () => void;
  recipeId: string;
  initialMealType?: MealType;
}

const MEAL_TYPES: { type: MealType; label: string }[] = [
  { type: MealType.Breakfast, label: 'Breakfast' },
  { type: MealType.Brunch, label: 'Brunch' },
  { type: MealType.Lunch, label: 'Lunch' },
  { type: MealType.Snack, label: 'Snack' },
  { type: MealType.Dinner, label: 'Dinner' },
  { type: MealType.Dessert, label: 'Dessert' },
];

export const AddToMealPlanSheet: React.FC<AddToMealPlanSheetProps> = ({
  visible,
  onClose,
  recipeId,
  initialMealType }) => {
  const { ref, modalProps, contentContainerStyle } = useStandardBottomSheet({
    visible,
    onDismiss: onClose,
    snapPoints: ['65%'] });

  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [selectedMealType, setSelectedMealType] = useState<MealType>(
    initialMealType ?? MealType.Dinner,
  );

  const { addRecipeToMealPlan, adding, hasPlan, mealPlans, activePlanId } =
    useAddRecipeToMealPlan({ planId: selectedPlanId });

  const activePlan = mealPlans.find(p => p.id === activePlanId) ?? null;

  const minDate = (activePlan ? startOfDay(parseISO(activePlan.startDate)) : undefined);
  const maxDate = (activePlan ? startOfDay(parseISO(activePlan.endDate)) : undefined);

  const calendar = useMealPlanCalendar({ minDate, maxDate });

  // Reset state when sheet opens
  useEffect(() => {
    if (visible) {
      setSelectedPlanId(null);
      setSelectedMealType(initialMealType ?? MealType.Dinner);
    }
  }, [visible, initialMealType]);

  const handleConfirm = async () => {
    const success = await addRecipeToMealPlan({
      recipeId,
      mealType: selectedMealType,
      date: calendar.selectedDate });
    if (success) {
      ref.current?.dismiss();
    }
  };

  return (
    <BottomSheetModal ref={ref} {...modalProps}>
      <BottomSheetScrollView contentContainerStyle={[styles.content, contentContainerStyle]}>
        <BottomSheetHeader
          title="Add to Meal Plan"
          onCancel={onClose}
          onConfirm={handleConfirm}
          confirmLabel="Add"
          confirmDisabled={adding || !hasPlan}
          confirmColor="primary"
        />

        {!hasPlan && (
          <Text style={styles.warningText}>
            No active meal plan. Create one first.
          </Text>
        )}

        {hasPlan && mealPlans.length > 1 ? (
          <>
            <Text style={styles.sectionLabel}>Meal Plan</Text>
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
                      style={[
                        styles.planChipText,
                        isSelected && styles.planChipTextSelected,
                      ]}
                      numberOfLines={1}
                    >
                      {plan.name}
                    </Text>
                    <Text
                      style={[
                        styles.planChipDate,
                        isSelected && styles.planChipDateSelected,
                      ]}
                      numberOfLines={1}
                    >
                      {format(parseISO(plan.startDate), 'MMM d')} – {format(parseISO(plan.endDate), 'MMM d')}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </>
        ) : null}

        {hasPlan ? (
          <>
            <Text style={styles.sectionLabel}>Date</Text>
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
            <Text style={styles.selectedDateLabel}>
              {format(calendar.selectedDate, 'EEEE, MMMM d')}
            </Text>
          </>
        ) : null}

        <Text style={styles.sectionLabel}>Meal Type</Text>

        <View style={styles.mealTypeRow}>
          {MEAL_TYPES.map(({ type, label }) => (
            <Pressable
              key={type}
              onPress={() => setSelectedMealType(type)}
              style={[
                styles.mealTypeChip,
                selectedMealType === type && styles.mealTypeChipSelected,
              ]}
            >
              <Text
                style={[
                  styles.mealTypeText,
                  selectedMealType === type && styles.mealTypeTextSelected,
                ]}
              >
                {label}
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
    paddingHorizontal: theme.spacing.lg },
  warningText: {
    fontSize: theme.fonts.size.sm,
    color: theme.colors.warning,
    textAlign: 'center',
    marginBottom: theme.spacing.md },
  sectionLabel: {
    fontSize: theme.fonts.size.sm,
    fontWeight: theme.fonts.weight.medium,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.sm },
  selectedDateLabel: {
    fontSize: theme.fonts.size.md,
    fontWeight: theme.fonts.weight.semibold,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.lg,
    textAlign: 'center' },
  planChipScroll: {
    marginBottom: theme.spacing.md },
  planChipRow: {
    gap: theme.spacing.sm,
    paddingRight: theme.spacing.md },
  planChip: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radii.lg,
    borderWidth: 1,
    borderColor: theme.colors.border },
  planChipSelected: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary },
  planChipText: {
    fontSize: theme.fonts.size.sm,
    fontWeight: theme.fonts.weight.medium,
    color: theme.colors.textPrimary },
  planChipTextSelected: {
    color: theme.colors.white },
  planChipDate: {
    fontSize: theme.fonts.size.xs,
    color: theme.colors.textSecondary,
    marginTop: 2 },
  planChipDateSelected: {
    color: theme.colors.white,
    opacity: 0.8 },
  mealTypeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.xs,
    marginBottom: theme.spacing.md },
  mealTypeChip: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.radii.lg,
    borderWidth: 1,
    borderColor: theme.colors.border },
  mealTypeChipSelected: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary },
  mealTypeText: {
    fontSize: theme.fonts.size.sm,
    color: theme.colors.textSecondary },
  mealTypeTextSelected: {
    color: theme.colors.white,
    fontWeight: theme.fonts.weight.medium } }));
