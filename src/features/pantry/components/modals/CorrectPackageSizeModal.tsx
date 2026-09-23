import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Controller, useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { useTranslation } from '#/i18n';
import { useFragment } from '@apollo/client/react';
import { FormInput } from '#components/atoms/FormInput';
import { UnitAutocompleteField } from '#features/catalog/ui/autocomplete/UnitAutocompleteField';
import { BottomSheetHeader } from '#components/molecules/BottomSheetHeader';
import { commonStyles } from '#/styles/commonStyles';
import { formatNetWeightDisplay } from '#features/pantry/hooks/usePantryItemTransformation';
import { Text } from '#components/atoms/Text';
import {
  CorrectPackageSizeModal_BatchFragmentDoc,
  CorrectPackageSizeModal_PantryItemFragmentDoc,
} from './CorrectPackageSizeModal.generated';
import {
  formatNumberForInput,
  localizeNumericHint,
} from '#/utils/formatters/number';
import { getUnitDisplayText } from '#/utils/formatQuantity';
import { Sheet } from '#components/templates/Sheet';
import {
  correctWeightSchema,
  correctWeightDefaults,
  parseWeight,
  type CorrectWeightFormValues,
} from './correctWeightFormConfig';
import { logValidationErrors } from '#/utils/validation/common';

export interface PackageSizeCorrectionInput {
  netWeight: number;
  netWeightUnitId: string;
  reason: string;
}

interface CorrectPackageSizeModalProps {
  visible: boolean;
  pantryItemId: string;
  batchId: string | null;
  onClose: () => void;
  /** Resolves true once the correction stands; a refusal keeps the sheet open. */
  onConfirm: (input: PackageSizeCorrectionInput) => Promise<boolean>;
}

/** Corrects ONE batch's package size; the stack's default is edited elsewhere. */
export const CorrectPackageSizeModal: React.FC<
  CorrectPackageSizeModalProps
