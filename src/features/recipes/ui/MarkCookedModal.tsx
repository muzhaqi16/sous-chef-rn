import React, { useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { SheetHeader } from '#components/templates/SheetHeader';
import { View } from 'react-native';
import { useTranslation } from '#i18n';
import { StyleSheet } from 'react-native-unistyles';
import { BaseSwitch } from '#components/atoms/BaseSwitch';
import { FractionInput } from '#components/molecules/FractionInput';
import { FormInput } from '#components/atoms/FormInput';
import { recipesTestIDs } from '#features/recipes/testIDs';
import { reportValidationErrors } from '#utils/validation/common';
import { Text } from '#components/atoms/Text';
import { Sheet } from '#components/templates/Sheet';
import { SheetHeaderSlot } from '#components/templates/SheetHeaderSlot';
import { useOpening } from '#hooks/ui/useOpening';
import type { CookConfirmOutcome } from '#features/recipes/types';
import {
  cookedServings,
  plannedMealCookedSchema,
  recipeCookedSchema,
  type MarkCookedFormValues,
} from './markCookedFormConfig';
import { useSheetUnsavedInput } from '#components/templates/SheetCloseGuard';

interface MarkCookedModalProps {
  visible: boolean;
  recipeName: string;
  defaultServings: number;
  onClose: () => void;
  /** Closes the sheet unless the cook answers that it stays open. */
  onConfirm: (input: {
    servings: number;
    deductFromPantry: boolean;
    useGranularDeduction: boolean;
    notes?: string;
  }) => void | Promise<CookConfirmOutcome>;
  hasPantry?: boolean;
  /** A planned meal records whole servings; a recipe cook scales by any amount. */
  wholeServings?: boolean;
}

type MarkCookedFormProps = Omit<MarkCookedModalProps, 'visible'>;

/** One opening, on the recipe's servings with the pantry deducted. */
const MarkCookedForm: React.FC<MarkCookedFormProps> = ({
  recipeName,
  defaultServings,
  onClose,
  onConfirm,
  hasPantry = false,
  wholeServings = false,
}) => {
  const { t } = useTranslation();

  const {
    control,
    handleSubmit,
    setValue,
    formState: { isSubmitting, isDirty },
  } = useForm<MarkCookedFormValues>({
    resolver: yupResolver(
      wholeServings ? plannedMealCookedSchema : recipeCookedSchema,
    ),
    defaultValues: {
      servings: String(defaultServings),
      deductFromPantry: true,
      useGranularDeduction: true,
      notes: '',
    },
    mode: 'onTouched',
  });
  useSheetUnsavedInput(isDirty);
  const [deductFromPantry, useGranularDeduction] = useWatch({
    control,
    name: ['deductFromPantry', 'useGranularDeduction'],
  });
  const [reviewUnavailable, setReviewUnavailable] = useState(false);

  const onValid = async (values: MarkCookedFormValues) => {
    const outcome = await onConfirm({
      servings: cookedServings(values, defaultServings),
      deductFromPantry: values.deductFromPantry,
      useGranularDeduction:
        values.deductFromPantry && hasPantry && values.useGranularDeduction,
      notes: values.notes || undefined,
    });
    if (outcome === 'retry') return;
    if (outcome === 'reviewUnavailable') {
      // Confirmed again, the cook deducts what the recipe uses, unreviewed.
      setValue('useGranularDeduction', false);
      setReviewUnavailable(true);
      return;
    }
    onClose();
  };

  return (
    <>
      <SheetHeaderSlot>
        <SheetHeader
          title={t('markCookedModal.markCooked')}
          onClose={onClose}
          confirm={{
            onPress: () => {
              void handleSubmit(onValid, reportValidationErrors)();
            },
            accessibilityLabel: t('markCookedModal.markCooked'),
            loading: isSubmitting,
            testID: recipesTestIDs.cookConfirm,
          }}
        />
      </SheetHeaderSlot>

      {/* Recipe Info */}
      <View style={styles.recipeInfo}>
        <Text role="bodyStrong" numberOfLines={2}>
          {recipeName}
        </Text>
      </View>

      {/* Servings Input */}
      <View style={styles.section}>
        <Controller
          control={control}
          name="servings"
          render={({ field, fieldState }) => (
            <FractionInput
              label={t('markCookedModal.servingsMade')}
              value={field.value}
              onChangeText={field.onChange}
              placeholder={t('markCookedModal.servingsPlaceholderPrefix', {
                count: defaultServings || 1,
              })}
              error={fieldState.error?.message}
              testID={recipesTestIDs.cookServings}
            />
          )}
        />
      </View>

      {/* Deduct from Pantry Toggle */}
      <View style={styles.toggleSection}>
        <View style={styles.toggleInfo}>
          <Text role="bodyStrong">{t('markCookedModal.deductFromPantry')}</Text>
          <Text
            role="caption"
            tone="secondary"
            style={styles.toggleDescription}
          >
            {t('markCookedModal.deductFromPantryDesc')}
          </Text>
        </View>
        <Controller
          control={control}
          name="deductFromPantry"
          render={({ field }) => (
            <BaseSwitch
              accessibilityLabel={t('markCookedModal.deductFromPantry')}
              value={field.value}
              onValueChange={field.onChange}
            />
          )}
        />
      </View>

      {/* Deduction Mode - only shown when deductFromPantry is ON and user has a pantry */}
      {!!deductFromPantry && !!hasPantry && (
        <View style={styles.toggleSection}>
          <View style={styles.toggleInfo}>
            <Text role="bodyStrong">{t('markCookedModal.smartDeduction')}</Text>
            <Text
              role="caption"
              tone="secondary"
              style={styles.toggleDescription}
            >
              {t('markCookedModal.smartDeductionDesc')}
            </Text>
          </View>
          <Controller
            control={control}
            name="useGranularDeduction"
            render={({ field }) => (
              <BaseSwitch
                accessibilityLabel={t('markCookedModal.smartDeduction')}
                value={field.value}
                onValueChange={field.onChange}
              />
            )}
          />
        </View>
      )}
      {reviewUnavailable && deductFromPantry && !useGranularDeduction ? (
        <Text
          role="caption"
          tone="warning"
          testID={recipesTestIDs.cookReviewUnavailable}
        >
          {t('markCookedModal.reviewUnavailable', {
            action: t('markCookedModal.markCooked'),
          })}
        </Text>
      ) : null}

      {/* Notes (Optional) */}
      <View style={styles.section}>
        <Controller
          control={control}
          name="notes"
          render={({ field }) => (
            <FormInput
              ref={field.ref}
              label={t('labels.notesOptional')}
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              placeholder={t('markCookedModal.notesPlaceholder')}
              multiline
              numberOfLines={2}
            />
          )}
        />
      </View>
    </>
  );
};

export const MarkCookedModal: React.FC<MarkCookedModalProps> = ({
  visible,
  ...form
}) => {
  const opening = useOpening(visible);

  return (
    <Sheet
      mode="form"
      headerFromContent
      visible={visible}
      onDismiss={form.onClose}
      snapPoints={['55%']}
      contentContainerStyle={styles.contentContainer}
      style={styles.scrollView}
    >
      {opening ? <MarkCookedForm key={opening.id} {...form} /> : null}
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
  recipeInfo: {
    marginBottom: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.base,
    backgroundColor: theme.colors.surfaceVariant,
    borderRadius: theme.radii.md,
    borderCurve: 'continuous',
  },
  section: {
    marginBottom: theme.spacing.lg,
  },
  toggleSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.md,
    borderCurve: 'continuous',
  },
  toggleInfo: {
    flex: 1,
    marginRight: theme.spacing.md,
  },
  toggleDescription: {
    marginTop: theme.spacing.xs,
  },
}));
