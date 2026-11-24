import React, { useState } from 'react';
import { View } from 'react-native';
import {
  Controller,
  useController,
  useForm,
  type Control,
} from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { mixed, object, string, type ObjectSchema } from 'yup';
import { AppPressable } from '#components/atoms/AppPressable';
import { Button } from '#components/molecules/Button';
import { pantryTestIDs } from '#features/pantry/testIDs';
import { useTranslation, type TranslationKey } from '#/i18n';
import { FractionInput } from '#components/molecules/FractionInput';
import { FormInput } from '#components/atoms/FormInput';
import { CollapsibleChipPicker } from '#features/pantry/components/CollapsibleChipPicker';
import { QuantityInputFeedback } from '#features/pantry/components/QuantityInputFeedback';
import { parseFractionalInput } from '#/utils/fractionUtils';
import { validateDeductionQuantity } from '#features/pantry/utils/validateDeductionQuantity';
import { useQuantityFeedback } from '#features/pantry/hooks/useQuantityFeedback';
import { UsagePurpose } from '#/graphql/generated/schemaTypes';
import { commonStyles } from '#/styles/commonStyles';
import { PantryOperation } from '#features/pantry/hooks/useOperationUnits';
import {
  PantryActionHeader,
  PantryActionModal,
} from '#features/pantry/components/modals/PantryActionModal';
import type { PantryActionModal_PantryItemFragment } from './PantryActionModal.generated';
import { Text } from '#components/atoms/Text';
import { localizeNumericHint } from '#/utils/formatters/number';
import { formatQuantityForInput, unitLabel } from '#/utils/formatQuantity';
import { reportValidationErrors } from '#/utils/validation/common';
import type { PantryActionSharedState } from '#features/pantry/types';

interface ConsumePantryItemModalProps {
  compact?: boolean;
  visible: boolean;
  pantryItemId: string | null;
  onClose: () => void;
  onConfirm: (
    quantityUsed: number,
    quantityInput: string,
    purpose: UsagePurpose,
    notes: string,
    usageUnitId?: string,
  ) => Promise<unknown>;
}

const PURPOSE_OPTIONS: Array<{
  labelKey: TranslationKey;
  value: UsagePurpose;
}> = [
  { labelKey: 'consumeItem.purposeCooking', value: UsagePurpose.Cooking },
  { labelKey: 'labels.mealPrep', value: UsagePurpose.MealPrep },
  { labelKey: 'usagePurpose.SNACK', value: UsagePurpose.Snack },
  { labelKey: 'labels.general', value: UsagePurpose.General },
  { labelKey: 'usagePurpose.GIFT', value: UsagePurpose.Gift },
  { labelKey: 'consumeItem.purposeTransfer', value: UsagePurpose.Transfer },
];

interface ConsumeFormValues {
  /**
   * Null until typed: the amount then reads the default unit's step, which can
   * land after the sheet opens.
   */
  quantityInput: string | null;
  purpose: UsagePurpose;
  notes: string;
}

const consumeDefaults: ConsumeFormValues = {
  quantityInput: null,
  purpose: UsagePurpose.General,
  notes: '',
};

// The amount is held to the stock, which only the confirm reads
// (`validateDeductionQuantity`, reported with `setError`).
const consumeSchema: ObjectSchema<ConsumeFormValues> = object({
  quantityInput: string().nullable().defined(),
  purpose: mixed<UsagePurpose>().oneOf(Object.values(UsagePurpose)).defined(),
  notes: string().defined(),
});

/** The amount before one is typed. */
const untypedQuantity = ({ defaultUnitIncrement }: PantryActionSharedState) =>
  defaultUnitIncrement ? formatQuantityForInput(defaultUnitIncrement) : '1';

export const ConsumePantryItemModal: React.FC<ConsumePantryItemModalProps> = ({
  visible,
  compact = false,
  pantryItemId,
  onClose,
  onConfirm,
}) => {
  const { t } = useTranslation();
  return (
    <PantryActionModal
      visible={visible}
      pantryItemId={pantryItemId}
      onClose={onClose}
      snapPoints={['75%', '95%']}
      unitToggleLabel={t('consumeItem.consumeBy')}
      operation={PantryOperation.Consume}
      renderForm={(shared, pantryItem) => (
        <ConsumeForm
          compact={compact}
          shared={shared}
          pantryItem={pantryItem}
          onClose={onClose}
          onConfirm={onConfirm}
        />
      )}
    />
  );
};

interface ConsumeFormProps {
  compact: boolean;
  shared: PantryActionSharedState;
  pantryItem: PantryActionModal_PantryItemFragment | null;
  onClose: () => void;
  onConfirm: ConsumePantryItemModalProps['onConfirm'];
}

