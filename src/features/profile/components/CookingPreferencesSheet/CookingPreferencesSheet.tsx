import React, { useState } from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { Controller, useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { object, string, type ObjectSchema } from 'yup';
import { useTranslation } from '#/i18n';
import { alertService } from '#/services/alertService';
import { Sheet } from '#components/templates/Sheet';
import { SheetHeader } from '#components/templates/SheetHeader';
import { SheetHeaderSlot } from '#components/templates/SheetHeaderSlot';
import { FormInput } from '#components/atoms/FormInput';
import { DIETARY_LIMITS } from '#domain/dietary';
import { useOpening } from '#hooks/ui/useOpening';
import { lazyMessage, reportValidationErrors } from '#/utils/validation/common';

interface CookingPreferencesFormValues {
  /** Minutes as typed; blank is no limit. */
  cookTime: string;
}

const cookingPreferencesSchema: ObjectSchema<CookingPreferencesFormValues> =
  object({
    cookTime: string()
      .defined()
      .test(
        'within-range',
        lazyMessage(
          'cookingPreferences.cookTimeRange',
          DIETARY_LIMITS.cookTime,
        ),
        value => {
          if (!value) return true;
          const minutes = parseInt(value);
          const { min, max } = DIETARY_LIMITS.cookTime;
          return !isNaN(minutes) && minutes >= min && minutes <= max;
        },
      ),
  });

interface CookingPreferencesSheetProps {
  visible: boolean;
  onClose: () => void;
  /** An emptied limit arrives as null, which clears it. */
  onSave: (values: { maxCookTimeMinutes?: number | null }) => Promise<boolean>;
  initialValues?: { maxCookTimeMinutes?: number | null };
}

type CookingPreferencesFormProps = Omit<
  CookingPreferencesSheetProps,
  'visible'
>;

const CookingPreferencesForm: React.FC<CookingPreferencesFormProps> = ({
  onClose,
  onSave,
  initialValues,
}) => {
  const { t } = useTranslation();
  const [saving, setSaving] = useState(false);
  const stored = initialValues?.maxCookTimeMinutes;
  const { control, handleSubmit } = useForm<CookingPreferencesFormValues>({
    resolver: yupResolver(cookingPreferencesSchema),
    defaultValues: { cookTime: stored?.toString() ?? '' },
  });

  const save = handleSubmit(async ({ cookTime }) => {
    const updates: { maxCookTimeMinutes?: number | null } = {};
    if (cookTime) updates.maxCookTimeMinutes = parseInt(cookTime);
    // Left blank sends nothing; emptied from a stored limit, it clears it.
    else if (stored != null) updates.maxCookTimeMinutes = null;

    setSaving(true);
    const success = await onSave(updates);
    setSaving(false);

    if (!success) {
      alertService.alert(
        t('labels.error'),
        t('cookingPreferences.updateFailed'),
      );
    }
  }, reportValidationErrors);

  return (
    <>
      <SheetHeaderSlot>
        <SheetHeader
          title={t('labels.cookingPreferences')}
          onClose={onClose}
          confirm={{
            onPress: () => {
              void save();
            },
            loading: saving,
          }}
        />
      </SheetHeaderSlot>
      <View style={styles.section}>
        <Controller
          control={control}
          name="cookTime"
          render={({ field, fieldState }) => (
            <FormInput
              label={t('cookingPreferences.maxCookTime')}
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              error={fieldState.error?.message}
              keyboardType="number-pad"
              placeholder={t('cookingPreferences.cookTimePlaceholder')}
              useBottomSheetInput
            />
          )}
        />
      </View>
    </>
  );
};

/** The longest cooking time the user wants, which Recipes' search filters by. */
export const CookingPreferencesSheet: React.FC<
  CookingPreferencesSheetProps
> = ({ visible, ...form }) => {
  const opening = useOpening(visible, form.initialValues);

  return (
    <Sheet
      mode="form"
      headerFromContent
      visible={visible}
      onDismiss={form.onClose}
      snapPoints={['40%']}
      style={styles.scrollView}
      contentContainerStyle={styles.contentContainer}
    >
      {opening ? (
        <CookingPreferencesForm
          key={opening.id}
          {...form}
          initialValues={opening.payload}
        />
      ) : null}
    </Sheet>
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
}));
