import React, { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from '#/i18n';
import { FractionInput } from '#components/molecules/FractionInput';
import { FormInput } from '#components/atoms/FormInput';
import { CollapsibleChipPicker } from '#features/pantry/components/CollapsibleChipPicker';
import { QuantityInputFeedback } from '#features/pantry/components/QuantityInputFeedback';
import { parseFractionalInput } from '#/utils/fractionUtils';
import { validateDeductionQuantity } from '#features/pantry/utils/validateDeductionQuantity';
import { useQuantityFeedback } from '#features/pantry/hooks/useQuantityFeedback';
import { UsagePurpose } from '#/graphql/generated/schemaTypes';
import { commonStyles } from '#/styles/commonStyles';
import {
  PantryOperation,
  type SelectedUnitInfo,
} from '#features/pantry/hooks/useOperationUnits';
import {
  PantryActionModal,
  type PantryActionSharedState,
} from '#features/pantry/components/modals/PantryActionModal';
import { type PantryActionModal_PantryItemFragment } from './PantryActionModal.generated';
import { Text } from '#components/atoms/Text';
import {
  formatNumberForInput,
  localizeNumericHint,
} from '#/utils/formatters/number';

interface ConsumePantryItemModalProps {
  visible: boolean;
  pantryItemId: string | null;
  onClose: () => void;
  onConfirm: (
    quantityUsed: number,
    quantityInput: string,
    purpose: UsagePurpose,
    notes: string,
    usageUnitId?: string,
  ) => void;
}

const PURPOSE_OPTIONS: Array<{ labelKey: string; value: UsagePurpose }> = [
  { labelKey: 'consumeItem.purposeCooking', value: UsagePurpose.Cooking },
  { labelKey: 'labels.mealPrep', value: UsagePurpose.MealPrep },
  { labelKey: 'usagePurpose.SNACK', value: UsagePurpose.Snack },
  { labelKey: 'labels.general', value: UsagePurpose.General },
  { labelKey: 'usagePurpose.GIFT', value: UsagePurpose.Gift },
  { labelKey: 'consumeItem.purposeTransfer', value: UsagePurpose.Transfer },
];

export const ConsumePantryItemModal: React.FC<ConsumePantryItemModalProps> = ({
  visible,
  pantryItemId,
  onClose,
  onConfirm,
}) => {
  const { t } = useTranslation();
  const [quantityInput, setQuantityInput] = useState('1');
  const [purpose, setPurpose] = useState<UsagePurpose>(UsagePurpose.General);

  const handleReset = (
    _item: PantryActionModal_PantryItemFragment,
    _defaultUnit: SelectedUnitInfo | null,
    increment: number | null,
  ) => {
    setQuantityInput(increment ? formatNumberForInput(increment) : '1');
    setPurpose(UsagePurpose.General);
  };

  const handleConfirm = (shared: PantryActionSharedState) => {
    if (!pantryItemId) return;

    const quantityValue = validateDeductionQuantity(
      quantityInput,
      shared,
      'consume',
    );
    if (quantityValue === null) return;

    onConfirm(
      quantityValue,
      quantityInput,
      purpose,
      shared.notes,
      shared.activeUnitId,
    );
    onClose();
  };

  const purposeOptions = PURPOSE_OPTIONS.map(({ labelKey, value }) => ({
    label: t(labelKey),
    value,
  }));

  return (
    <PantryActionModal
      visible={visible}
      pantryItemId={pantryItemId}
      onClose={onClose}
      title={t('consumeItem.title')}
      confirmLabel={t('labels.confirm')}
      snapPoints={['75%', '95%']}
      unitToggleLabel={t('consumeItem.consumeBy')}
      operation={PantryOperation.Consume}
      onConfirm={handleConfirm}
      onReset={handleReset}
      renderActionFields={(shared, pantryItem) => (
        <ConsumeActionFields
          quantityInput={quantityInput}
          setQuantityInput={setQuantityInput}
          purpose={purpose}
          setPurpose={setPurpose}
          shared={shared}
          showFifoHint={(pantryItem.activeBatchCount ?? 0) > 1}
          purposeOptions={purposeOptions}
        />
      )}
    />
  );
};

/** Extracted to keep the render prop body simple */
const ConsumeActionFields: React.FC<{
  quantityInput: string;
  setQuantityInput: (v: string) => void;
  purpose: UsagePurpose;
  setPurpose: (v: UsagePurpose) => void;
  shared: PantryActionSharedState;
  showFifoHint?: boolean;
  purposeOptions: Array<{ label: string; value: UsagePurpose }>;
}> = ({
  quantityInput,
  setQuantityInput,
  purpose,
  setPurpose,
  shared,
  showFifoHint,
  purposeOptions,
}) => {
  const { t } = useTranslation();
  const consumeAmount = parseFractionalInput(quantityInput);
  const { conversion, remaining, availableInUnit, remainingUnitSymbol } =
    useQuantityFeedback(consumeAmount, shared);

  return (
    <>
      {/* Quantity Input */}
      <View style={commonStyles.bottomSheetSection}>
        <FractionInput
          label={t('consumeItem.quantityToConsume')}
          required
          value={quantityInput}
          onChangeText={setQuantityInput}
          placeholder={localizeNumericHint(t('labels.eG1114Or15'))}
          keyboardType="numeric"
          useBottomSheetInput
        />
        <QuantityInputFeedback
          remaining={remaining}
          availableInUnit={availableInUnit}
          activeUnitSymbol={remainingUnitSymbol}
          consumeUnitSymbol={shared.activeUnitSymbol}
          isConvertedUnit={shared.isConvertedUnit}
          previewText={conversion.previewText}
          previewLoading={conversion.previewLoading}
          conversionConfidence={conversion.confidence}
          commonFractions={shared.commonFractions}
          onFractionSelect={value =>
            setQuantityInput(formatNumberForInput(value))
          }
          selectedFractionValue={consumeAmount ?? undefined}
        />
        {showFifoHint ? (
          <Text style={commonStyles.bottomSheetHelperText}>
            {t('consumeItem.fifoHint')}
          </Text>
        ) : null}
      </View>

      {/* Purpose Selection */}
      <CollapsibleChipPicker
        label={t('consumeItem.purpose')}
        options={purposeOptions}
        selectedValue={purpose}
        onSelect={setPurpose}
      />

      {/* Notes */}
      <View style={commonStyles.bottomSheetSection}>
        <FormInput
          label={t('consumeItem.notes')}
          value={shared.notes}
          onChangeText={shared.setNotes}
          placeholder={t('consumeItem.notesPlaceholder')}
          multiline
          numberOfLines={3}
          useBottomSheetInput
        />
      </View>
    </>
  );
};
