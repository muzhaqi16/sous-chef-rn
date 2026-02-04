import React, { useState, useCallback, useEffect, useRef } from 'react';
import { View, Text, Alert } from 'react-native';
import { FractionInput } from '#components/molecules/FractionInput';
import { FormInput } from '#components/molecules/FormInput';
import { FormattedItemSubtitle } from '#components/atoms/FormattedItemSubtitle';
import { BottomSheetHeader } from '#components/atoms/BottomSheetHeader';
import { BottomSheetKeyboardAwareScrollView } from '#components/atoms/BottomSheetKeyboardAwareScrollView';
import { DatePickerField } from '#components/molecules/DatePickerField';
import { BottomSheetModal } from '@gorhom/bottom-sheet';
import { GlobalBottomSheetBackdrop } from '#components/atoms/GlobalBottomSheetBackdrop';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSharedBottomSheetConfigs } from '#hooks/useSharedBottomSheetConfigs';
import { useBottomSheetBackHandler } from '#hooks/useBottomSheetBackHandler';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { parseFractionalInput } from '#/utils/fractionUtils';
import { PantryItemFragment } from '#generated';
import { commonStyles } from '#/styles/commonStyles';

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
  const { theme } = useUnistyles();
  const insets = useSafeAreaInsets();
  const bottomSheetRef = useRef<BottomSheetModal>(null);
  const animationConfigs = useSharedBottomSheetConfigs();
  useBottomSheetBackHandler(bottomSheetRef, visible);
  const [quantityInput, setQuantityInput] = useState('1');
  const [notes, setNotes] = useState('');
  const [costPerUnitInput, setCostPerUnitInput] = useState('');
  const [totalCostInput, setTotalCostInput] = useState('');
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);

  // Control bottom sheet visibility based on visible prop
  useEffect(() => {
    if (visible && pantryItem) {
      bottomSheetRef.current?.present();
      // Reset form when modal opens with new item
      setQuantityInput('1');
      setNotes('');
      setCostPerUnitInput('');
      setTotalCostInput('');
      setExpiresAt(null);
    } else {
      bottomSheetRef.current?.dismiss();
    }
  }, [visible, pantryItem]);

  const calculateNewQuantity = useCallback((): number | null => {
    if (!pantryItem) return null;
    const addAmount = parseFractionalInput(quantityInput);
    if (addAmount === null || isNaN(addAmount)) return null;
    const newQuantity = pantryItem.quantity + addAmount;
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

    // Parse cost values (optional)
    const costPerUnit = costPerUnitInput
      ? parseFloat(costPerUnitInput)
      : undefined;
    const totalCost = totalCostInput ? parseFloat(totalCostInput) : undefined;

    onConfirm(
      quantityValue,
      quantityInput,
      notes,
      unitId,
      isNaN(costPerUnit!) ? undefined : costPerUnit,
      isNaN(totalCost!) ? undefined : totalCost,
      expiresAt,
    );
    onClose();
  }, [
    pantryItem,
    quantityInput,
    notes,
    costPerUnitInput,
    totalCostInput,
    expiresAt,
    onConfirm,
    onClose,
  ]);

  const newQuantity = pantryItem ? calculateNewQuantity() : null;

  const formatQuantity = (qty: number): string => {
    if (Number.isInteger(qty)) return qty.toString();
    return qty.toFixed(2).replace(/\.?0+$/, '');
  };

  return (
    <BottomSheetModal
      ref={bottomSheetRef}
      snapPoints={['55%', '95%']}
      enablePanDownToClose
      enableDynamicSizing={false}
      topInset={insets.top}
      onDismiss={onClose}
      animationConfigs={animationConfigs}
      backgroundStyle={{ backgroundColor: theme.colors.background }}
      handleIndicatorStyle={{ backgroundColor: theme.colors.textSecondary }}
      keyboardBehavior="extend"
      keyboardBlurBehavior="restore"
      android_keyboardInputMode="adjustResize"
      backdropComponent={props => (
        <GlobalBottomSheetBackdrop
          {...props}
          disappearsOnIndex={-1}
          appearsOnIndex={0}
          pressBehavior="close"
          onClose={() => bottomSheetRef.current?.dismiss()}
        />
      )}
    >
      <BottomSheetKeyboardAwareScrollView
        style={commonStyles.bottomSheetScrollView}
        contentContainerStyle={[
          commonStyles.bottomSheetContent,
          { paddingBottom: insets.bottom + 16 },
        ]}
        showsVerticalScrollIndicator={false}
        bottomOffset={16}
      >
        {/* Header */}
        <BottomSheetHeader
          title="Restock Item"
          onCancel={onClose}
          onConfirm={handleConfirm}
          confirmLabel="Restock"
        />

        {pantryItem && (
          <>
            {/* Item Info */}
            <View style={commonStyles.bottomSheetItemInfo}>
              <Text style={commonStyles.bottomSheetItemName}>
                {pantryItem.itemName}
              </Text>
              <View style={commonStyles.bottomSheetItemRow}>
                <Text style={commonStyles.bottomSheetItemLabel}>Current: </Text>
                <FormattedItemSubtitle
                  quantity={pantryItem.quantity}
                  displayAsFraction={pantryItem.unit?.displayAsFraction}
                  unitSymbol={pantryItem.unit?.symbol}
                />
              </View>
            </View>

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
                  New quantity: {formatQuantity(newQuantity)}{' '}
                  {pantryItem.unit?.symbol || ''}
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
                value={notes}
                onChangeText={setNotes}
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
        )}
      </BottomSheetKeyboardAwareScrollView>
    </BottomSheetModal>
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
}));
