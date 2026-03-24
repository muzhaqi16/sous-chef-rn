import React, { useState } from 'react';
import { View, Text } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { alertService } from '#/services/alertService';
import { FractionInput } from '#components/molecules/FractionInput';
import { FormInput } from '#components/molecules/FormInput';
import { DatePickerField } from '#components/molecules/DatePickerField';
import { ConversionPreview } from '#components/atoms/ConversionPreview';
import { FractionQuickSelect } from '#components/atoms/FractionQuickSelect';
import { parseFractionalInput } from '#/utils/fractionUtils';
import { formatQuantity } from '#/utils/formatQuantity';
import { useConversionPreview } from '#hooks/pantry/useConversionPreview';
import type { PantryItemFragment } from '#generated';
import { commonStyles } from '#/styles/commonStyles';
import { PantryOperation } from '#hooks/pantry/useOperationUnits';
import {
  PantryActionModal,
  type PantryActionSharedState,
} from './PantryActionModal';

interface RestockPantryItemModalProps {
  visible: boolean;
  pantryItem: PantryItemFragment | null;
  onClose: () => void;
  onConfirm: (
    quantity: number,
    quantityInput: string,
    notes: string,
    unitId?: string,
    costPerUnit?: number,
    totalCost?: number,
    expiresAt?: Date | null,
  ) => void;
}

export const RestockPantryItemModal: React.FC<RestockPantryItemModalProps> = ({
  visible,
  pantryItem,
  onClose,
  onConfirm,
}) => {
  const [quantityInput, setQuantityInput] = useState('1');
  const [costPerUnitInput, setCostPerUnitInput] = useState('');
  const [totalCostInput, setTotalCostInput] = useState('');
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);

  const handleReset = () => {
    setQuantityInput('1');
    setCostPerUnitInput('');
    setTotalCostInput('');
    setExpiresAt(null);
  };

  const handleConfirm = (shared: PantryActionSharedState) => {
    if (!pantryItem) return;

    const quantityValue = parseFractionalInput(quantityInput);
    if (quantityValue === null || isNaN(quantityValue) || quantityValue <= 0) {
      alertService.alert('Error', 'Please enter a valid quantity');
      return;
    }

    const costPerUnit = costPerUnitInput
      ? parseFloat(costPerUnitInput)
      : undefined;
    const totalCost = totalCostInput ? parseFloat(totalCostInput) : undefined;

    // Pass the quantity and unit directly — the backend handles conversion
    onConfirm(
      quantityValue,
      quantityInput,
      shared.notes,
      shared.activeUnitId,
      isNaN(costPerUnit!) ? undefined : costPerUnit,
      isNaN(totalCost!) ? undefined : totalCost,
      expiresAt,
    );
    onClose();
  };

  return (
    <PantryActionModal
      visible={visible}
      pantryItem={pantryItem}
      onClose={onClose}
      title="Restock Item"
      confirmLabel="Restock"
      snapPoints={['80%', '95%']}
      unitToggleLabel="Restock by"
      currentQuantityLabel="Current:"
      operation={PantryOperation.Restock}
      onConfirm={handleConfirm}
      onReset={handleReset}
      renderActionFields={shared => (
        <RestockActionFields
          quantityInput={quantityInput}
          setQuantityInput={setQuantityInput}
          costPerUnitInput={costPerUnitInput}
          setCostPerUnitInput={setCostPerUnitInput}
          totalCostInput={totalCostInput}
          setTotalCostInput={setTotalCostInput}
          expiresAt={expiresAt}
          setExpiresAt={setExpiresAt}
          shared={shared}
        />
      )}
    />
  );
};

