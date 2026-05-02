import React, { useState } from 'react';
import { View, Text } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { FractionInput } from '#components/molecules/FractionInput';
import { FormInput } from '#components/molecules/FormInput';
import { FormCheckbox } from '#components/molecules/FormCheckbox';
import { CollapsibleChipPicker } from '#components/molecules/CollapsibleChipPicker';
import { QuantityInputFeedback } from '#components/molecules/QuantityInputFeedback';
import { parseFractionalInput } from '#/utils/fractionUtils';
import { validateDeductionQuantity } from '#/utils/validateDeductionQuantity';
import { useQuantityFeedback } from '#hooks/pantry/useQuantityFeedback';
import { WasteReason } from '../../graphql/generated/schemaTypes';
import { type PantryItemFragment } from '#operations/pantry/pantryFragments.generated';
import { commonStyles } from '#/styles/commonStyles';
import { PantryOperation } from '#hooks/pantry/useOperationUnits';
import {
  PantryActionModal,
  type PantryActionSharedState,
} from './PantryActionModal';

interface RecordWastePantryItemModalProps {
  visible: boolean;
  pantryItem: PantryItemFragment | null;
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

const WASTE_REASON_OPTIONS: Array<{ label: string; value: WasteReason }> = [
  { label: 'Expired', value: WasteReason.Expired },
  { label: 'Spoiled', value: WasteReason.Spoiled },
  { label: 'Mold', value: WasteReason.Mold },
  { label: 'Pest', value: WasteReason.Pest },
  { label: 'Cooking Fail', value: WasteReason.CookingFail },
  { label: 'Spilled', value: WasteReason.Spilled },
  { label: 'Burnt', value: WasteReason.Burnt },
  { label: 'Overstock', value: WasteReason.Overstock },
  { label: 'Bad Taste', value: WasteReason.Taste },
  { label: 'Gave Away', value: WasteReason.GaveAway },
  { label: 'Unknown Loss', value: WasteReason.UnknownLoss },
  { label: 'Other', value: WasteReason.Other },
];

export const RecordWastePantryItemModal: React.FC<
  RecordWastePantryItemModalProps
> = ({ visible, pantryItem, onClose, onConfirm }) => {
  const [wasteAmountInput, setWasteAmountInput] = useState('');
  const [wasteReason, setWasteReason] = useState<WasteReason>(
    WasteReason.Expired,
  );
  const [isComposted, setIsComposted] = useState(false);
  const [isRecycled, setIsRecycled] = useState(false);

  const handleReset = (item: PantryItemFragment) => {
    setWasteAmountInput(item.quantity.toString());
    setWasteReason(WasteReason.Expired);
    setIsComposted(false);
    setIsRecycled(false);
  };

  const handleConfirm = (shared: PantryActionSharedState) => {
    if (!pantryItem) return;

    const wasteValue = validateDeductionQuantity(
      wasteAmountInput,
      shared,
      'waste',
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
  };

  return (
    <PantryActionModal
      visible={visible}
      pantryItem={pantryItem}
      onClose={onClose}
      title="Record Waste"
      confirmLabel="Record Waste"
      confirmColor="warning"
      snapPoints={['80%', '95%']}
      unitToggleLabel="Waste by"
      operation={PantryOperation.Waste}
      onConfirm={handleConfirm}
      onReset={handleReset}
      renderActionFields={shared => (
        <WasteActionFields
          wasteAmountInput={wasteAmountInput}
          setWasteAmountInput={setWasteAmountInput}
          wasteReason={wasteReason}
          setWasteReason={setWasteReason}
          isComposted={isComposted}
          setIsComposted={setIsComposted}
          isRecycled={isRecycled}
          setIsRecycled={setIsRecycled}
          shared={shared}
        />
      )}
    />
  );
};

const WasteActionFields: React.FC<{
  wasteAmountInput: string;
  setWasteAmountInput: (v: string) => void;
  wasteReason: WasteReason;
  setWasteReason: (v: WasteReason) => void;
  isComposted: boolean;
  setIsComposted: (v: boolean) => void;
  isRecycled: boolean;
  setIsRecycled: (v: boolean) => void;
  shared: PantryActionSharedState;
}> = ({
  wasteAmountInput,
  setWasteAmountInput,
  wasteReason,
  setWasteReason,
  isComposted,
  setIsComposted,
  isRecycled,
  setIsRecycled,
  shared,
}) => {
  const wasteAmount = parseFractionalInput(wasteAmountInput);
  const { conversion, remaining, availableInUnit, remainingUnitSymbol } =
    useQuantityFeedback(wasteAmount, shared);

  return (
    <>
      {/* Waste Amount Input */}
      <View style={commonStyles.bottomSheetSection}>
        <FractionInput
          label="Waste Amount"
          required
          value={wasteAmountInput}
          onChangeText={setWasteAmountInput}
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
          onFractionSelect={value => setWasteAmountInput(value.toString())}
          selectedFractionValue={wasteAmount ?? undefined}
        />
      </View>

      {/* Waste Reason Selection */}
      <CollapsibleChipPicker
        label="Waste Reason *"
        options={WASTE_REASON_OPTIONS}
        selectedValue={wasteReason}
        onSelect={setWasteReason}
      />

      {/* Sustainability Tracking */}
      <View style={commonStyles.bottomSheetSection}>
        <Text style={commonStyles.bottomSheetSectionLabel}>Sustainability</Text>
        <View style={styles.checkboxContainer}>
          <FormCheckbox
            label="Composted"
            checked={isComposted}
            onPress={() => setIsComposted(!isComposted)}
          />
        </View>
        <View style={styles.checkboxContainer}>
          <FormCheckbox
            label="Recycled (packaging)"
            checked={isRecycled}
            onPress={() => setIsRecycled(!isRecycled)}
          />
        </View>
      </View>

      {/* Notes */}
      <View style={commonStyles.bottomSheetSection}>
        <FormInput
          label="Notes"
          value={shared.notes}
          onChangeText={shared.setNotes}
          placeholder="Add any notes about this waste..."
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
