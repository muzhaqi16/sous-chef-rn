import React from 'react';
import { View } from 'react-native';
import {
  Controller,
  useController,
  useForm,
  type Control,
} from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { boolean, mixed, object, string, type ObjectSchema } from 'yup';
import { useTranslation } from '#/i18n';
import { StyleSheet } from 'react-native-unistyles';
import { FractionInput } from '#components/molecules/FractionInput';
import { FormInput } from '#components/atoms/FormInput';
import { FormCheckbox } from '#components/molecules/FormCheckbox';
import { CollapsibleChipPicker } from '#features/pantry/components/CollapsibleChipPicker';
import { QuantityInputFeedback } from '#features/pantry/components/QuantityInputFeedback';
import { parseFractionalInput } from '#/utils/fractionUtils';
import { validateDeductionQuantity } from '#features/pantry/utils/validateDeductionQuantity';
import { useQuantityFeedback } from '#features/pantry/hooks/useQuantityFeedback';
import { WasteReason } from '#/graphql/generated/schemaTypes';
import { commonStyles } from '#/styles/commonStyles';
import { PantryOperation } from '#features/pantry/hooks/useOperationUnits';
import {
  PantryActionHeader,
  PantryActionModal,
} from '#features/pantry/components/modals/PantryActionModal';
import { Text } from '#components/atoms/Text';
import { localizeNumericHint } from '#/utils/formatters/number';
import {
  formatQuantityForInput,
  resolveQuantityNotation,
} from '#/utils/formatQuantity';
import { reportValidationErrors } from '#/utils/validation/common';
import type { PantryActionSharedState } from '#features/pantry/types';
import { WASTE_REASON_OPTIONS } from '#features/pantry/utils/wasteReasons';

interface RecordWastePantryItemModalProps {
  visible: boolean;
  pantryItemId: string | null;
  onClose: () => void;
  onConfirm: (
    wasteAmount: number,
    wasteReason: WasteReason,
    isComposted: boolean,
    isRecycled: boolean,
    notes: string,
    wasteUnitId?: string,
  ) => void;
}

interface WasteFormValues {
  /** Null until typed: the amount then reads all the stack holds. */
  amountInput: string | null;
  wasteReason: WasteReason;
  isComposted: boolean;
  isRecycled: boolean;
}

const wasteDefaults: WasteFormValues = {
  amountInput: null,
  wasteReason: WasteReason.Expired,
  isComposted: false,
  isRecycled: false,
};

// The amount is held to the stock, which only the confirm reads
// (`validateDeductionQuantity`, reported with `setError`).
const wasteSchema: ObjectSchema<WasteFormValues> = object({
  amountInput: string().nullable().defined(),
  wasteReason: mixed<WasteReason>().oneOf(Object.values(WasteReason)).defined(),
  isComposted: boolean().defined(),
  isRecycled: boolean().defined(),
});

/** The amount before one is typed: everything the stack holds. */
const untypedAmount = (shared: PantryActionSharedState) =>
  formatQuantityForInput(shared.trackingQuantity, {
    notation: resolveQuantityNotation(
      null,
      shared.displayAsFractionOf(shared.trackingUnitId),
    ),
  });

export const RecordWastePantryItemModal: React.FC<
  RecordWastePantryItemModalProps
> = ({ visible, pantryItemId, onClose, onConfirm }) => {
  const { t } = useTranslation();
  return (
    <PantryActionModal
      visible={visible}
      pantryItemId={pantryItemId}
      onClose={onClose}
      snapPoints={['80%', '95%']}
      unitToggleLabel={t('recordWaste.wasteBy')}
      operation={PantryOperation.Waste}
      renderForm={(shared, pantryItem) => (
        <WasteForm
          shared={shared}
          ready={!!pantryItem}
          onClose={onClose}
          onConfirm={onConfirm}
        />
      )}
    />
  );
};

interface WasteFormProps {
  shared: PantryActionSharedState;
  /** The stack is read, so there is something to record. */
  ready: boolean;
  onClose: () => void;
  onConfirm: RecordWastePantryItemModalProps['onConfirm'];
}

