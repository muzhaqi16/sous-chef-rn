import React, { useState } from 'react';
import { View } from 'react-native';
import { FractionInput } from '#components/molecules/FractionInput';
import { FormInput } from '#components/molecules/FormInput';
import { CollapsibleChipPicker } from '#components/molecules/CollapsibleChipPicker';
import { QuantityInputFeedback } from '#components/molecules/QuantityInputFeedback';
import { parseFractionalInput } from '#/utils/fractionUtils';
import { validateDeductionQuantity } from '#/utils/validateDeductionQuantity';
import { useQuantityFeedback } from '#features/pantry/hooks/useQuantityFeedback';
import { UsagePurpose, PantryItemFragment } from '#generated';
import { commonStyles } from '#/styles/commonStyles';
import {
  PantryOperation,
  type SelectedUnitInfo,
} from '#features/pantry/hooks/useOperationUnits';
import {
  PantryActionModal,
  type PantryActionSharedState,
} from './PantryActionModal';
import { Text } from '#components/atoms/Text';

interface ConsumePantryItemModalProps {
  visible: boolean;
  pantryItem: PantryItemFragment | null;
  onClose: () => void;
  onConfirm: (
    quantityUsed: number,
    quantityInput: string,
    purpose: UsagePurpose,
    notes: string,
    usageUnitId?: string,
  ) => void;
}

const PURPOSE_OPTIONS: Array<{ label: string; value: UsagePurpose }> = [
  { label: 'Cooking', value: UsagePurpose.Cooking },
  { label: 'Meal Prep', value: UsagePurpose.MealPrep },
  { label: 'Snack', value: UsagePurpose.Snack },
  { label: 'General', value: UsagePurpose.General },
  { label: 'Gift', value: UsagePurpose.Gift },
  { label: 'Transfer', value: UsagePurpose.Transfer },
];

export const ConsumePantryItemModal: React.FC<ConsumePantryItemModalProps> = ({
  visible,
  pantryItem,
  onClose,
  onConfirm,
}) => {
  const [quantityInput, setQuantityInput] = useState('1');
  const [purpose, setPurpose] = useState<UsagePurpose>(UsagePurpose.General);

  const handleReset = (
    _item: PantryItemFragment,
    _defaultUnit: SelectedUnitInfo | null,
    increment: number | null,
  ) => {
    setQuantityInput(increment ? increment.toString() : '1');
    setPurpose(UsagePurpose.General);
  };

  const handleConfirm = (shared: PantryActionSharedState) => {
    if (!pantryItem) return;

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

  const showFifoHint = (pantryItem?.activeBatchCount ?? 0) > 1;

  return (
    <PantryActionModal
      visible={visible}
      pantryItem={pantryItem}
      onClose={onClose}
      title="Consume Item"
      confirmLabel="Confirm"
      snapPoints={['75%', '95%']}
      unitToggleLabel="Consume by"
      operation={PantryOperation.Consume}
      onConfirm={handleConfirm}
      onReset={handleReset}
      renderActionFields={shared => (
        <ConsumeActionFields
          quantityInput={quantityInput}
          setQuantityInput={setQuantityInput}
          purpose={purpose}
          setPurpose={setPurpose}
          shared={shared}
          showFifoHint={showFifoHint}
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
}> = ({
  quantityInput,
  setQuantityInput,
  purpose,
  setPurpose,
  shared,
  showFifoHint,
}) => {
  const consumeAmount = parseFractionalInput(quantityInput);
  const { conversion, remaining, availableInUnit, remainingUnitSymbol } =
    useQuantityFeedback(consumeAmount, shared);

  return (
    <>
      {/* Quantity Input */}
      <View style={commonStyles.bottomSheetSection}>
        <FractionInput
          label="Quantity to Consume"
          required
          value={quantityInput}
          onChangeText={setQuantityInput}
          placeholder="e.g., 1, 1 1/4, or 1.5"
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
          conversionConfidence={
            shared.selectedUnitInfo?.conversionConfidence ?? null
          }
          commonFractions={shared.commonFractions}
          onFractionSelect={value => setQuantityInput(value.toString())}
          selectedFractionValue={consumeAmount ?? undefined}
        />
        {showFifoHint ? (
          <Text style={commonStyles.bottomSheetHelperText}>
            Items are consumed oldest-first by expiration date
          </Text>
        ) : null}
      </View>

      {/* Purpose Selection */}
      <CollapsibleChipPicker
        label="Purpose *"
        options={PURPOSE_OPTIONS}
        selectedValue={purpose}
        onSelect={setPurpose}
      />

      {/* Notes */}
      <View style={commonStyles.bottomSheetSection}>
        <FormInput
          label="Notes"
          value={shared.notes}
          onChangeText={shared.setNotes}
          placeholder="Add any notes about this usage..."
          multiline
          numberOfLines={3}
          useBottomSheetInput
        />
      </View>
    </>
  );
};
