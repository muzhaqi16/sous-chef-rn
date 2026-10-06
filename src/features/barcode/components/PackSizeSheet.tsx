import React, { useState } from 'react';
import { View } from 'react-native';
import { Controller, useController, useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { useTranslation } from '#/i18n';
import { FormInput } from '#components/atoms/FormInput';
import { Text } from '#components/atoms/Text';
import { BottomSheetHeader } from '#components/molecules/BottomSheetHeader';
import { Sheet } from '#components/templates/Sheet';
import { UnitAutocompleteField } from '#features/catalog/ui/autocomplete/UnitAutocompleteField';
import { commonStyles } from '#/styles/commonStyles';
import { localizeNumericHint } from '#/utils/formatters/number';
import { logValidationErrors } from '#/utils/validation/common';
import { parseDecimalInput } from '#/utils/parseDecimalInput';
import { barcodeTestIDs } from '#features/barcode/testIDs';
import type { PackageSizeInput } from '#/graphql/generated/schemaTypes';
import {
  packSizeDefaults,
  packSizeSchema,
  type PackSizeFormValues,
} from './packSizeFormConfig';

/** What became of a confirmed size. Only `done` closes the sheet. */
export type PackSizeOutcome =
  | { status: 'done' }
  /** `sizeError` is why the size was refused; without one, the user was told. */
  | { status: 'refused'; sizeError?: string };

interface PackSizeSheetProps {
  visible: boolean;
  itemName: string;
  onDismiss: () => void;
  /** Settles the add; never rejects. A refusal keeps the sheet and its values. */
  onConfirm: (packSize: PackageSizeInput) => Promise<PackSizeOutcome>;
}

/** Asks for the one fact a scanned product needs before it can be added. */
export const PackSizeSheet: React.FC<PackSizeSheetProps> = ({
  visible,
  itemName,
  onDismiss,
  onConfirm,
}) => {
  const { t } = useTranslation();
  const [isAdding, setIsAdding] = useState(false);
  const { control, handleSubmit, setValue, setError, reset } =
    useForm<PackSizeFormValues>({
      resolver: yupResolver(packSizeSchema),
      defaultValues: packSizeDefaults(),
    });

  const { fieldState: unitState } = useController({ control, name: 'unitId' });

  const close = () => {
    reset(packSizeDefaults());
    onDismiss();
  };

  const submit = handleSubmit(async values => {
    const { unitId } = values;
    if (!unitId) return;
    setIsAdding(true);
    const outcome = await onConfirm({
      netWeight: parseDecimalInput(values.sizeInput),
      netWeightUnitId: unitId,
    });
    setIsAdding(false);
    if (outcome.status === 'done') {
      close();
      return;
    }
    if (outcome.sizeError) {
      setError('sizeInput', { type: 'server', message: outcome.sizeError });
    }
  }, logValidationErrors);

  return (
    <Sheet
      mode="form"
      visible={visible}
      onDismiss={close}
      snapPoints={['60%', '85%']}
      contentContainerStyle={commonStyles.bottomSheetContent}
    >
      <BottomSheetHeader
        contentPadding="md"
        title={t('labels.packageSize')}
        onCancel={close}
        onConfirm={() => {
          void submit();
        }}
        confirmLabel={t('labels.add')}
        saving={isAdding}
        confirmTestID={barcodeTestIDs.packSizeConfirm}
      />

      <View style={commonStyles.bottomSheetItemInfo}>
        <Text role="heading" style={commonStyles.bottomSheetItemName}>
          {itemName}
        </Text>
        <Text role="body" tone="secondary">
          {t('barcode.packSize.body')}
        </Text>
      </View>

      <View style={commonStyles.bottomSheetSection}>
        <Controller
          control={control}
          name="sizeInput"
          render={({ field, fieldState }) => (
            <FormInput
              label={t('barcode.packSize.label')}
              required
              value={field.value}
              onChangeText={field.onChange}
              error={fieldState.error?.message}
              placeholder={localizeNumericHint(t('labels.eG145'))}
              keyboardType="decimal-pad"
              useBottomSheetInput
              testID={barcodeTestIDs.packSizeInput}
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
              label={t('labels.unit')}
              required
              value={field.value}
              onChangeText={field.onChange}
              onUnitSelected={(unitId, unitName) => {
                // Typing clears the pick on every keystroke; only a pick is
                // checked here, so the error waits for a submit without one.
                setValue('unitId', unitId, { shouldValidate: unitId !== null });
                if (unitName) setValue('unitDisplay', unitName);
              }}
              error={unitState.error?.message}
              placeholder={t('labels.ozGMl')}
            />
          )}
        />
      </View>
    </Sheet>
  );
};
