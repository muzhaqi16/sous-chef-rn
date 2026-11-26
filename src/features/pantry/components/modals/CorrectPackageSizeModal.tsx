import React, { useState } from 'react';
import { SheetHeader } from '#components/templates/SheetHeader';
import { View } from 'react-native';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { useTranslation } from '#i18n';
import { useFragment } from '@apollo/client/react';
import { FormInput } from '#components/atoms/FormInput';
import { PackageContentsFields } from '#features/pantry/ui/PackageContentsFields';
import { commonStyles } from '#styles/commonStyles';
import { Text } from '#components/atoms/Text';
import { UnitType } from '#graphql/generated/schemaTypes';
import {
  CorrectPackageSizeModal_BatchFragmentDoc,
  CorrectPackageSizeModal_PantryItemFragmentDoc,
} from './CorrectPackageSizeModal.generated';
import { formatNumberForInput } from '#utils/formatters/number';
import { formatNetWeightDisplay, unitLabel } from '#utils/formatQuantity';
import { Sheet } from '#components/templates/Sheet';
import { SheetHeaderSlot } from '#components/templates/SheetHeaderSlot';
import { useOpening } from '#hooks/ui/useOpening';
import {
  correctWeightSchema,
  correctWeightDefaults,
  parseWeight,
  type CorrectWeightFormValues,
} from './correctWeightFormConfig';
import { reportValidationErrors } from '#utils/validation/common';
import type { PackageSizeCorrectionInput } from '#features/pantry/types';
import { useReadingSystem } from '#hooks/settings/useReadingSystem';
import { currentReading, formatReading } from '#domain/measure';
import { useSheetUnsavedInput } from '#components/templates/SheetCloseGuard';

interface CorrectPackageSizeModalProps {
  visible: boolean;
  pantryItemId: string;
  batchId: string | null;
  onClose: () => void;
  /** Resolves null once it stands; a refusal's reason keeps the sheet open. */
  onConfirm: (input: PackageSizeCorrectionInput) => Promise<string | null>;
}

/**
 * Corrects what a package holds: ONE batch's size, or the count a stack is used
 * by. The stack's default size is edited elsewhere.
 */
export const CorrectPackageSizeModal: React.FC<
  CorrectPackageSizeModalProps
> = ({ visible, pantryItemId, batchId, onClose, onConfirm }) => {
  const itemRead = useFragment({
    fragment: CorrectPackageSizeModal_PantryItemFragmentDoc,
    fragmentName: 'CorrectPackageSizeModal_pantryItem',
    from: { __typename: 'PantryItem', id: pantryItemId },
  });
  const batchRead = useFragment({
    fragment: CorrectPackageSizeModal_BatchFragmentDoc,
    fragmentName: 'CorrectPackageSizeModal_batch',
    from: batchId ? { __typename: 'PantryItemBatch', id: batchId } : null,
  });
  // Shown once the stack and batch are read, so each opening seeds its form
  // once: a cache update to the batch while it is open keeps what was typed.
  const presented =
    visible && !!batchId && itemRead.complete && batchRead.complete;
  const opening = useOpening(presented, batchId);

  return (
    <Sheet
      mode="form"
      visible={presented}
      onDismiss={onClose}
      headerFromContent
      snapPoints={['65%', '85%']}
      contentContainerStyle={commonStyles.bottomSheetContent}
    >
      {opening?.payload ? (
        <CorrectPackageSizeForm
          key={opening.id}
          pantryItemId={pantryItemId}
          batchId={opening.payload}
          onClose={onClose}
          onConfirm={onConfirm}
        />
      ) : null}
    </Sheet>
  );
};

/** One opening's correction, seeded from the batch as it opened. */
const CorrectPackageSizeForm: React.FC<
  Omit<CorrectPackageSizeModalProps, 'visible' | 'batchId'> & {
    batchId: string;
  }
