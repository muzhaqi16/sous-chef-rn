import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, Alert } from 'react-native';
import { BottomSheetModal } from '@gorhom/bottom-sheet';
import { useStandardBottomSheet } from '#hooks/useStandardBottomSheet';
import { FractionInput } from '#components/molecules/FractionInput';
import { FormInput } from '#components/molecules/FormInput';
import { FormattedItemSubtitle } from '#components/atoms/FormattedItemSubtitle';
import { BottomSheetHeader } from '#components/atoms/BottomSheetHeader';
import { BottomSheetKeyboardAwareScrollView } from '#components/atoms/BottomSheetKeyboardAwareScrollView';
import { parseFractionalInput } from '#/utils/fractionUtils';
import { PantryItemFragment } from '#generated';
import { commonStyles } from '#/styles/commonStyles';
import { formatNetWeightDisplay } from '#hooks/pantry/usePantryItemTransformation';

interface AdjustQuantityModalProps {
  visible: boolean;
  pantryItem: PantryItemFragment | null;
  onClose: () => void;
  onConfirm: (newQuantity: number, reason: string, remainingNetWeight?: number) => void;
}

export const AdjustQuantityModal: React.FC<AdjustQuantityModalProps> = ({
  visible,
  pantryItem,
  onClose,
  onConfirm,
}) => {
  const { ref, modalProps, contentContainerStyle } = useStandardBottomSheet({
    visible: visible && !!pantryItem,
    onDismiss: onClose,
    snapPoints: ['65%', '85%'],
  });
  const [quantityInput, setQuantityInput] = useState('');
  const [reason, setReason] = useState('');
  const [remainingWeightInput, setRemainingWeightInput] = useState('');

  useEffect(() => {
    if (visible && pantryItem) {
      setQuantityInput(pantryItem.quantity.toString());
      setReason('');
      setRemainingWeightInput('');
    }
  }, [visible, pantryItem]);

  const handleConfirm = useCallback(() => {
    if (!pantryItem) return;

    const newQuantity = parseFractionalInput(quantityInput);

    if (newQuantity === null || isNaN(newQuantity) || newQuantity < 0) {
      Alert.alert('Error', 'Please enter a valid quantity');
      return;
    }

    if (!reason.trim()) {
      Alert.alert('Error', 'Please provide a reason for the adjustment');
      return;
    }

    const parsedWeight = parseFloat(remainingWeightInput);
    const remainingNetWeight = !isNaN(parsedWeight) && parsedWeight >= 0
      ? parsedWeight
      : undefined;

    onConfirm(newQuantity, reason.trim(), remainingNetWeight);
    onClose();
  }, [pantryItem, quantityInput, reason, remainingWeightInput, onConfirm, onClose]);

  return (
    <BottomSheetModal ref={ref} {...modalProps}>
      <BottomSheetKeyboardAwareScrollView
        style={commonStyles.bottomSheetScrollView}
        contentContainerStyle={[
          commonStyles.bottomSheetContent,
          contentContainerStyle,
        ]}
        showsVerticalScrollIndicator={false}
        bottomOffset={16}
      >
        <BottomSheetHeader
          title="Adjust Quantity"
          onCancel={onClose}
          onConfirm={handleConfirm}
          confirmLabel="Adjust"
        />

        {!!pantryItem && <>
            <View style={commonStyles.bottomSheetItemInfo}>
              <Text style={commonStyles.bottomSheetItemName}>
                {pantryItem.itemName}
              </Text>
              <View style={commonStyles.bottomSheetItemRow}>
                <Text style={commonStyles.bottomSheetItemLabel}>
                  Current:{' '}
                </Text>
                <FormattedItemSubtitle
                  quantity={pantryItem.quantity}
                  displayAsFraction={pantryItem.unit?.displayAsFraction}
                  unitSymbol={pantryItem.unit?.symbol}
                />
              </View>
            </View>

            {pantryItem.lastUsedAt != null &&
              pantryItem.remainingNetWeight != null && (
                <View style={commonStyles.bottomSheetItemRow}>
                  <Text style={commonStyles.bottomSheetItemLabel}>
                    Remaining: {formatNetWeightDisplay(pantryItem.remainingNetWeight, pantryItem.netWeightUnit)}
                  </Text>
                </View>
              )}

            <View style={commonStyles.bottomSheetSection}>
              <FractionInput
                label="New Quantity"
                required
                value={quantityInput}
                onChangeText={setQuantityInput}
                placeholder="e.g., 1, 1 1/4, or 1.5"
                keyboardType="numeric"
                useBottomSheetInput
              />
            </View>

            <View style={commonStyles.bottomSheetSection}>
              <FormInput
                label="Reason"
                required
                value={reason}
                onChangeText={setReason}
                placeholder="Why is the quantity being adjusted?"
                useBottomSheetInput
              />
            </View>

            {pantryItem.lastUsedAt != null &&
              pantryItem.remainingNetWeight != null && (
                  <FormInput
                    label="Remaining Weight"
                    value={remainingWeightInput}
                    onChangeText={setRemainingWeightInput}
                    placeholder="Leave blank to auto-adjust"
                    keyboardType="decimal-pad"
                    useBottomSheetInput
                  />
              )}
          </>}
      </BottomSheetKeyboardAwareScrollView>
    </BottomSheetModal>
  );
};
