import React, { useState, useCallback } from 'react';
import { View, Text, Pressable, Alert } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { FractionInput } from '#components/molecules/FractionInput';
import { FormInput } from '#components/molecules/FormInput';
import { FormCheckbox } from '#components/molecules/FormCheckbox';
import { Icon } from '#/utils/iconUtils';
import { parseFractionalInput } from '#/utils/fractionUtils';
import { formatQuantity } from '#/utils/formatQuantity';
import { WasteReason, PantryItemFragment } from '#generated';
import { commonStyles } from '#/styles/commonStyles';
import { PantryActionModal, type PantryActionSharedState } from './PantryActionModal';

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

export const RecordWastePantryItemModal: React.FC<RecordWastePantryItemModalProps> = ({
  visible,
  pantryItem,
  onClose,
  onConfirm,
}) => {
  const { theme } = useUnistyles();
  const [wasteAmountInput, setWasteAmountInput] = useState('');
  const [wasteReason, setWasteReason] = useState<WasteReason>(WasteReason.Expired);
  const [isComposted, setIsComposted] = useState(false);
  const [isRecycled, setIsRecycled] = useState(false);

  const handleReset = useCallback((item: PantryItemFragment) => {
    setWasteAmountInput(item.quantity.toString());
    setWasteReason(WasteReason.Expired);
    setIsComposted(false);
    setIsRecycled(false);
  }, []);

  const handleConfirm = useCallback((shared: PantryActionSharedState) => {
    if (!pantryItem) return;

    const wasteValue = parseFractionalInput(wasteAmountInput);
    if (wasteValue === null || isNaN(wasteValue) || wasteValue <= 0) {
      Alert.alert('Error', 'Please enter a valid waste amount');
      return;
    }
    if (wasteValue > shared.availableQuantity) {
      Alert.alert('Error', `Cannot waste more than available quantity (${shared.availableQuantity} ${shared.activeUnitSymbol})`);
      return;
    }

    onConfirm(wasteValue, wasteReason, isComposted, isRecycled, shared.notes, shared.activeUnitId);
    onClose();
  }, [pantryItem, wasteAmountInput, wasteReason, isComposted, isRecycled, onConfirm, onClose]);

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
      renderActionFields={(shared) => {
        const wasteAmount = parseFractionalInput(wasteAmountInput);
        const remaining = wasteAmount !== null && !isNaN(wasteAmount)
          ? shared.availableQuantity - wasteAmount
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
              {remaining !== null && (
                <Text
                  style={[
                    commonStyles.bottomSheetHelperText,
                    remaining < 0 && commonStyles.bottomSheetHelperTextError,
                  ]}
                >
                  Remaining: {remaining >= 0 ? formatQuantity(remaining) : 'Invalid'}{' '}
                  {shared.activeUnitSymbol}
                </Text>
              )}
            </View>

            {/* Waste Reason Selection */}
            <View style={commonStyles.bottomSheetSection}>
              <Text style={commonStyles.bottomSheetSectionLabel}>Waste Reason *</Text>
              <View style={commonStyles.bottomSheetOptionContainer}>
                {WASTE_REASON_OPTIONS.map(option => (
                  <Pressable
                    key={option.value}
                    style={({ pressed }) => [
                      commonStyles.bottomSheetOption,
                      wasteReason === option.value && commonStyles.bottomSheetOptionSelected,
                      pressed && styles.pressed,
                    ]}
                    onPress={() => setWasteReason(option.value)}
                  >
                    <Text
                      style={[
                        commonStyles.bottomSheetOptionText,
                        wasteReason === option.value && commonStyles.bottomSheetOptionTextSelected,
                      ]}
                    >
                      {option.label}
                    </Text>
                    {wasteReason === option.value && (
                      <Icon name="checkmark" size={16} color={theme.colors.primary} />
                    )}
                  </Pressable>
                ))}
              </View>
            </View>

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
      }}
    />
  );
};

const styles = StyleSheet.create(theme => ({
  checkboxContainer: {
    marginBottom: theme.spacing.sm,
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));
