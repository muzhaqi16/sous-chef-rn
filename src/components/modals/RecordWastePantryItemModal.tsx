import React, { useState, useCallback, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, Alert } from 'react-native';
import { BottomSheetModal } from '@gorhom/bottom-sheet';
import { GlobalBottomSheetBackdrop } from '#components/atoms/GlobalBottomSheetBackdrop';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSharedBottomSheetConfigs } from '#hooks/useSharedBottomSheetConfigs';
import { useBottomSheetBackHandler } from '#hooks/useBottomSheetBackHandler';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { FractionInput } from '#components/molecules/FractionInput';
import { FormInput } from '#components/molecules/FormInput';
import { FormCheckbox } from '#components/molecules/FormCheckbox';
import { FormattedItemSubtitle } from '#components/atoms/FormattedItemSubtitle';
import { BottomSheetHeader } from '#components/atoms/BottomSheetHeader';
import { BottomSheetKeyboardAwareScrollView } from '#components/atoms/BottomSheetKeyboardAwareScrollView';
import { Icon } from '#/utils/iconUtils';
import { parseFractionalInput } from '#/utils/fractionUtils';
import { WasteReason, PantryItemFragment } from '#generated';
import { commonStyles } from '#/styles/commonStyles';

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
  { label: 'Overstock', value: WasteReason.Overstock },
  { label: 'Bad Taste', value: WasteReason.Taste },
  { label: 'Other', value: WasteReason.Other },
];

export const RecordWastePantryItemModal: React.FC<
  RecordWastePantryItemModalProps
> = ({ visible, pantryItem, onClose, onConfirm }) => {
  const { theme } = useUnistyles();
  const insets = useSafeAreaInsets();
  const bottomSheetRef = useRef<BottomSheetModal>(null);
  const animationConfigs = useSharedBottomSheetConfigs();
  useBottomSheetBackHandler(bottomSheetRef, visible);
  const [wasteAmountInput, setWasteAmountInput] = useState('');
  const [wasteReason, setWasteReason] = useState<WasteReason>(
    WasteReason.Expired,
  );
  const [isComposted, setIsComposted] = useState(false);
  const [isRecycled, setIsRecycled] = useState(false);
  const [notes, setNotes] = useState('');
  const [selectedUnit, setSelectedUnit] = useState<'tracking' | 'weight'>('tracking');

  // Determine if this item supports dual-tracking
  const isDualTracked = pantryItem?.remainingNetWeight != null && pantryItem?.netWeightUnit != null;

  // Control bottom sheet visibility based on visible prop
  useEffect(() => {
    if (visible && pantryItem) {
      bottomSheetRef.current?.present();
      // Reset form when modal opens with new item - default to full quantity
      setWasteAmountInput(pantryItem.quantity.toString());
      setWasteReason(WasteReason.Expired);
      setIsComposted(false);
      setIsRecycled(false);
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
    const wasteAmount = parseFractionalInput(wasteAmountInput);
    if (wasteAmount === null || isNaN(wasteAmount)) return null;

    const remaining = availableQuantity - wasteAmount;
    return isNaN(remaining) ? null : remaining;
  }, [pantryItem, wasteAmountInput, availableQuantity]);

  const handleConfirm = useCallback(() => {
    if (!pantryItem) return;

    const wasteValue = parseFractionalInput(wasteAmountInput);

    if (wasteValue === null || isNaN(wasteValue) || wasteValue <= 0) {
      Alert.alert('Error', 'Please enter a valid waste amount');
      return;
    }

    if (wasteValue > availableQuantity) {
      Alert.alert(
        'Error',
        `Cannot waste more than available quantity (${availableQuantity} ${activeUnitSymbol})`,
      );
      return;
    }

    onConfirm(
      wasteValue,
      wasteReason,
      isComposted,
      isRecycled,
      notes,
      activeUnitId,
    );
    onClose();
  }, [
    pantryItem,
    wasteAmountInput,
    wasteReason,
    isComposted,
    isRecycled,
    notes,
    onConfirm,
    onClose,
    availableQuantity,
    activeUnitSymbol,
    activeUnitId,
  ]);

  const remaining = pantryItem ? calculateRemaining() : null;

  const formatQuantity = (qty: number): string => {
    if (Number.isInteger(qty)) return qty.toString();
    return qty.toFixed(2).replace(/\.?0+$/, '');
  };

  return (
    <BottomSheetModal
      ref={bottomSheetRef}
      snapPoints={['80%', '95%']}
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
          title="Record Waste"
          onCancel={onClose}
          onConfirm={handleConfirm}
          confirmLabel="Record Waste"
          confirmColor="warning"
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
                  Waste by
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

            {/* Waste Reason Selection */}
            <View style={commonStyles.bottomSheetSection}>
              <Text style={commonStyles.bottomSheetSectionLabel}>
                Waste Reason *
              </Text>
              <View style={commonStyles.bottomSheetOptionContainer}>
                {WASTE_REASON_OPTIONS.map(option => (
                  <TouchableOpacity
                    key={option.value}
                    style={[
                      commonStyles.bottomSheetOption,
                      wasteReason === option.value &&
                        commonStyles.bottomSheetOptionSelected,
                    ]}
                    onPress={() => setWasteReason(option.value)}
                  >
                    <Text
                      style={[
                        commonStyles.bottomSheetOptionText,
                        wasteReason === option.value &&
                          commonStyles.bottomSheetOptionTextSelected,
                      ]}
                    >
                      {option.label}
                    </Text>
                    {wasteReason === option.value && (
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

            {/* Sustainability Tracking */}
            <View style={commonStyles.bottomSheetSection}>
              <Text style={commonStyles.bottomSheetSectionLabel}>
                Sustainability
              </Text>
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

            {/* Notes (Optional) */}
            <View style={commonStyles.bottomSheetSection}>
              <FormInput
                label="Notes"
                value={notes}
                onChangeText={setNotes}
                placeholder="Add any notes about this waste..."
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

const styles = StyleSheet.create(theme => ({
  checkboxContainer: {
    marginBottom: theme.spacing.sm,
  },
}));
