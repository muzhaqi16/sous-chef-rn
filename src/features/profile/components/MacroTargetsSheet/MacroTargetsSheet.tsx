import React, { useState } from 'react';
import { SheetHeader } from '#components/templates/SheetHeader';
import { View } from 'react-native';
import { Controller, useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { useTranslation } from '#i18n';
import { alertService } from '#services/alertService';
import { Sheet } from '#components/templates/Sheet';
import { SheetHeaderSlot } from '#components/templates/SheetHeaderSlot';
import { useOpening } from '#hooks/ui/useOpening';
import { StyleSheet } from 'react-native-unistyles';
import { FormInput } from '#components/atoms/FormInput';
import { Text } from '#components/atoms/Text';
import {
  macroTargetsSchema,
  macroTargetsDefaults,
  macroTargetUpdates,
  type MacroTargetUpdates,
  type MacroTargetsFormValues,
} from './macroTargetsFormConfig';
import { reportValidationErrors } from '#utils/validation/common';
import { useSheetUnsavedInput } from '#components/templates/SheetCloseGuard';

interface MacroTargetsSheetProps {
  visible: boolean;
  onClose: () => void;
  /** A target emptied from a stored one arrives as null, which clears it. */
  onSave: (values: MacroTargetUpdates) => Promise<boolean>;
  initialValues?: {
    calorieTarget?: number | null;
    proteinTarget?: number | null;
    carbsTarget?: number | null;
    fatTarget?: number | null;
  };
}

type MacroTargetsInitial = MacroTargetsSheetProps['initialValues'];

export const MacroTargetsSheet: React.FC<MacroTargetsSheetProps> = ({
  visible,
  onClose,
  onSave,
  initialValues,
}) => {
  // Each opening starts from the targets as they stood when it opened: a
  // background profile refresh, which rebuilds `initialValues`, never resets
  // what the person is typing.
  const opening = useOpening(visible, initialValues);

  return (
    <Sheet
      mode="form"
      visible={visible}
      onDismiss={onClose}
      headerFromContent
      snapPoints={['65%']}
      style={styles.scrollView}
      contentContainerStyle={styles.contentContainer}
    >
      {opening ? (
        <MacroTargetsForm
          key={opening.id}
          initialValues={opening.payload}
          onClose={onClose}
          onSave={onSave}
        />
      ) : null}
    </Sheet>
  );
};

const seedOf = (initial: MacroTargetsInitial): MacroTargetsFormValues => ({
  ...macroTargetsDefaults(),
  calories: initial?.calorieTarget?.toString() ?? '',
  protein: initial?.proteinTarget?.toString() ?? '',
  carbs: initial?.carbsTarget?.toString() ?? '',
  fat: initial?.fatTarget?.toString() ?? '',
});

/** One opening's form, seeded once from the targets it opened on. */
const MacroTargetsForm: React.FC<
  Pick<MacroTargetsSheetProps, 'onClose' | 'onSave' | 'initialValues'>
> = ({ onClose, onSave, initialValues }) => {
  const { t } = useTranslation();

  const {
    control,
    handleSubmit,
    formState: { isDirty },
  } = useForm<MacroTargetsFormValues>({
    resolver: yupResolver(macroTargetsSchema),
    defaultValues: seedOf(initialValues),
  });
  useSheetUnsavedInput(isDirty);
  const [saving, setSaving] = useState(false);

  // Reaching here means every target is in range; a refusal renders under the
  // field it is about. A failed SAVE is not a field the user can edit, so it
  // stays an alert.
  const handleSave = handleSubmit(async values => {
    setSaving(true);
    const success = await onSave(
      macroTargetUpdates(values, initialValues ?? {}),
    );
    setSaving(false);

    if (!success) {
      alertService.alert(t('labels.error'), t('macroTargets.updateFailed'));
    }
  }, reportValidationErrors);

  return (
    <>
      <SheetHeaderSlot>
        <SheetHeader
          title={t('macroTargets.title')}
          onClose={onClose}
          confirm={{
            onPress: () => {
              void handleSave();
            },
            loading: saving,
          }}
        />
      </SheetHeaderSlot>
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
            />
          )}
        />
      </View>
    </>
  );
};

const styles = StyleSheet.create(theme => ({
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    paddingVertical: theme.spacing.md,
  },
  description: {
    marginBottom: theme.spacing.lg,
  },
  section: {
    marginBottom: theme.spacing.lg,
  },
}));