const WasteForm: React.FC<WasteFormProps> = ({
  shared,
  ready,
  onClose,
  onConfirm,
}) => {
  const { t } = useTranslation();
  const { control, handleSubmit, setError } = useForm<WasteFormValues>({
    resolver: yupResolver(wasteSchema),
    defaultValues: wasteDefaults,
  });

  // The sheet closes at once; the write settles behind it.
  const submit = handleSubmit(
    ({ amountInput, wasteReason, isComposted, isRecycled }) => {
      const typed = amountInput ?? untypedAmount(shared);
      const wasteValue = validateDeductionQuantity(
        typed,
        shared,
        'waste',
        message => {
          setError('amountInput', { message });
        },
      );
      if (wasteValue === null) return;

      onConfirm(
        wasteValue,
        wasteReason,
        isComposted,
        isRecycled,
        shared.notes,
        shared.activeUnitId,
      );
      onClose();
    },
    reportValidationErrors,
  );

  const wasteReasonOptions = WASTE_REASON_OPTIONS.map(
    ({ labelKey, value }) => ({
      label: t(labelKey),
      value,
    }),
  );

  return (
    <>
      <PantryActionHeader
        title={t('labels.recordWaste')}
        confirmLabel={t('labels.recordWaste')}
        onClose={onClose}
        onConfirm={ready ? () => submit() : null}
      />
      {ready ? (
        <WasteFields
          control={control}
          shared={shared}
          wasteReasonOptions={wasteReasonOptions}
        />
      ) : null}
    </>
  );
};

const WasteFields: React.FC<{
  control: Control<WasteFormValues>;
  shared: PantryActionSharedState;
  wasteReasonOptions: Array<{ label: string; value: WasteReason }>;
}> = ({ control, shared, wasteReasonOptions }) => {
  const { t } = useTranslation();
  const { field: amount, fieldState: amountState } = useController({
    control,
    name: 'amountInput',
  });
  const wasteAmountInput = amount.value ?? untypedAmount(shared);
  const wasteAmount = parseFractionalInput(wasteAmountInput);
  const { conversion, remaining, available } = useQuantityFeedback(
    wasteAmount,
    shared,
  );

  return (
    <>
      {/* Waste Amount Input */}
      <View style={commonStyles.bottomSheetSection}>
        <FractionInput
          label={t('recordWaste.wasteAmount')}
          required
          value={wasteAmountInput}
          onChangeText={amount.onChange}
          placeholder={localizeNumericHint(t('labels.eG1114Or15'))}
          error={amountState.error?.message}
          useBottomSheetInput
        />
        <QuantityInputFeedback
          remaining={remaining}
          available={available}
          consumeUnit={shared.activeUnit}
          isConvertedUnit={shared.isConvertedUnit}
          previewText={conversion.previewText}
          previewLoading={conversion.previewLoading}
          conversionConfidence={conversion.confidence}
          commonFractions={shared.commonFractions}
          onFractionSelect={value =>
            amount.onChange(formatQuantityForInput(value))
          }
          selectedFractionValue={wasteAmount ?? undefined}
        />
      </View>

      {/* Waste Reason Selection */}
      <Controller
        control={control}
        name="wasteReason"
        render={({ field }) => (
          <CollapsibleChipPicker
            label={t('recordWaste.wasteReason')}
            options={wasteReasonOptions}
            selectedValue={field.value}
            onSelect={field.onChange}
          />
        )}
      />

      {/* Sustainability Tracking */}
      <View style={commonStyles.bottomSheetSection}>
        <Text role="label" style={commonStyles.bottomSheetSectionLabel}>
          {t('recordWaste.sustainability')}
        </Text>
        <View style={styles.checkboxContainer}>
          <Controller
            control={control}
            name="isComposted"
            render={({ field }) => (
              <FormCheckbox
                label={t('recordWaste.composted')}
                checked={field.value}
                onPress={() => field.onChange(!field.value)}
              />
            )}
          />
        </View>
        <View style={styles.checkboxContainer}>
          <Controller
            control={control}
            name="isRecycled"
            render={({ field }) => (
              <FormCheckbox
                label={t('recordWaste.recycledPackaging')}
                checked={field.value}
                onPress={() => field.onChange(!field.value)}
              />
            )}
          />
        </View>
      </View>

      {/* Notes */}
      <View style={commonStyles.bottomSheetSection}>
        <FormInput
          label={t('labels.notes')}
          value={shared.notes}
          onChangeText={shared.setNotes}
          placeholder={t('recordWaste.notesPlaceholder')}
          multiline
          numberOfLines={3}
          useBottomSheetInput
        />
      </View>
    </>
  );
};

const styles = StyleSheet.create(theme => ({
  checkboxContainer: {
    marginBottom: theme.spacing.sm,
  },
}));
