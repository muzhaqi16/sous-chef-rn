import React, { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from '#/i18n';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { BottomSheetModal } from '#hooks/useStandardBottomSheet';
import { alertService } from '#/services/alertService';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStandardBottomSheet } from '#hooks/useStandardBottomSheet';
import { StyleSheet } from 'react-native-unistyles';
import { FormInput } from '#components/molecules/FormInput';
import { BottomSheetHeader } from '#components/atoms/BottomSheetHeader';
import { DIETARY_LIMITS } from '#/constants/dietary';
import { Text } from '#components/atoms/Text';

interface MacroTargetsSheetProps {
  visible: boolean;
  onClose: () => void;
  onSave: (values: {
    calorieTarget?: number;
    proteinTarget?: number;
    carbsTarget?: number;
    fatTarget?: number;
  }) => Promise<boolean>;
  initialValues?: {
    calorieTarget?: number | null;
    proteinTarget?: number | null;
    carbsTarget?: number | null;
    fatTarget?: number | null;
  };
}

export const MacroTargetsSheet: React.FC<MacroTargetsSheetProps> = ({
  visible,
  onClose,
  onSave,
  initialValues,
}) => {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  // Standard bottom-sheet boilerplate handled by useStandardBottomSheet.
  const { ref: bottomSheetRef, modalProps } = useStandardBottomSheet({
    visible,
    onDismiss: onClose,
    snapPoints: ['65%'],
  });

  // Form state
  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');
  const [saving, setSaving] = useState(false);

  // Reset form when modal opens (render-time conditional state update)
  const [prevVisible, setPrevVisible] = useState(visible);
  const [prevInitialValues, setPrevInitialValues] = useState(initialValues);
  if (visible !== prevVisible || initialValues !== prevInitialValues) {
    setPrevVisible(visible);
    setPrevInitialValues(initialValues);
    if (visible) {
      setCalories(initialValues?.calorieTarget?.toString() || '');
      setProtein(initialValues?.proteinTarget?.toString() || '');
      setCarbs(initialValues?.carbsTarget?.toString() || '');
      setFat(initialValues?.fatTarget?.toString() || '');
    }
  }

  const handleSave = async () => {
    const updates: {
      calorieTarget?: number;
      proteinTarget?: number;
      carbsTarget?: number;
      fatTarget?: number;
    } = {};

    // Validate and add calories if provided
    if (calories) {
      const caloriesValue = parseInt(calories);
      if (
        isNaN(caloriesValue) ||
        caloriesValue < DIETARY_LIMITS.calories.min ||
        caloriesValue > DIETARY_LIMITS.calories.max
      ) {
        alertService.alert(
          t('macroTargets.invalidInputTitle'),
          t('macroTargets.caloriesRange', {
            min: DIETARY_LIMITS.calories.min,
            max: DIETARY_LIMITS.calories.max,
          }),
        );
        return;
      }
      updates.calorieTarget = caloriesValue;
    }

    // Validate and add protein if provided
    if (protein) {
      const proteinValue = parseInt(protein);
      if (
        isNaN(proteinValue) ||
        proteinValue < DIETARY_LIMITS.protein.min ||
        proteinValue > DIETARY_LIMITS.protein.max
      ) {
        alertService.alert(
          t('macroTargets.invalidInputTitle'),
          t('macroTargets.proteinRange', {
            min: DIETARY_LIMITS.protein.min,
            max: DIETARY_LIMITS.protein.max,
          }),
        );
        return;
      }
      updates.proteinTarget = proteinValue;
    }

    // Validate and add carbs if provided
    if (carbs) {
      const carbsValue = parseInt(carbs);
      if (
        isNaN(carbsValue) ||
        carbsValue < DIETARY_LIMITS.carbs.min ||
        carbsValue > DIETARY_LIMITS.carbs.max
      ) {
        alertService.alert(
          t('macroTargets.invalidInputTitle'),
          t('macroTargets.carbsRange', {
            min: DIETARY_LIMITS.carbs.min,
            max: DIETARY_LIMITS.carbs.max,
          }),
        );
        return;
      }
      updates.carbsTarget = carbsValue;
    }

    // Validate and add fat if provided
    if (fat) {
      const fatValue = parseInt(fat);
      if (
        isNaN(fatValue) ||
        fatValue < DIETARY_LIMITS.fat.min ||
        fatValue > DIETARY_LIMITS.fat.max
      ) {
        alertService.alert(
          t('macroTargets.invalidInputTitle'),
          t('macroTargets.fatRange', {
            min: DIETARY_LIMITS.fat.min,
            max: DIETARY_LIMITS.fat.max,
          }),
        );
        return;
      }
      updates.fatTarget = fatValue;
    }

    setSaving(true);
    const success = await onSave(updates);
    setSaving(false);

    if (!success) {
      alertService.alert(t('labels.error'), t('macroTargets.updateFailed'));
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
          title={t('macroTargets.title')}
          onCancel={onClose}
          onConfirm={handleSave}
          confirmLabel={t('macroTargets.save')}
          confirmDisabled={saving}
        />

        {/* Description */}
        <Text size="sm" tone="secondary" style={styles.description}>
          {t('macroTargets.subtitle')}
        </Text>

        {/* Daily Calories */}
        <View style={styles.section}>
          <FormInput
            label={t('macroTargets.dailyCalories')}
            value={calories}
            onChangeText={setCalories}
            keyboardType="number-pad"
            placeholder={t('macroTargets.caloriesPlaceholder')}
            useBottomSheetInput
          />
        </View>

        {/* Protein */}
        <View style={styles.section}>
          <FormInput
            label={t('macroTargets.protein')}
            value={protein}
            onChangeText={setProtein}
            keyboardType="number-pad"
            placeholder={t('macroTargets.proteinPlaceholder')}
            useBottomSheetInput
          />
        </View>

        {/* Carbs */}
        <View style={styles.section}>
          <FormInput
            label={t('macroTargets.carbs')}
            value={carbs}
            onChangeText={setCarbs}
            keyboardType="number-pad"
            placeholder={t('macroTargets.carbsPlaceholder')}
            useBottomSheetInput
          />
        </View>

        {/* Fat */}
        <View style={styles.section}>
          <FormInput
            label={t('macroTargets.fat')}
            value={fat}
            onChangeText={setFat}
            keyboardType="number-pad"
            placeholder={t('macroTargets.fatPlaceholder')}
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
  description: {
    marginBottom: theme.spacing.lg,
  },
  section: {
    marginBottom: theme.spacing.lg,
  },
}));