const ConsumeForm: React.FC<ConsumeFormProps> = ({
  compact,
  shared,
  pantryItem,
  onClose,
  onConfirm,
}) => {
  const { t } = useTranslation();
  const { control, handleSubmit, setError } = useForm<ConsumeFormValues>({
    resolver: yupResolver(consumeSchema),
    defaultValues: consumeDefaults,
  });

  // The caller closes the sheet once the use is recorded; a refusal keeps it
  // open with what was entered.
  const submit = handleSubmit(async ({ quantityInput, purpose, notes }) => {
    const typed = quantityInput ?? untypedQuantity(shared);
    const quantityUsed = validateDeductionQuantity(
      typed,
      shared,
      'consume',
      message => {
        setError('quantityInput', { message });
      },
    );
    if (quantityUsed === null) return;

    await onConfirm(quantityUsed, typed, purpose, notes, shared.activeUnitId);
  }, reportValidationErrors);

  const purposeOptions = PURPOSE_OPTIONS.map(({ labelKey, value }) => ({
    label: t(labelKey),
    value,
  }));

  return (
    <>
      <PantryActionHeader
        title={t('consumeItem.title')}
        confirmLabel={t('labels.confirm')}
        onClose={onClose}
        onConfirm={pantryItem ? () => submit() : null}
      />
      {pantryItem ? (
        <ConsumeFields
          control={control}
          compact={compact}
          shared={shared}
          showFifoHint={pantryItem.activeBatchCount > 1}
          purposeOptions={purposeOptions}
        />
      ) : null}
    </>
  );
};

const ConsumeFields: React.FC<{
  control: Control<ConsumeFormValues>;
  compact: boolean;
  shared: PantryActionSharedState;
  showFifoHint: boolean;
  purposeOptions: Array<{ label: string; value: UsagePurpose }>;
}> = ({ control, compact, shared, showFifoHint, purposeOptions }) => {
  const { t } = useTranslation();
  const [details, setDetails] = useState(false);
  const { field: quantity, fieldState: quantityState } = useController({
    control,
    name: 'quantityInput',
  });
  const quantityInput = quantity.value ?? untypedQuantity(shared);
  const useAll =
    shared.exactFactor != null
      ? shared.trackingQuantity / shared.exactFactor
      : shared.availableInSelectedUnit;
  const activeUnitText = unitLabel(shared.activeUnit);
  const consumeAmount = parseFractionalInput(quantityInput);
  const { conversion, remaining, available } = useQuantityFeedback(
    consumeAmount,
    shared,
  );

  return (
    <>
      {/* Quantity Input */}
      <View style={commonStyles.bottomSheetSection}>
        <FractionInput
          label={
            // A row made offline holds a unit with no symbol to name.
            activeUnitText
              ? `${t('consumeItem.quantityToConsume')} (${activeUnitText})`
              : t('consumeItem.quantityToConsume')
          }
          error={quantityState.error?.message}
          required
          value={quantityInput}
          onChangeText={quantity.onChange}
          placeholder={localizeNumericHint(t('labels.eG1114Or15'))}
          useBottomSheetInput
          testID={pantryTestIDs.consumeQuantity}
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
            quantity.onChange(formatQuantityForInput(value))
          }
          selectedFractionValue={consumeAmount ?? undefined}
        />
        {showFifoHint ? (
          <Text role="caption" style={commonStyles.bottomSheetHelperText}>
            {t('consumeItem.fifoHint')}
          </Text>
        ) : null}
      </View>

      {!!compact && (
        <View style={commonStyles.bottomSheetSection}>
          <Button
            variant="outline"
            size="small"
            testID={pantryTestIDs.consumeUseAll}
            title={t('consumeItem.useAll')}
            disabled={useAll == null || useAll <= 0}
            onPress={() => {
              if (useAll != null) {
                quantity.onChange(formatQuantityForInput(useAll));
              }
            }}
          />
          <AppPressable
            testID={pantryTestIDs.consumeDetails}
            accessibilityRole="button"
            accessibilityLabel={t('consumeItem.optionalDetails')}
            accessibilityState={{ expanded: details }}
            onPress={() => setDetails(!details)}
          >
            <Text role="body">{t('consumeItem.optionalDetails')}</Text>
          </AppPressable>
        </View>
      )}
      {!!(!compact || details) && (
        <>
          {/* Purpose Selection */}
          <Controller
            control={control}
            name="purpose"
            render={({ field }) => (
              <CollapsibleChipPicker
                label={t('consumeItem.purpose')}
                options={purposeOptions}
                selectedValue={field.value}
                onSelect={field.onChange}
              />
            )}
          />

          {/* Notes */}
          <View style={commonStyles.bottomSheetSection}>
            <Controller
              control={control}
              name="notes"
              render={({ field }) => (
                <FormInput
                  label={t('labels.notes')}
                  value={field.value}
                  onChangeText={field.onChange}
                  onBlur={field.onBlur}
                  placeholder={t('consumeItem.notesPlaceholder')}
                  multiline
                  numberOfLines={3}
                  useBottomSheetInput
                />
              )}
            />
          </View>
        </>
      )}
    </>
  );
};