const RestockActionFields: React.FC<{
  quantityInput: string;
  setQuantityInput: (v: string) => void;
  costPerUnitInput: string;
  setCostPerUnitInput: (v: string) => void;
  totalCostInput: string;
  setTotalCostInput: (v: string) => void;
  expiresAt: Date | null;
  setExpiresAt: (v: Date | null) => void;
  shared: PantryActionSharedState;
}> = ({
  quantityInput,
  setQuantityInput,
  costPerUnitInput,
  setCostPerUnitInput,
  totalCostInput,
  setTotalCostInput,
  expiresAt,
  setExpiresAt,
  shared,
}) => {
  const addAmount = parseFractionalInput(quantityInput);

  // For dual-tracked items, show conversion to net weight unit (e.g. cups → grams)
  const conversion = useConversionPreview({
    pantryItemId: shared.pantryItemId,
    inputQuantity: addAmount,
    selectedUnitId: shared.activeUnitId,
    selectedUnitSymbol: shared.activeUnitSymbol,
    trackingUnitId:
      shared.isDualTracked && shared.isConvertedUnit
        ? shared.netWeightUnitId!
        : shared.trackingUnitId,
    trackingUnitSymbol:
      shared.isDualTracked && shared.isConvertedUnit
        ? shared.netWeightUnitSymbol!
        : shared.trackingUnitSymbol,
    conversionRatio: shared.isDualTracked
      ? null
      : shared.selectedUnitInfo?.conversionRatio ?? null,
  });

  // For dual-tracked items, show new total in net weight
  const currentInUnit =
    shared.isDualTracked && shared.isConvertedUnit
      ? shared.remainingNetWeight
      : shared.isConvertedUnit
      ? shared.availableInSelectedUnit
      : shared.trackingQuantity;

  const newQuantitySymbol =
    shared.isDualTracked && shared.isConvertedUnit
      ? shared.netWeightUnitSymbol!
      : shared.activeUnitSymbol;

  const newQuantity =
    addAmount !== null &&
    !isNaN(addAmount) &&
    currentInUnit != null &&
    (shared.isDualTracked ? conversion.convertedValue != null : true)
      ? currentInUnit +
        (shared.isDualTracked && conversion.convertedValue != null
          ? conversion.convertedValue
          : addAmount)
      : null;

  return (
    <>
      {/* Quantity Input */}
      <View style={commonStyles.bottomSheetSection}>
        <FractionInput
          label="Quantity to Add"
          value={quantityInput}
          onChangeText={setQuantityInput}
          placeholder="e.g., 1, 1 1/4, or 1.5"
          keyboardType="numeric"
          useBottomSheetInput
          required
        />
        {newQuantity !== null || shared.isConvertedUnit ? (
          <View style={commonStyles.bottomSheetInfoRow}>
            {newQuantity !== null ? (
              <Text style={[styles.newQuantityText, { marginTop: 0 }]}>
                New quantity: {formatQuantity(newQuantity)} {newQuantitySymbol}
              </Text>
            ) : null}
            {shared.isConvertedUnit ? (
              <ConversionPreview
                previewText={conversion.previewText}
                loading={conversion.previewLoading}
                confidence={
                  shared.selectedUnitInfo?.conversionConfidence ?? null
                }
              />
            ) : null}
          </View>
        ) : null}
        {shared.commonFractions != null && shared.commonFractions.length > 0 ? (
          <FractionQuickSelect
            fractions={shared.commonFractions}
            onSelect={value => setQuantityInput(value.toString())}
            selectedValue={addAmount ?? undefined}
            unitSymbol={shared.activeUnitSymbol}
            displayAsFraction
          />
        ) : null}
      </View>

      {/* Cost Tracking */}
      <View style={commonStyles.bottomSheetSection}>
        <View style={styles.costRow}>
          <View style={styles.costField}>
            <FormInput
              label="Cost per Unit"
              value={costPerUnitInput}
              onChangeText={setCostPerUnitInput}
              placeholder="0.00"
              keyboardType="decimal-pad"
              useBottomSheetInput
            />
          </View>
          <View style={styles.costField}>
            <FormInput
              label="Total Cost"
              value={totalCostInput}
              onChangeText={setTotalCostInput}
              placeholder="0.00"
              keyboardType="decimal-pad"
              useBottomSheetInput
            />
          </View>
        </View>
      </View>

      {/* Notes */}
      <View style={commonStyles.bottomSheetSection}>
        <FormInput
          label="Notes"
          value={shared.notes}
          onChangeText={shared.setNotes}
          placeholder="Add any notes about this restock..."
          multiline
          numberOfLines={3}
          useBottomSheetInput
        />
      </View>

      {/* Expiration Date */}
      <View style={commonStyles.bottomSheetSection}>
        <DatePickerField
          label="Expiration Date"
          value={expiresAt}
          onChange={setExpiresAt}
          placeholder="Set new expiration"
          minimumDate={new Date()}
        />
      </View>
    </>
  );
};

const styles = StyleSheet.create(theme => ({
  costRow: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  costField: {
    flex: 1,
  },
  newQuantityText: {
    fontSize: theme.fonts.size.sm,
    color: theme.colors.primary,
    marginTop: theme.spacing.xs,
    fontWeight: theme.fonts.weight.medium,
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));
