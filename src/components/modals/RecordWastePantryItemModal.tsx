import React, { useState } from 'react';
import { View, Text, Alert } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { FractionInput } from '#components/molecules/FractionInput';
import { FormInput } from '#components/molecules/FormInput';
import { FormCheckbox } from '#components/molecules/FormCheckbox';
import { CollapsibleChipPicker } from '#components/molecules/CollapsibleChipPicker';
import { ConversionPreview } from '#components/atoms/ConversionPreview';
import { parseFractionalInput } from '#/utils/fractionUtils';
import { formatQuantity } from '#/utils/formatQuantity';
import { useConversionPreview } from '#hooks/pantry/useConversionPreview';
import { WasteReason, PantryItemFragment } from '#generated';
import { commonStyles } from '#/styles/commonStyles';
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

    const wasteValue = parseFractionalInput(wasteAmountInput);
    if (wasteValue === null || isNaN(wasteValue) || wasteValue <= 0) {
      Alert.alert('Error', 'Please enter a valid waste amount');
      return;
    }
    if (!shared.isConvertedUnit && wasteValue > shared.trackingQuantity) {
      Alert.alert(
        'Error',
        `Cannot waste more than available quantity (${shared.trackingQuantity} ${shared.activeUnitSymbol})`,
      );
      return;
    }

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

  const conversion = useConversionPreview({
    pantryItemId: shared.pantryItemId,
    inputQuantity: wasteAmount,
    selectedUnitId: shared.activeUnitId,
    selectedUnitSymbol: shared.activeUnitSymbol,
    trackingUnitId: shared.trackingUnitId,
    trackingUnitSymbol: shared.trackingUnitSymbol,
    availableInTrackingUnit: shared.trackingQuantity,
    conversionRatio: shared.selectedUnitInfo?.conversionRatio ?? null,
  });

  const availableInUnit = shared.isConvertedUnit
    ? conversion.availableInSelectedUnit
    : shared.trackingQuantity;

  const remaining =
    wasteAmount !== null && !isNaN(wasteAmount) && availableInUnit != null
      ? availableInUnit - wasteAmount
      : null;

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
