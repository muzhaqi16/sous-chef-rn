import React, { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { BottomSheetModal } from '#hooks/useStandardBottomSheet';
import { alertService } from '#/services/alertService';
import { Picker } from '@react-native-picker/picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStandardBottomSheet } from '#hooks/useStandardBottomSheet';
import { StyleSheet } from 'react-native-unistyles';
import { FormInput } from '#components/molecules/FormInput';
import { BottomSheetHeader } from '#components/atoms/BottomSheetHeader';
import { SKILL_LEVELS, DIETARY_LIMITS } from '#/constants/dietary';
import { Text } from '#components/atoms/Text';

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
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  // Standard bottom-sheet boilerplate (ref + modalProps + present/dismiss
  // effect) is provided by useStandardBottomSheet.
  const { ref: bottomSheetRef, modalProps } = useStandardBottomSheet({
    visible,
    onDismiss: onClose,
    snapPoints: ['65%'],
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
          t('cookingPreferences.invalidInputTitle'),
          t('cookingPreferences.prepTimeRange', {
            min: DIETARY_LIMITS.prepTime.min,
            max: DIETARY_LIMITS.prepTime.max,
          }),
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
          t('cookingPreferences.invalidInputTitle'),
          t('cookingPreferences.cookTimeRange', {
            min: DIETARY_LIMITS.cookTime.min,
            max: DIETARY_LIMITS.cookTime.max,
          }),
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
          t('cookingPreferences.invalidInputTitle'),
          t('cookingPreferences.budgetRange', {
            min: DIETARY_LIMITS.budget.min,
            max: DIETARY_LIMITS.budget.max,
          }),
        );
        return;
      }
      updates.budgetPerMeal = budgetValue;
    }

    setSaving(true);
    const success = await onSave(updates);
    setSaving(false);

    if (!success) {
      alertService.alert(
        t('labels.error'),
        t('cookingPreferences.updateFailed'),
      );
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
          title={t('cookingPreferences.title')}
          onCancel={onClose}
          onConfirm={handleSave}
          confirmLabel={t('cookingPreferences.save')}
          confirmDisabled={saving}
        />

        {/* Skill Level Picker */}
        <View style={styles.section}>
          <Text size="base" weight="medium" style={styles.label}>
            {t('cookingPreferences.skillLevel')}
          </Text>
          <View style={styles.pickerContainer}>
            <Picker
              selectedValue={skillLevel}
              onValueChange={setSkillLevel}
              style={styles.picker}
            >
              <Picker.Item
                label={t('cookingPreferences.selectSkillLevel')}
                value=""
              />
              {SKILL_LEVELS.map(level => (
                <Picker.Item key={level} label={level} value={level} />
              ))}
            </Picker>
          </View>
        </View>

        {/* Max Prep Time */}
        <View style={styles.section}>
          <FormInput
            label={t('cookingPreferences.maxPrepTime')}
            value={prepTime}
            onChangeText={setPrepTime}
            keyboardType="number-pad"
            placeholder={t('cookingPreferences.prepTimePlaceholder')}
            useBottomSheetInput
          />
        </View>

        {/* Max Cook Time */}
        <View style={styles.section}>
          <FormInput
            label={t('cookingPreferences.maxCookTime')}
            value={cookTime}
            onChangeText={setCookTime}
            keyboardType="number-pad"
            placeholder={t('cookingPreferences.cookTimePlaceholder')}
            useBottomSheetInput
          />
        </View>

        {/* Budget per Meal */}
        <View style={styles.section}>
          <FormInput
            label={t('cookingPreferences.budgetPerMeal')}
            value={budget}
            onChangeText={setBudget}
            keyboardType="decimal-pad"
            placeholder={t('cookingPreferences.budgetPlaceholder')}
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
    marginBottom: theme.spacing.sm,
  },
  pickerContainer: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.md,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: 'hidden',
  },
  picker: {
    backgroundColor: 'transparent',
  },
}));