> = ({ visible, pantryItemId, batchId, onClose, onConfirm }) => {
  const { t } = useTranslation();
  const itemFragment = useFragment({
    fragment: CorrectPackageSizeModal_PantryItemFragmentDoc,
    fragmentName: 'CorrectPackageSizeModal_pantryItem',
    from: { __typename: 'PantryItem', id: pantryItemId },
  });
  const batchFragment = useFragment({
    fragment: CorrectPackageSizeModal_BatchFragmentDoc,
    fragmentName: 'CorrectPackageSizeModal_batch',
    from: batchId ? { __typename: 'PantryItemBatch', id: batchId } : null,
  });
  const pantryItem = itemFragment.complete ? itemFragment.data : null;
  const batch = batchId && batchFragment.complete ? batchFragment.data : null;

  const { control, handleSubmit, setValue, reset, getValues } =
    useForm<CorrectWeightFormValues>({
      resolver: yupResolver(correctWeightSchema),
      defaultValues: correctWeightDefaults(),
    });

  // `reset` notifies mounted `Controller` children synchronously, so calling it
  // during render updates components that are not rendering. The seed is
  // computed here (own state only) and applied from an effect. Keyed on the
  // batch id so a cache update to the same batch does not clobber typed input.
  const [pendingSeed, setPendingSeed] =
    useState<CorrectWeightFormValues | null>(null);
  const [seedKey, setSeedKey] = useState<string | null>(null);
  const nextSeedKey = visible && pantryItem && batch ? batch.id : null;
  if (nextSeedKey !== seedKey) {
    setSeedKey(nextSeedKey);
    setPendingSeed(
      nextSeedKey && pantryItem && batch
        ? {
            weightInput: formatNumberForInput(batch.netWeight),
            unitDisplay: getUnitDisplayText(pantryItem.netWeightUnit),
            selectedUnitId: pantryItem.netWeightUnit?.id ?? null,
            reason: '',
          }
        : null,
    );
  }

  useEffect(() => {
    if (pendingSeed) reset(pendingSeed);
  }, [pendingSeed, reset]);

  const handleUnitSelected = (
    unitId: string | null,
    unitName: string | null,
  ) => {
    setValue('selectedUnitId', unitId, { shouldDirty: true });
    if (unitName) setValue('unitDisplay', unitName, { shouldDirty: true });
  };

  const [isSaving, setIsSaving] = useState(false);
  // Reaching here means the schema passed; a refusal renders under its field.
  const submit = handleSubmit(async values => {
    const netWeightUnitId =
      getValues().selectedUnitId ?? pantryItem?.netWeightUnit?.id;
    if (!netWeightUnitId) return;
    setIsSaving(true);
    const corrected = await onConfirm({
      netWeight: parseWeight(values),
      netWeightUnitId,
      reason: values.reason.trim(),
    });
    setIsSaving(false);
    if (corrected) onClose();
  }, logValidationErrors);
  const handleConfirm = () => {
    void submit();
  };

  const sizeText = formatNetWeightDisplay(
    batch?.netWeight,
    pantryItem?.netWeightUnit,
  );
  const remainingText = formatNetWeightDisplay(
    batch?.remainingNetWeight,
    pantryItem?.netWeightUnit,
  );

  return (
    <Sheet
      mode="form"
      visible={visible ? !!pantryItem && !!batch : false}
      onDismiss={onClose}
      snapPoints={['65%', '85%']}
      contentContainerStyle={commonStyles.bottomSheetContent}
    >
      <BottomSheetHeader
        title={t('correctWeight.title')}
        onCancel={onClose}
        onConfirm={handleConfirm}
        confirmLabel={t('correctWeight.correct')}
        saving={isSaving}
      />

      {!!pantryItem && !!batch && (
        <>
          <View style={commonStyles.bottomSheetItemInfo}>
            <Text role="heading" style={commonStyles.bottomSheetItemName}>
              {pantryItem.itemName}
            </Text>
            <View style={commonStyles.bottomSheetItemRow}>
              <Text role="body" tone="secondary">
                {t('pantryItemDetail.batch.number', {
                  number: batch.batchNumber,
                })}
              </Text>
            </View>
            {!!sizeText && (
              <View style={commonStyles.bottomSheetItemRow}>
                <Text role="body" tone="secondary">
                  {t('correctWeight.netWeightPrefix')}
                  {sizeText}
                </Text>
              </View>
            )}
            {!!remainingText && (
              <View style={commonStyles.bottomSheetItemRow}>
                <Text role="body" tone="secondary">
                  {t('labels.remaining')}
                  {remainingText}
                </Text>
              </View>
            )}
          </View>

          <View style={commonStyles.bottomSheetSection}>
            <Controller
              control={control}
              name="weightInput"
              render={({ field, fieldState }) => (
                <FormInput
                  label={t('correctWeight.newNetWeight')}
                  required
                  value={field.value}
                  onChangeText={field.onChange}
                  error={fieldState.error?.message}
                  placeholder={localizeNumericHint(t('labels.eG145'))}
                  keyboardType="decimal-pad"
                  useBottomSheetInput
                />
              )}
            />
          </View>

          <View style={commonStyles.bottomSheetSection}>
            <Controller
              control={control}
              name="unitDisplay"
              render={({ field }) => (
                <UnitAutocompleteField
                  variant="modal"
                  label={t('storageLocationForm.unit')}
                  value={field.value}
                  onChangeText={field.onChange}
                  onUnitSelected={handleUnitSelected}
                  placeholder={t('labels.ozGMl')}
                />
              )}
            />
          </View>

          <View style={commonStyles.bottomSheetSection}>
            <Controller
              control={control}
              name="reason"
              render={({ field, fieldState }) => (
                <FormInput
                  label={t('labels.reason')}
                  required
                  value={field.value}
                  onChangeText={field.onChange}
                  error={fieldState.error?.message}
                  placeholder={t('correctWeight.reasonPlaceholder')}
                  useBottomSheetInput
                />
              )}
            />
          </View>
        </>
      )}
    </Sheet>
  );
};
