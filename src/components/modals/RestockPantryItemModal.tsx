import React, { useState } from 'react';
import { View, Text, Alert } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { FractionInput } from '#components/molecules/FractionInput';
import { FormInput } from '#components/molecules/FormInput';
import { DatePickerField } from '#components/molecules/DatePickerField';
import { parseFractionalInput } from '#/utils/fractionUtils';
import { formatQuantity } from '#/utils/formatQuantity';
import type { PantryItemFragment } from '#generated';
import { commonStyles } from '#/styles/commonStyles';
import { PantryActionModal, type PantryActionSharedState } from './PantryActionModal';

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
  onConfirm }) => {
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
      Alert.alert('Error', 'Please enter a valid quantity');
      return;
    }

    const costPerUnit = costPerUnitInput ? parseFloat(costPerUnitInput) : undefined;
    const totalCost = totalCostInput ? parseFloat(totalCostInput) : undefined;

    // Convert content units to weight for the backend
    let finalQuantity = quantityValue;
    let finalUnitId = shared.activeUnitId;
    if (shared.selectedUnit === 'content' && shared.hasContentUnit && pantryItem.packageBreakdown) {
      finalQuantity = quantityValue * pantryItem.packageBreakdown.perUnitNetWeight!;
      finalUnitId = pantryItem.netWeightUnit!.id;
    }

    onConfirm(
      finalQuantity,
      quantityInput,
      shared.notes,
      finalUnitId,
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
      snapPoints={['55%', '95%']}
      unitToggleLabel="Restock by"
      currentQuantityLabel="Current:"
      onConfirm={handleConfirm}
      onReset={handleReset}
      renderActionFields={(shared) => {
        const addAmount = parseFractionalInput(quantityInput);
        const newQuantity = addAmount !== null && !isNaN(addAmount)
          ? shared.availableQuantity + addAmount
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
              {newQuantity !== null && (
                <Text style={styles.newQuantityText}>
                  New quantity: {formatQuantity(newQuantity)} {shared.activeUnitSymbol}
                </Text>
              )}
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
      }}
    />
  );
};

const styles = StyleSheet.create(theme => ({
  costRow: {
    flexDirection: 'row',
    gap: theme.spacing.md },
  costField: {
    flex: 1 },
  newQuantityText: {
    fontSize: theme.fonts.size.sm,
    color: theme.colors.primary,
    marginTop: theme.spacing.xs,
    fontWeight: theme.fonts.weight.medium },
  pressed: {
    opacity: theme.opacity.pressed } }));
