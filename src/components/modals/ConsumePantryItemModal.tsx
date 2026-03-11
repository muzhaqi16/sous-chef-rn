import React, { useState } from 'react';
import { View, Text, Alert } from 'react-native';
import { FractionInput } from '#components/molecules/FractionInput';
import { FormInput } from '#components/molecules/FormInput';
import { CollapsibleChipPicker } from '#components/molecules/CollapsibleChipPicker';
import { ConversionPreview } from '#components/atoms/ConversionPreview';
import { parseFractionalInput } from '#/utils/fractionUtils';
import { formatQuantity } from '#/utils/formatQuantity';
import { useConversionPreview } from '#hooks/pantry/useConversionPreview';
import { UsagePurpose, PantryItemFragment } from '#generated';
import { commonStyles } from '#/styles/commonStyles';
import { PantryActionModal, type PantryActionSharedState } from './PantryActionModal';

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
  onConfirm }) => {
  const [quantityInput, setQuantityInput] = useState('1');
  const [purpose, setPurpose] = useState<UsagePurpose>(UsagePurpose.General);

  const handleReset = (item: PantryItemFragment) => {
    const defaultIncrement = item.item?.defaultConsumeIncrement;
    setQuantityInput(defaultIncrement ? defaultIncrement.toString() : '1');
    setPurpose(UsagePurpose.General);
  };

  const handleConfirm = (shared: PantryActionSharedState) => {
    if (!pantryItem) return;

    const quantityValue = parseFractionalInput(quantityInput);
    if (quantityValue === null || isNaN(quantityValue) || quantityValue <= 0) {
      Alert.alert('Error', 'Please enter a valid quantity');
      return;
    }

    // When using a converted unit, validate against converted available quantity
    // When using tracking unit, validate against tracking quantity
    if (!shared.isConvertedUnit && quantityValue > shared.trackingQuantity) {
      Alert.alert('Error', `Cannot consume more than available quantity (${shared.trackingQuantity} ${shared.activeUnitSymbol})`);
      return;
    }

    onConfirm(quantityValue, quantityInput, purpose, shared.notes, shared.activeUnitId);
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
      onConfirm={handleConfirm}
      onReset={handleReset}
      renderActionFields={(shared) => (
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
}> = ({ quantityInput, setQuantityInput, purpose, setPurpose, shared, showFifoHint }) => {
  const consumeAmount = parseFractionalInput(quantityInput);

  const conversion = useConversionPreview({
    itemId: shared.itemId,
    inputQuantity: consumeAmount,
    selectedUnitId: shared.activeUnitId,
    selectedUnitSymbol: shared.activeUnitSymbol,
    trackingUnitId: shared.trackingUnitId,
    trackingUnitSymbol: shared.trackingUnitSymbol,
    availableInTrackingUnit: shared.trackingQuantity,
    conversionRatio: shared.selectedUnitInfo?.conversionRatio ?? null,
  });

  // Use converted available quantity when using a non-tracking unit
  const availableInUnit = shared.isConvertedUnit
    ? conversion.availableInSelectedUnit
    : shared.trackingQuantity;

  const remaining = consumeAmount !== null && !isNaN(consumeAmount) && availableInUnit != null
    ? availableInUnit - consumeAmount
    : null;

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
        {shared.isConvertedUnit ? (
          <ConversionPreview
            previewText={conversion.previewText}
            loading={conversion.previewLoading}
            confidence={shared.selectedUnitInfo?.conversionConfidence ?? null}
          />
        ) : null}
        {remaining !== null ? (
          <Text
            style={[
              commonStyles.bottomSheetHelperText,
              remaining < 0 && commonStyles.bottomSheetHelperTextError,
            ]}
          >
            Remaining: {remaining >= 0 ? formatQuantity(remaining) : 'Invalid'}{' '}
            {shared.activeUnitSymbol}
          </Text>
        ) : null}
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
