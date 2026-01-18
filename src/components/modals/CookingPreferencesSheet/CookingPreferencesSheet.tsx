import React, { useState, useCallback, useEffect, useRef } from 'react';
import { View, Text, Alert } from 'react-native';
import {
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetBackdrop,
} from '@gorhom/bottom-sheet';
import { Picker } from '@react-native-picker/picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSharedBottomSheetConfigs } from '#hooks';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { FormInput } from '#components/molecules/FormInput';
import { BottomSheetHeader } from '#components/atoms';
import { SKILL_LEVELS, DIETARY_LIMITS } from '#/constants';

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

export const CookingPreferencesSheet: React.FC<CookingPreferencesSheetProps> = ({
  visible,
  onClose,
  onSave,
  initialValues,
}) => {
  const { theme } = useUnistyles();
  const insets = useSafeAreaInsets();
  const bottomSheetRef = useRef<BottomSheetModal>(null);
  const animationConfigs = useSharedBottomSheetConfigs();

  // Form state
  const [skillLevel, setSkillLevel] = useState('');
  const [prepTime, setPrepTime] = useState('');
  const [cookTime, setCookTime] = useState('');
  const [budget, setBudget] = useState('');
  const [saving, setSaving] = useState(false);

  // Control bottom sheet visibility based on visible prop
  useEffect(() => {
    if (visible) {
      bottomSheetRef.current?.present();
      // Reset form when modal opens
      setSkillLevel(initialValues?.cookingSkillLevel || '');
      setPrepTime(initialValues?.maxPrepTimeMinutes?.toString() || '');
      setCookTime(initialValues?.maxCookTimeMinutes?.toString() || '');
      setBudget(initialValues?.budgetPerMeal?.toString() || '');
    } else {
      bottomSheetRef.current?.dismiss();
    }
  }, [visible, initialValues]);

  const handleSave = useCallback(async () => {
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
        Alert.alert(
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
        Alert.alert(
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
        Alert.alert(
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
      Alert.alert('Error', 'Failed to update cooking preferences');
    }
  }, [skillLevel, prepTime, cookTime, budget, onSave]);

  return (
    <BottomSheetModal
      ref={bottomSheetRef}
      snapPoints={['65%']}
      enablePanDownToClose
      enableDynamicSizing={false}
      topInset={insets.top}
      onDismiss={onClose}
      animationConfigs={animationConfigs}
      backgroundStyle={{ backgroundColor: theme.colors.background }}
      handleIndicatorStyle={{ backgroundColor: theme.colors.textSecondary }}
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      backdropComponent={props => (
        <BottomSheetBackdrop
          {...props}
          disappearsOnIndex={-1}
          appearsOnIndex={0}
          pressBehavior="close"
        />
      )}
    >
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
