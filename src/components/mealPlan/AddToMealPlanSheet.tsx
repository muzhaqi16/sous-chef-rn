import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, Pressable } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { BottomSheetModal, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { format } from 'date-fns';
import { useStandardBottomSheet } from '#hooks/useStandardBottomSheet';
import { BottomSheetHeader } from '#components/atoms/BottomSheetHeader';
import { MealType } from '#generated';
import { useAddRecipeToMealPlan } from '#hooks/mealPlan/useAddRecipeToMealPlan';

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
  initialMealType,
}) => {
  const { ref, modalProps, contentContainerStyle } = useStandardBottomSheet({
    visible,
    onDismiss: onClose,
    snapPoints: ['50%'],
  });

  const { addRecipeToMealPlan, adding, hasPlan, targetDate } = useAddRecipeToMealPlan();
  const [selectedMealType, setSelectedMealType] = useState<MealType>(
    initialMealType ?? MealType.Dinner,
  );

  useEffect(() => {
    if (visible) {
      setSelectedMealType(initialMealType ?? MealType.Dinner);
    }
  }, [visible, initialMealType]);

  const handleConfirm = useCallback(async () => {
    const success = await addRecipeToMealPlan({
      recipeId,
      mealType: selectedMealType,
      date: targetDate,
    });
    if (success) {
      ref.current?.dismiss();
    }
  }, [addRecipeToMealPlan, recipeId, selectedMealType, targetDate, ref]);

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

        <Text style={styles.dateLabel}>
          {format(targetDate, 'EEEE, MMMM d')}
        </Text>

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
    paddingHorizontal: theme.spacing.lg,
  },
  warningText: {
    fontSize: theme.fonts.size.sm,
    color: theme.colors.warning,
    textAlign: 'center',
    marginBottom: theme.spacing.md,
  },
  dateLabel: {
    fontSize: theme.fonts.size.lg,
    fontWeight: theme.fonts.weight.semibold,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.lg,
  },
  sectionLabel: {
    fontSize: theme.fonts.size.sm,
    fontWeight: theme.fonts.weight.medium,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.sm,
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
    fontSize: theme.fonts.size.sm,
    color: theme.colors.textSecondary,
  },
  mealTypeTextSelected: {
    color: theme.colors.white,
    fontWeight: theme.fonts.weight.medium,
  },
}));
