import React, { useState, useCallback, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, Alert } from 'react-native';
import {
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetBackdrop,
} from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { FractionInput } from '#components/molecules/FractionInput';
import { FormInput } from '#components/molecules/FormInput';
import { FormCheckbox } from '#components/molecules/FormCheckbox';
import { FormattedItemSubtitle } from '#components/atoms/FormattedItemSubtitle';
import { Icon } from '#/utils';
import { WasteReason, PantryItemFragment } from '#generated';

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
  const [wasteAmountInput, setWasteAmountInput] = useState('');
  const [wasteReason, setWasteReason] = useState<WasteReason>(
    WasteReason.Expired,
  );
  const [isComposted, setIsComposted] = useState(false);
  const [isRecycled, setIsRecycled] = useState(false);
  const [notes, setNotes] = useState('');

  // Control bottom sheet visibility based on visible prop
  useEffect(() => {
    if (visible && pantryItem) {
      bottomSheetRef.current?.present();
      // Reset form when modal opens with new item
      setWasteAmountInput(pantryItem.currentQuantity.toString());
      setWasteReason(WasteReason.Expired);
      setIsComposted(false);
      setIsRecycled(false);
      setNotes('');
    } else {
      bottomSheetRef.current?.dismiss();
    }
  }, [visible, pantryItem]);

  const parseFractionalInput = useCallback((input: string): number | null => {
    try {
      const trimmed = input.trim();

      // Check if it contains a fraction
      if (trimmed.includes('/')) {
        const parts = trimmed.split(/\s+/);
        if (parts.length === 2) {
          // Mixed number like "1 1/4"
          const whole = parseInt(parts[0]);
          const [num, den] = parts[1].split('/').map(Number);
          return whole + num / den;
        } else {
          // Simple fraction like "3/4"
          const [num, den] = trimmed.split('/').map(Number);
          return num / den;
        }
      } else {
        // Regular number
        return parseFloat(trimmed);
      }
    } catch (err) {
      return null;
    }
  }, []);

  const calculateRemaining = useCallback((): number | null => {
    if (!pantryItem) return null;
    const wasteAmount = parseFractionalInput(wasteAmountInput);
    if (wasteAmount === null) return null;
    return pantryItem.currentQuantity - wasteAmount;
  }, [pantryItem, wasteAmountInput, parseFractionalInput]);

  const handleConfirm = useCallback(() => {
    if (!pantryItem) return;

    const wasteValue = parseFractionalInput(wasteAmountInput);

    if (wasteValue === null || isNaN(wasteValue) || wasteValue <= 0) {
      Alert.alert('Error', 'Please enter a valid waste amount');
      return;
    }

    if (wasteValue > pantryItem.currentQuantity) {
      Alert.alert(
        'Error',
        `Cannot waste more than available quantity (${
          pantryItem.currentQuantity
        } ${pantryItem.unit?.symbol || ''})`,
      );
      return;
    }

    onConfirm(wasteValue, wasteReason, isComposted, isRecycled, notes);
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
    parseFractionalInput,
  ]);

  const remaining = pantryItem ? calculateRemaining() : null;

  return (
    <BottomSheetModal
      ref={bottomSheetRef}
      snapPoints={['80%']}
      enablePanDownToClose
      enableDynamicSizing={false}
      topInset={insets.top}
      onDismiss={onClose}
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
        <Text style={styles.title}>Record Waste</Text>

        {pantryItem && (
          <>
            {/* Item Info */}
            <View style={styles.itemInfo}>
              <Text style={styles.itemName}>{pantryItem.itemName}</Text>
              <View style={styles.availableRow}>
                <Text style={styles.availableLabel}>Available: </Text>
                <FormattedItemSubtitle
                  quantity={pantryItem.currentQuantity}
                  quantityInput={pantryItem.quantityInput}
                  displayFormat={pantryItem.displayFormat}
                  displayAsFraction={pantryItem.unit?.displayAsFraction}
                  netWeight={pantryItem.item?.netWeight}
                  unitSymbol={pantryItem.item?.displayUnit?.symbol || pantryItem.unit?.symbol}
                />
              </View>
            </View>

            {/* Waste Amount Input */}
            <View style={styles.section}>
              <FractionInput
                label="Waste Amount *"
                value={wasteAmountInput}
                onChangeText={setWasteAmountInput}
                placeholder="e.g., 1, 1 1/4, or 1.5"
              />
              {remaining !== null && (
                <Text
                  style={[
                    styles.remainingText,
                    remaining < 0 && styles.remainingTextError,
                  ]}
                >
                  Remaining: {remaining >= 0 ? remaining.toFixed(2) : 'Invalid'}{' '}
                  {pantryItem.unit?.symbol || ''}
                </Text>
              )}
            </View>

            {/* Waste Reason Selection */}
            <View style={styles.section}>
              <Text style={styles.label}>Waste Reason *</Text>
              <View style={styles.reasonOptions}>
                {WASTE_REASON_OPTIONS.map(option => (
                  <TouchableOpacity
                    key={option.value}
                    style={[
                      styles.reasonOption,
                      wasteReason === option.value &&
                        styles.reasonOptionSelected,
                    ]}
                    onPress={() => setWasteReason(option.value)}
                  >
                    <Text
                      style={[
                        styles.reasonOptionText,
                        wasteReason === option.value &&
                          styles.reasonOptionTextSelected,
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
            <View style={styles.section}>
              <Text style={styles.label}>Sustainability</Text>
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
            <View style={styles.section}>
              <FormInput
                label="Notes (Optional)"
                value={notes}
                onChangeText={setNotes}
                placeholder="Add any notes about this waste..."
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
                <Text style={styles.confirmButtonText}>Record Waste</Text>
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
  label: {
    fontSize: theme.fonts.size.sm,
    fontWeight: theme.fonts.weight.semibold,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.sm,
  },
  remainingText: {
    fontSize: theme.fonts.size.sm,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.xs,
  },
  remainingTextError: {
    color: theme.colors.error,
  },
  reasonOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  reasonOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radii.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    gap: theme.spacing.xs,
  },
  reasonOptionSelected: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.surfaceVariant,
  },
  reasonOptionText: {
    fontSize: theme.fonts.size.sm,
    color: theme.colors.textSecondary,
  },
  reasonOptionTextSelected: {
    color: theme.colors.primary,
    fontWeight: theme.fonts.weight.semibold,
  },
  checkboxContainer: {
    marginBottom: theme.spacing.sm,
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
    backgroundColor: theme.colors.warning,
  },
  confirmButtonText: {
    fontSize: theme.fonts.size.base,
    fontWeight: theme.fonts.weight.semibold,
    color: theme.colors.onPrimary || '#FFFFFF',
  },
}));
