import React, { useState, useCallback, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, Alert } from 'react-native';
import {
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetBackdrop,
} from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSharedBottomSheetConfigs } from '#hooks';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { FractionInput } from '#components/molecules/FractionInput';
import { FormInput } from '#components/molecules/FormInput';
import { FormattedItemSubtitle } from '#components/atoms/FormattedItemSubtitle';
import { parseFractionalInput } from '#/utils';
import { PantryItemFragment } from '#generated';

interface RestockPantryItemModalProps {
  visible: boolean;
  pantryItem: PantryItemFragment | null;
  onClose: () => void;
  onConfirm: (quantity: number, quantityInput: string, notes: string, unitId?: string) => void;
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
  const [notes, setNotes] = useState('');

  // Control bottom sheet visibility based on visible prop
  useEffect(() => {
    if (visible && pantryItem) {
      bottomSheetRef.current?.present();
      // Reset form when modal opens with new item
      setQuantityInput('1');
      setNotes('');
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

  const handleConfirm = useCallback(() => {
    if (!pantryItem) return;

    const quantityValue = parseFractionalInput(quantityInput);

    if (quantityValue === null || isNaN(quantityValue) || quantityValue <= 0) {
      Alert.alert('Error', 'Please enter a valid quantity');
      return;
    }

    // Use the item's current unit
    const unitId = pantryItem.unit?.id;

    onConfirm(quantityValue, quantityInput, notes, unitId);
    onClose();
  }, [pantryItem, quantityInput, notes, onConfirm, onClose]);

  const newQuantity = pantryItem ? calculateNewQuantity() : null;

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
                <FormattedItemSubtitle
                  quantity={pantryItem.currentQuantity}
                  displayAsFraction={pantryItem.unit?.displayAsFraction}
                  unitSymbol={pantryItem.unit?.symbol}
                />
              </View>
            </View>

            {/* Quantity Input */}
            <View style={styles.section}>
              <FractionInput
                label={`Quantity to Add (${pantryItem.unit?.symbol || 'item'}) *`}
                value={quantityInput}
                onChangeText={setQuantityInput}
                placeholder="e.g., 1, 1 1/4, or 1.5"
                keyboardType="numeric"
              />
              {newQuantity !== null && (
                <Text style={styles.newQuantityText}>
                  New quantity: {newQuantity.toFixed(2)} {pantryItem.unit?.symbol || ''}
                </Text>
              )}
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
              <TouchableOpacity
                style={[styles.button, styles.cancelButton]}
                onPress={onClose}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, styles.confirmButton]}
                onPress={handleConfirm}
              >
                <Text style={styles.confirmButtonText}>Restock</Text>
              </TouchableOpacity>
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
  section: {
    marginBottom: theme.spacing.xl,
  },
  newQuantityText: {
    fontSize: theme.fonts.size.sm,
    color: theme.colors.success,
    marginTop: theme.spacing.xs,
    fontWeight: theme.fonts.weight.medium,
  },
  actions: {
    flexDirection: 'row',
    marginTop: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  button: {
    flex: 1,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  cancelButtonText: {
    fontSize: theme.fonts.size.base,
    fontWeight: theme.fonts.weight.semibold,
    color: theme.colors.textSecondary,
  },
  confirmButton: {
    backgroundColor: theme.colors.success,
  },
  confirmButtonText: {
    fontSize: theme.fonts.size.base,
    fontWeight: theme.fonts.weight.semibold,
    color: theme.colors.onPrimary || '#FFFFFF',
  },
}));