> = ({ pantryItemId, batchId, onClose, onConfirm }) => {
  const { t } = useTranslation();
  const itemFragment = useFragment({
    fragment: CorrectPackageSizeModal_PantryItemFragmentDoc,
    fragmentName: 'CorrectPackageSizeModal_pantryItem',
    from: { __typename: 'PantryItem', id: pantryItemId },
  });
  const batchFragment = useFragment({
    fragment: CorrectPackageSizeModal_BatchFragmentDoc,
    fragmentName: 'CorrectPackageSizeModal_batch',
    from: { __typename: 'PantryItemBatch', id: batchId },
  });
  const pantryItem = itemFragment.complete ? itemFragment.data : null;
  const batch = batchFragment.complete ? batchFragment.data : null;
  const readingSystem = useReadingSystem();
  const netWeightUnitId = pantryItem?.netWeightUnit?.id;
  const sizeReading = currentReading(
    batch?.packageSize,
    { value: batch?.netWeight, unitId: netWeightUnitId },
    readingSystem,
  );
  const remainingReading = currentReading(
    batch?.remaining,
    { value: batch?.remainingNetWeight, unitId: netWeightUnitId },
    readingSystem,
  );

  // As stored, not as the reading above rounds it: a correction that leaves the
  // size as it opened leaves it as it was.
  const seed: CorrectWeightFormValues | undefined =
    pantryItem && batch
      ? {
          weightInput: formatNumberForInput(batch.netWeight),
          unitDisplay: unitLabel(pantryItem.netWeightUnit),
          selectedUnitId: pantryItem.netWeightUnit?.id ?? null,
          selectedUnitType: null,
          definesCount: false,
          reason: '',
        }
      : undefined;
  const {
    control,
    handleSubmit,
    setValue,
    setError,
    getValues,
    getFieldState,
    trigger,
    formState: { isDirty },
  } = useForm<CorrectWeightFormValues>({
    resolver: yupResolver(correctWeightSchema),
    defaultValues: seed ?? correctWeightDefaults(),
  });
  useSheetUnsavedInput(isDirty);
  const definesCount = useWatch({ control, name: 'definesCount' });

  const handleUnitSelected = (
    unitId: string | null,
    unitName: string | null,
    unitType?: UnitType | null,
  ) => {
    setValue('selectedUnitId', unitId, { shouldDirty: true });
    setValue('selectedUnitType', unitType ?? null);
    setValue(
      'definesCount',
      unitType === UnitType.Count && unitId !== pantryItem?.portionUnitId,
    );
    // The reason rule reads `definesCount`; `setValue` re-runs only what it writes.
    if (getFieldState('reason').invalid) void trigger('reason');
    if (unitName) setValue('unitDisplay', unitName, { shouldDirty: true });
  };

  const [isSaving, setIsSaving] = useState(false);
  // Reaching here means the schema passed; a refusal renders under its field.
  const submit = handleSubmit(async values => {
    const typedUnitId = getValues().selectedUnitId ?? netWeightUnitId;
    if (!typedUnitId) {
      setError('unitDisplay', { message: t('packageSize.unitRequired') });
      return;
    }
    setIsSaving(true);
    const refused = await onConfirm({
      amount: parseWeight(values),
      unitId: typedUnitId,
      unitType: values.selectedUnitType,
      reason: values.reason.trim(),
    });
    setIsSaving(false);
    if (refused) {
      setError('weightInput', { type: 'server', message: refused });
      return;
    }
    onClose();
  }, reportValidationErrors);
  const handleConfirm = () => {
    void submit();
  };

  const sizeText = sizeReading
    ? formatReading(sizeReading)
    : formatNetWeightDisplay(batch?.netWeight, pantryItem?.netWeightUnit);
  const remainingText = remainingReading
    ? formatReading(remainingReading)
    : formatNetWeightDisplay(
        batch?.remainingNetWeight,
        pantryItem?.netWeightUnit,
      );

  return (
    <>
      <SheetHeaderSlot>
        <SheetHeader
          title={t('correctWeight.title')}
          onClose={onClose}
          confirm={{
            onPress: handleConfirm,
            accessibilityLabel: t('correctWeight.correct'),
            loading: isSaving,
          }}
        />
      </SheetHeaderSlot>
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
              render={({ field: size, fieldState: sizeState }) => (
                <Controller
                  control={control}
                  name="unitDisplay"
                  render={({ field: unit, fieldState: unitState }) => (
                    <PackageContentsFields
                      variant="modal"
                      sizeRef={size.ref}
                      size={size.value}
                      onSizeChange={size.onChange}
                      sizeError={sizeState.error?.message}
                      unit={unit.value}
                      onUnitChange={unit.onChange}
                      onUnitSelected={handleUnitSelected}
                      unitError={unitState.error?.message}
                    />
                  )}
                />
              )}
            />
          </View>

          {definesCount ? null : (
            <View style={commonStyles.bottomSheetSection}>
              <Controller
                control={control}
                name="reason"
                render={({ field, fieldState }) => (
                  <FormInput
                    ref={field.ref}
                    label={t('labels.reason')}
                    required
                    value={field.value}
                    onChangeText={field.onChange}
                    error={fieldState.error?.message}
                    placeholder={t('correctWeight.reasonPlaceholder')}
                  />
                )}
              />
            </View>
          )}
        </>
      )}
    </>
  );
};
