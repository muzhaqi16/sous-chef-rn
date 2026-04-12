import React, { useState } from 'react';
import { View, Text } from 'react-native';
import { BottomSheetModal, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { alertService } from '#/services/alertService';
import { Picker } from '@react-native-picker/picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStandardBottomSheet } from '#hooks/useStandardBottomSheet';
import { StyleSheet } from 'react-native-unistyles';
import { FormInput } from '#components/molecules/FormInput';
import { BottomSheetHeader } from '#components/atoms/BottomSheetHeader';
import { SKILL_LEVELS, DIETARY_LIMITS } from '#/constants/dietary';

interface CookingPreferencesSheetProps {
  visible: boolean;
  onClose: () => void;
  onSave: (values: {
    cookingSkillLevel?: string;
    maxPrepTimeMinutes?: number;
    maxCookTimeMinutes?: number;
    budgetPerMeal?: number;
  }) => Promise<boolean>;
  initialValues?: {
    cookingSkillLevel?: string | null;
    maxPrepTimeMinutes?: number | null;
    maxCookTimeMinutes?: number | null;
    budgetPerMeal?: number | null;
  };
}

export const CookingPreferencesSheet: React.FC<
  CookingPreferencesSheetProps
> = ({ visible, onClose, onSave, initialValues }) => {
  const insets = useSafeAreaInsets();

  // Standard bottom-sheet boilerplate (ref + modalProps + present/dismiss
  // effect) is provided by useStandardBottomSheet.
  const { ref: bottomSheetRef, modalProps } = useStandardBottomSheet({
    visible,
    onDismiss: onClose,
    snapPoints: ['65%'],
    keyboardBehavior: 'interactive',
  });

  // Form state
  const [skillLevel, setSkillLevel] = useState('');
  const [prepTime, setPrepTime] = useState('');
  const [cookTime, setCookTime] = useState('');
  const [budget, setBudget] = useState('');
  const [saving, setSaving] = useState(false);

  // Reset form when modal opens (render-time conditional state update)
  const [prevVisible, setPrevVisible] = useState(visible);
  const [prevInitialValues, setPrevInitialValues] = useState(initialValues);
  if (visible !== prevVisible || initialValues !== prevInitialValues) {
    setPrevVisible(visible);
    setPrevInitialValues(initialValues);
    if (visible) {
      setSkillLevel(initialValues?.cookingSkillLevel || '');
      setPrepTime(initialValues?.maxPrepTimeMinutes?.toString() || '');
      setCookTime(initialValues?.maxCookTimeMinutes?.toString() || '');
      setBudget(initialValues?.budgetPerMeal?.toString() || '');
    }
  }

  const handleSave = async () => {
    const updates: {
      cookingSkillLevel?: string;
      maxPrepTimeMinutes?: number;
      maxCookTimeMinutes?: number;
      budgetPerMeal?: number;
    } = {};

    // Validate and add skill level if provided
    if (skillLevel.trim()) {
      updates.cookingSkillLevel = skillLevel.trim();
    }

    // Validate and add prep time if provided
    if (prepTime) {
      const prepTimeValue = parseInt(prepTime);
      if (
        isNaN(prepTimeValue) ||
        prepTimeValue < DIETARY_LIMITS.prepTime.min ||
        prepTimeValue > DIETARY_LIMITS.prepTime.max
      ) {
        alertService.alert(
          'Invalid Input',
          `Prep time must be between ${DIETARY_LIMITS.prepTime.min} and ${DIETARY_LIMITS.prepTime.max} minutes`,
        );
        return;
      }
      updates.maxPrepTimeMinutes = prepTimeValue;
    }

    // Validate and add cook time if provided
    if (cookTime) {
      const cookTimeValue = parseInt(cookTime);
      if (
        isNaN(cookTimeValue) ||
        cookTimeValue < DIETARY_LIMITS.cookTime.min ||
        cookTimeValue > DIETARY_LIMITS.cookTime.max
      ) {
        alertService.alert(
          'Invalid Input',
          `Cook time must be between ${DIETARY_LIMITS.cookTime.min} and ${DIETARY_LIMITS.cookTime.max} minutes`,
        );
        return;
      }
      updates.maxCookTimeMinutes = cookTimeValue;
    }

    // Validate and add budget if provided
    if (budget) {
      const budgetValue = parseFloat(budget);
      if (
        isNaN(budgetValue) ||
        budgetValue < DIETARY_LIMITS.budget.min ||
        budgetValue > DIETARY_LIMITS.budget.max
      ) {
        alertService.alert(
          'Invalid Input',
          `Budget must be between $${DIETARY_LIMITS.budget.min} and $${DIETARY_LIMITS.budget.max}`,
        );
        return;
      }
      updates.budgetPerMeal = budgetValue;
    }

    setSaving(true);
    const success = await onSave(updates);
    setSaving(false);

    if (!success) {
      alertService.alert('Error', 'Failed to update cooking preferences');
    }
  };

  return (
    <BottomSheetModal ref={bottomSheetRef} {...modalProps}>
      <BottomSheetScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.contentContainer,
          { paddingBottom: insets.bottom + 16 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <BottomSheetHeader
          title="Cooking Preferences"
          onCancel={onClose}
          onConfirm={handleSave}
          confirmLabel="Save"
          confirmDisabled={saving}
        />

        {/* Skill Level Picker */}
        <View style={styles.section}>
          <Text style={styles.label}>Cooking Skill Level</Text>
          <View style={styles.pickerContainer}>
            <Picker
              selectedValue={skillLevel}
              onValueChange={setSkillLevel}
              style={styles.picker}
            >
              <Picker.Item label="Select skill level..." value="" />
              {SKILL_LEVELS.map(level => (
                <Picker.Item key={level} label={level} value={level} />
              ))}
            </Picker>
          </View>
        </View>

        {/* Max Prep Time */}
        <View style={styles.section}>
          <FormInput
            label="Max Prep Time (minutes)"
            value={prepTime}
            onChangeText={setPrepTime}
            keyboardType="number-pad"
            placeholder="e.g., 30"
            useBottomSheetInput
          />
        </View>

        {/* Max Cook Time */}
        <View style={styles.section}>
          <FormInput
            label="Max Cook Time (minutes)"
            value={cookTime}
            onChangeText={setCookTime}
            keyboardType="number-pad"
            placeholder="e.g., 60"
            useBottomSheetInput
          />
        </View>

        {/* Budget per Meal */}
        <View style={styles.section}>
          <FormInput
            label="Budget per Meal ($)"
            value={budget}
            onChangeText={setBudget}
            keyboardType="decimal-pad"
            placeholder="e.g., 15.00"
            useBottomSheetInput
          />
        </View>
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
};

const styles = StyleSheet.create(theme => ({
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    padding: theme.spacing.md,
  },
  section: {
    marginBottom: theme.spacing.lg,
  },
  label: {
    fontSize: theme.fonts.size.base,
    fontWeight: theme.fonts.weight.medium,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.sm,
  },
  pickerContainer: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: 'hidden',
  },
  picker: {
    backgroundColor: 'transparent',
  },
}));
