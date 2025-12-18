import React, { useState, useCallback, useEffect, useRef } from 'react';
import { View, Text, Alert } from 'react-native';
import {
  Button,
  FractionInput,
  FormInput,
  FormattedItemSubtitle,
} from '#components';
import {
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetBackdrop,
} from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSharedBottomSheetConfigs } from '#hooks';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { parseFractionalInput } from '#/utils';
import { PantryItemFragment } from '#generated';

interface RestockPantryItemModalProps {
  visible: boolean;
  pantryItem: PantryItemFragment | null;
  onClose: () => void;
  onConfirm: (
    quantity: number,
    quantityInput: string,
    notes: string,
    unitId?: string,
    weight?: number,
    weightUnitId?: string,
    costPerUnit?: number,
    totalCost?: number,
  ) => void;
}

export const RestockPantryItemModal: React.FC<RestockPantryItemModalProps> = ({
  visible,
  pantryItem,
  onClose,
  onConfirm,
}) => {
  const { theme } = useUnistyles();
  const insets = useSafeAreaInsets();
  const bottomSheetRef = useRef<BottomSheetModal>(null);
  const animationConfigs = useSharedBottomSheetConfigs();
  const [quantityInput, setQuantityInput] = useState('1');
  const [weightInput, setWeightInput] = useState('');
  const [notes, setNotes] = useState('');
  const [costPerUnitInput, setCostPerUnitInput] = useState('');
  const [totalCostInput, setTotalCostInput] = useState('');

  // Control bottom sheet visibility based on visible prop
  useEffect(() => {
    if (visible && pantryItem) {
      bottomSheetRef.current?.present();
      // Reset form when modal opens with new item
      setQuantityInput('1');
      setWeightInput('');
      setNotes('');
      setCostPerUnitInput('');
      setTotalCostInput('');
    } else {
      bottomSheetRef.current?.dismiss();
    }
  }, [visible, pantryItem]);

  const calculateNewQuantity = useCallback((): number | null => {
    if (!pantryItem) return null;
    const addAmount = parseFractionalInput(quantityInput);
    if (addAmount === null || isNaN(addAmount)) return null;
    const newQuantity = pantryItem.currentQuantity + addAmount;
    return isNaN(newQuantity) ? null : newQuantity;
  }, [pantryItem, quantityInput]);

  // Calculate new weight for weight-tracked items
  const calculateNewWeight = useCallback((): number | null => {
    if (!pantryItem || pantryItem.packageWeight == null) return null;
    const addWeight = parseFractionalInput(weightInput);
    if (addWeight === null || isNaN(addWeight)) return null;
    const newWeight = pantryItem.packageWeight + addWeight;
    return isNaN(newWeight) ? null : newWeight;
  }, [pantryItem, weightInput]);

  // Check if this is a weight-tracked item
  const isWeightTracked = pantryItem?.packageWeight != null && pantryItem.packageWeight > 0;

  const handleConfirm = useCallback(() => {
    if (!pantryItem) return;

    const quantityValue = parseFractionalInput(quantityInput);

    if (quantityValue === null || isNaN(quantityValue) || quantityValue <= 0) {
      Alert.alert('Error', 'Please enter a valid quantity');
      return;
    }

    // Use the item's current unit
    const unitId = pantryItem.unit?.id;

    // Parse weight for weight-tracked items
    const weightValue = weightInput ? parseFractionalInput(weightInput) : undefined;
    const weightUnitId = weightValue != null && weightValue > 0
      ? pantryItem.packageWeightUnit?.id
      : undefined;

    // Parse cost values (optional)
    const costPerUnit = costPerUnitInput
      ? parseFloat(costPerUnitInput)
      : undefined;
    const totalCost = totalCostInput
      ? parseFloat(totalCostInput)
      : undefined;

    onConfirm(
      quantityValue,
      quantityInput,
      notes,
      unitId,
      weightValue ?? undefined,
      weightUnitId,
      isNaN(costPerUnit!) ? undefined : costPerUnit,
      isNaN(totalCost!) ? undefined : totalCost,
    );
    onClose();
  }, [pantryItem, quantityInput, weightInput, notes, costPerUnitInput, totalCostInput, onConfirm, onClose]);

  const newQuantity = pantryItem ? calculateNewQuantity() : null;
  const newWeight = pantryItem ? calculateNewWeight() : null;

  return (
    <BottomSheetModal
      ref={bottomSheetRef}
      snapPoints={['60%']}
      enablePanDownToClose
      enableDynamicSizing={false}
      topInset={insets.top}
      onDismiss={onClose}
      animationConfigs={animationConfigs}
      backgroundStyle={{ backgroundColor: theme.colors.background }}
      handleIndicatorStyle={{ backgroundColor: theme.colors.textSecondary }}
      backdropComponent={props => (
        <BottomSheetBackdrop
          {...props}
          disappearsOnIndex={-1}
          appearsOnIndex={0}
          pressBehavior="close"
        />
      )}
    >
      <BottomSheetScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.contentContainer,
          { paddingBottom: insets.bottom + 16 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <Text style={styles.title}>Restock Item</Text>

        {pantryItem && (
          <>
            {/* Item Info */}
            <View style={styles.itemInfo}>
              <Text style={styles.itemName}>{pantryItem.itemName}</Text>
              <View style={styles.availableRow}>
                <Text style={styles.availableLabel}>Current: </Text>
                {pantryItem.packageWeight != null && pantryItem.packageWeight > 0 ? (
                  <Text style={styles.availableValue}>
                    {pantryItem.packageWeight} {pantryItem.packageWeightUnit?.symbol || 'g'}
                  </Text>
                ) : (
                  <FormattedItemSubtitle
                    quantity={pantryItem.currentQuantity}
                    displayAsFraction={pantryItem.unit?.displayAsFraction}
                    unitSymbol={pantryItem.unit?.symbol}
                  />
                )}
              </View>
            </View>

            {/* Quantity Input */}
            <View style={styles.section}>
              <FractionInput
                label={
                  isWeightTracked
                    ? 'Items to Add *'
                    : `Quantity to Add (${pantryItem.unit?.symbol || 'item'}) *`
                }
                value={quantityInput}
                onChangeText={setQuantityInput}
                placeholder="e.g., 1, 1 1/4, or 1.5"
                keyboardType="numeric"
              />
              {newQuantity !== null && !isWeightTracked && (
                <Text style={styles.newQuantityText}>
                  New quantity: {newQuantity.toFixed(2)} {pantryItem.unit?.symbol || ''}
                </Text>
              )}
            </View>

            {/* Weight Input - only for weight-tracked items */}
            {isWeightTracked && (
              <View style={styles.section}>
                <FractionInput
                  label={`Weight to Add (${pantryItem.packageWeightUnit?.symbol || 'g'})`}
                  value={weightInput}
                  onChangeText={setWeightInput}
                  placeholder="e.g., 150"
                  keyboardType="decimal-pad"
                />
                {newWeight !== null && (
                  <Text style={styles.newQuantityText}>
                    New total weight: {newWeight.toFixed(0)} {pantryItem.packageWeightUnit?.symbol || 'g'}
                  </Text>
                )}
              </View>
            )}

            {/* Cost Tracking (Optional) */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Cost (Optional)</Text>
              <View style={styles.costRow}>
                <View style={styles.costField}>
                  <FormInput
                    label="Cost per Unit"
                    value={costPerUnitInput}
                    onChangeText={setCostPerUnitInput}
                    placeholder="0.00"
                    keyboardType="decimal-pad"
                  />
                </View>
                <View style={styles.costField}>
                  <FormInput
                    label="Total Cost"
                    value={totalCostInput}
                    onChangeText={setTotalCostInput}
                    placeholder="0.00"
                    keyboardType="decimal-pad"
                  />
                </View>
              </View>
            </View>

            {/* Notes (Optional) */}
            <View style={styles.section}>
              <FormInput
                label="Notes (Optional)"
                value={notes}
                onChangeText={setNotes}
                placeholder="Add any notes about this restock..."
                multiline
                numberOfLines={3}
              />
            </View>

            {/* Actions */}
            <View style={styles.actions}>
              <Button
                title="Cancel"
                variant="secondary"
                onPress={onClose}
                fullWidth
              />
              <Button
                title="Restock"
                variant="primary"
                onPress={handleConfirm}
                fullWidth
              />
            </View>
          </>
        )}
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
};

const styles = StyleSheet.create(theme => ({
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    padding: theme.spacing.md,
  },
  title: {
    fontSize: theme.fonts.size.xl,
    fontWeight: theme.fonts.weight.semibold,
    color: theme.colors.textPrimary,
    textAlign: 'center',
    marginBottom: theme.spacing.lg,
  },
  itemInfo: {
    marginBottom: theme.spacing.xl,
    padding: theme.spacing.md,
    backgroundColor: theme.colors.surfaceVariant,
    borderRadius: theme.radii.md,
  },
  itemName: {
    fontSize: theme.fonts.size.lg,
    fontWeight: theme.fonts.weight.semibold,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.xs,
  },
  availableRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  availableLabel: {
    fontSize: theme.fonts.size.base,
    color: theme.colors.textSecondary,
  },
  availableValue: {
    fontSize: theme.fonts.size.base,
    color: theme.colors.textPrimary,
    fontWeight: theme.fonts.weight.semibold,
  },
  section: {
    marginBottom: theme.spacing.xl,
  },
  sectionLabel: {
    fontSize: theme.fonts.size.sm,
    fontWeight: theme.fonts.weight.medium,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.sm,
  },
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
  actions: {
    flexDirection: 'row',
    marginTop: theme.spacing.lg,
    gap: theme.spacing.md,
  },
}));
