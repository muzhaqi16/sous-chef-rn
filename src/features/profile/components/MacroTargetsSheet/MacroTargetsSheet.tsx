import React, { useState } from 'react';
import { View } from 'react-native';
import { Controller, useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { useTranslation } from '#/i18n';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { BottomSheetModal } from '#hooks/useStandardBottomSheet';
import { alertService } from '#/services/alertService';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStandardBottomSheet } from '#hooks/useStandardBottomSheet';
import { StyleSheet } from 'react-native-unistyles';
import { FormInput } from '#components/atoms/FormInput';
import { BottomSheetHeader } from '#components/molecules/BottomSheetHeader';
import { Text } from '#components/atoms/Text';
import {
  macroTargetsSchema,
  macroTargetsDefaults,
  macroTargetUpdates,
  type MacroTargetsFormValues,
} from './macroTargetsFormConfig';

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

  const { control, handleSubmit, reset } = useForm<MacroTargetsFormValues>({
    resolver: yupResolver(macroTargetsSchema),
    defaultValues: macroTargetsDefaults(),
  });
  const [saving, setSaving] = useState(false);

  // Reset form when modal opens (render-time conditional state update)
  const [prevVisible, setPrevVisible] = useState(visible);
  const [prevInitialValues, setPrevInitialValues] = useState(initialValues);
  if (visible !== prevVisible || initialValues !== prevInitialValues) {
    setPrevVisible(visible);
    setPrevInitialValues(initialValues);
    if (visible) {
      reset({
        calories: initialValues?.calorieTarget?.toString() || '',
        protein: initialValues?.proteinTarget?.toString() || '',
        carbs: initialValues?.carbsTarget?.toString() || '',
        fat: initialValues?.fatTarget?.toString() || '',
      });
    }
  }

  // Reaching here means every target is in range; a refusal renders under the
  // field it is about. A failed SAVE is not a field the user can edit, so it
  // stays an alert.
  const handleSave = handleSubmit(async values => {
    setSaving(true);
    const success = await onSave(macroTargetUpdates(values));
    setSaving(false);

    if (!success) {
      alertService.alert(t('labels.error'), t('macroTargets.updateFailed'));
    }
  });

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
          confirmLabel={t('labels.save')}
          confirmDisabled={saving}
        />

        {/* Description */}
        <Text role="caption" tone="secondary" style={styles.description}>
          {t('macroTargets.subtitle')}
        </Text>

        {/* Daily Calories */}
        <View style={styles.section}>
          <Controller
            control={control}
            name="calories"
            render={({ field, fieldState }) => (
              <FormInput
                label={t('macroTargets.dailyCalories')}
                value={field.value}
                onChangeText={field.onChange}
                error={fieldState.error?.message}
                keyboardType="number-pad"
                placeholder={t('macroTargets.caloriesPlaceholder')}
                useBottomSheetInput
              />
            )}
          />
        </View>

        {/* Protein */}
        <View style={styles.section}>
          <Controller
            control={control}
            name="protein"
            render={({ field, fieldState }) => (
              <FormInput
                label={t('labels.proteinG')}
                value={field.value}
                onChangeText={field.onChange}
                error={fieldState.error?.message}
                keyboardType="number-pad"
                placeholder={t('macroTargets.proteinPlaceholder')}
                useBottomSheetInput
              />
            )}
          />
        </View>

        {/* Carbs */}
        <View style={styles.section}>
          <Controller
            control={control}
            name="carbs"
            render={({ field, fieldState }) => (
              <FormInput
                label={t('labels.carbsG')}
                value={field.value}
                onChangeText={field.onChange}
                error={fieldState.error?.message}
                keyboardType="number-pad"
                placeholder={t('macroTargets.carbsPlaceholder')}
                useBottomSheetInput
              />
            )}
          />
        </View>

        {/* Fat */}
        <View style={styles.section}>
          <Controller
            control={control}
            name="fat"
            render={({ field, fieldState }) => (
              <FormInput
                label={t('macroTargets.fat')}
                value={field.value}
                onChangeText={field.onChange}
                error={fieldState.error?.message}
                keyboardType="number-pad"
                placeholder={t('macroTargets.fatPlaceholder')}
                useBottomSheetInput
              />
            )}
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
