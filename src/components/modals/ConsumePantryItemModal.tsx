import React, { useState, useCallback, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, Alert } from 'react-native';
import { BottomSheetModal } from '@gorhom/bottom-sheet';
import { GlobalBottomSheetBackdrop } from '#components/atoms/GlobalBottomSheetBackdrop';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSharedBottomSheetConfigs } from '#hooks/useSharedBottomSheetConfigs';
import { useBottomSheetBackHandler } from '#hooks/useBottomSheetBackHandler';
import { useUnistyles } from 'react-native-unistyles';
import { FractionInput } from '#components/molecules/FractionInput';
import { FormInput } from '#components/molecules/FormInput';
import { FormattedItemSubtitle } from '#components/atoms/FormattedItemSubtitle';
import { BottomSheetHeader } from '#components/atoms/BottomSheetHeader';
import { BottomSheetKeyboardAwareScrollView } from '#components/atoms/BottomSheetKeyboardAwareScrollView';
import { Icon } from '#/utils/iconUtils';
import { parseFractionalInput } from '#/utils/fractionUtils';
import { UsagePurpose, PantryItemFragment } from '#generated';
import { commonStyles } from '#/styles/commonStyles';

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
  const { theme } = useUnistyles();
  const insets = useSafeAreaInsets();
  const bottomSheetRef = useRef<BottomSheetModal>(null);
  const animationConfigs = useSharedBottomSheetConfigs();
  useBottomSheetBackHandler(bottomSheetRef, visible);
  const [quantityInput, setQuantityInput] = useState('1');
  const [purpose, setPurpose] = useState<UsagePurpose>(UsagePurpose.General);
  const [notes, setNotes] = useState('');
  const [selectedUnit, setSelectedUnit] = useState<'tracking' | 'weight'>('tracking');

  // Determine if this item supports dual-tracking
  const isDualTracked = pantryItem?.remainingNetWeight != null && pantryItem?.netWeightUnit != null;

  // Control bottom sheet visibility based on visible prop
  useEffect(() => {
    if (visible && pantryItem) {
      bottomSheetRef.current?.present();
      // Reset form when modal opens with new item
      setQuantityInput('1');
      setPurpose(UsagePurpose.General);
      setNotes('');
      setSelectedUnit('tracking');
    } else {
      bottomSheetRef.current?.dismiss();
    }
  }, [visible, pantryItem]);

  // Get the available quantity and unit symbol based on selected unit
  const availableQuantity = selectedUnit === 'weight' && isDualTracked
    ? pantryItem!.remainingNetWeight!
    : pantryItem?.quantity ?? 0;

  const activeUnitSymbol = selectedUnit === 'weight' && isDualTracked
    ? pantryItem!.netWeightUnit!.symbol || ''
    : pantryItem?.unit?.symbol || '';

  const activeUnitId = selectedUnit === 'weight' && isDualTracked
    ? pantryItem!.netWeightUnit!.id
    : pantryItem?.unit?.id;

  const calculateRemaining = useCallback((): number | null => {
    if (!pantryItem) return null;
    const consumeAmount = parseFractionalInput(quantityInput);
    if (consumeAmount === null || isNaN(consumeAmount)) return null;

    const remaining = availableQuantity - consumeAmount;
    return isNaN(remaining) ? null : remaining;
  }, [pantryItem, quantityInput, availableQuantity]);

  const handleConfirm = useCallback(() => {
    if (!pantryItem) return;

    const quantityValue = parseFractionalInput(quantityInput);

    if (quantityValue === null || isNaN(quantityValue) || quantityValue <= 0) {
      Alert.alert('Error', 'Please enter a valid quantity');
      return;
    }

    if (quantityValue > availableQuantity) {
      Alert.alert(
        'Error',
        `Cannot consume more than available quantity (${availableQuantity} ${activeUnitSymbol})`,
      );
      return;
    }

    onConfirm(
      quantityValue,
      quantityInput,
      purpose,
      notes,
      activeUnitId,
    );
    onClose();
  }, [pantryItem, quantityInput, purpose, notes, onConfirm, onClose, availableQuantity, activeUnitSymbol, activeUnitId]);

  const remaining = pantryItem ? calculateRemaining() : null;

  const formatQuantity = (qty: number): string => {
    if (Number.isInteger(qty)) return qty.toString();
    return qty.toFixed(2).replace(/\.?0+$/, '');
  };

  return (
    <BottomSheetModal
      ref={bottomSheetRef}
      snapPoints={['75%', '95%']}
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
          title="Consume Item"
          onCancel={onClose}
          onConfirm={handleConfirm}
          confirmLabel="Confirm"
        />

        {pantryItem && (
          <>
            {/* Item Info */}
            <View style={commonStyles.bottomSheetItemInfo}>
              <Text style={commonStyles.bottomSheetItemName}>
                {pantryItem.itemName}
              </Text>
              <View style={commonStyles.bottomSheetItemRow}>
                <Text style={commonStyles.bottomSheetItemLabel}>
                  Available:{' '}
                </Text>
                <FormattedItemSubtitle
                  quantity={pantryItem.quantity}
                  displayAsFraction={pantryItem.unit?.displayAsFraction}
                  unitSymbol={pantryItem.unit?.symbol}
                />
                {isDualTracked && (
                  <Text style={commonStyles.bottomSheetItemLabel}>
                    {' '}({pantryItem.remainingNetWeight} {pantryItem.netWeightUnit?.symbol} remaining)
                  </Text>
                )}
              </View>
            </View>

            {/* Unit Toggle for dual-tracked items */}
            {isDualTracked && (
              <View style={commonStyles.bottomSheetSection}>
                <Text style={commonStyles.bottomSheetSectionLabel}>
                  Consume by
                </Text>
                <View style={commonStyles.bottomSheetOptionContainer}>
                  <TouchableOpacity
                    style={[
                      commonStyles.bottomSheetOption,
                      selectedUnit === 'tracking' && commonStyles.bottomSheetOptionSelected,
                    ]}
                    onPress={() => setSelectedUnit('tracking')}
                  >
                    <Text
                      style={[
                        commonStyles.bottomSheetOptionText,
                        selectedUnit === 'tracking' && commonStyles.bottomSheetOptionTextSelected,
                      ]}
                    >
                      {pantryItem.unit?.symbol || pantryItem.unit?.name || 'Unit'}
                    </Text>
                    {selectedUnit === 'tracking' && (
                      <Icon library="Feather" name="check" size={16} color={theme.colors.primary} />
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      commonStyles.bottomSheetOption,
                      selectedUnit === 'weight' && commonStyles.bottomSheetOptionSelected,
                    ]}
                    onPress={() => setSelectedUnit('weight')}
                  >
                    <Text
                      style={[
                        commonStyles.bottomSheetOptionText,
                        selectedUnit === 'weight' && commonStyles.bottomSheetOptionTextSelected,
                      ]}
                    >
                      {pantryItem.netWeightUnit?.symbol || pantryItem.netWeightUnit?.name || 'Weight'}
                    </Text>
                    {selectedUnit === 'weight' && (
                      <Icon library="Feather" name="check" size={16} color={theme.colors.primary} />
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            )}

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
              {remaining !== null && (
                <Text
                  style={[
                    commonStyles.bottomSheetHelperText,
                    remaining < 0 && commonStyles.bottomSheetHelperTextError,
                  ]}
                >
                  Remaining: {remaining >= 0 ? formatQuantity(remaining) : 'Invalid'}{' '}
                  {activeUnitSymbol}
                </Text>
              )}
            </View>

            {/* Purpose Selection */}
            <View style={commonStyles.bottomSheetSection}>
              <Text style={commonStyles.bottomSheetSectionLabel}>
                Purpose *
              </Text>
              <View style={commonStyles.bottomSheetOptionContainer}>
                {PURPOSE_OPTIONS.map(option => (
                  <TouchableOpacity
                    key={option.value}
                    style={[
                      commonStyles.bottomSheetOption,
                      purpose === option.value &&
                        commonStyles.bottomSheetOptionSelected,
                    ]}
                    onPress={() => setPurpose(option.value)}
                  >
                    <Text
                      style={[
                        commonStyles.bottomSheetOptionText,
                        purpose === option.value &&
                          commonStyles.bottomSheetOptionTextSelected,
                      ]}
                    >
                      {option.label}
                    </Text>
                    {purpose === option.value && (
                      <Icon
                        library="Feather"
                        name="check"
                        size={16}
                        color={theme.colors.primary}
                      />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Notes (Optional) */}
            <View style={commonStyles.bottomSheetSection}>
              <FormInput
                label="Notes"
                value={notes}
                onChangeText={setNotes}
                placeholder="Add any notes about this usage..."
                multiline
                numberOfLines={3}
                useBottomSheetInput
              />
            </View>
          </>
        )}
      </BottomSheetKeyboardAwareScrollView>
    </BottomSheetModal>
  );
};
