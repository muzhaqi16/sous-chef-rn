import React, { useState, useCallback } from 'react';
import { View, Text, Pressable, Alert } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { FractionInput } from '#components/molecules/FractionInput';
import { FormInput } from '#components/molecules/FormInput';
import { Icon } from '#/utils/iconUtils';
import { parseFractionalInput } from '#/utils/fractionUtils';
import { formatQuantity } from '#/utils/formatQuantity';
import { UsagePurpose, PantryItemFragment } from '#generated';
import { commonStyles } from '#/styles/commonStyles';
import { PantryActionModal, type PantryActionSharedState } from './PantryActionModal';

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
  const [quantityInput, setQuantityInput] = useState('1');
  const [purpose, setPurpose] = useState<UsagePurpose>(UsagePurpose.General);

  const handleReset = useCallback((item: PantryItemFragment, setSelectedUnit: (u: 'tracking' | 'content' | 'weight') => void) => {
    const defaultIncrement = item.item?.defaultConsumeIncrement;
    setQuantityInput(defaultIncrement ? defaultIncrement.toString() : '1');
    setPurpose(UsagePurpose.General);

    // Check if defaultConsumeUnit matches one of the available unit options
    const defaultConsumeUnitId = item.item?.defaultConsumeUnitId;
    const isDualTracked = item.remainingNetWeight != null && item.netWeightUnit != null;
    const hasContentUnit = isDualTracked
      && item.packageBreakdown != null
      && item.packageBreakdown.perUnitNetWeight != null
      && item.packageBreakdown.perUnitNetWeight > 0;

    if (defaultConsumeUnitId) {
      if (item.unit?.id === defaultConsumeUnitId) {
        setSelectedUnit('tracking');
      } else if (isDualTracked && hasContentUnit && item.packageBreakdown?.contentUnit?.id === defaultConsumeUnitId) {
        setSelectedUnit('content');
      } else if (isDualTracked && item.netWeightUnit?.id === defaultConsumeUnitId) {
        setSelectedUnit('weight');
      } else {
        setSelectedUnit('tracking');
      }
    } else {
      setSelectedUnit('tracking');
    }
  }, []);

  const handleConfirm = useCallback((shared: PantryActionSharedState) => {
    if (!pantryItem) return;

    const quantityValue = parseFractionalInput(quantityInput);
    if (quantityValue === null || isNaN(quantityValue) || quantityValue <= 0) {
      Alert.alert('Error', 'Please enter a valid quantity');
      return;
    }
    if (quantityValue > shared.availableQuantity) {
      Alert.alert('Error', `Cannot consume more than available quantity (${shared.availableQuantity} ${shared.activeUnitSymbol})`);
      return;
    }

    onConfirm(quantityValue, quantityInput, purpose, shared.notes, shared.activeUnitId);
    onClose();
  }, [pantryItem, quantityInput, purpose, onConfirm, onClose]);

  // Note: remaining is computed in renderActionFields where shared.availableQuantity is available

  return (
    <PantryActionModal
      visible={visible}
      pantryItem={pantryItem}
      onClose={onClose}
      title="Consume Item"
      confirmLabel="Confirm"
      snapPoints={['75%', '95%']}
      unitToggleLabel="Consume by"
      onConfirm={handleConfirm}
      onReset={handleReset}
      renderActionFields={(shared) => {
        const consumeAmount = parseFractionalInput(quantityInput);
        const remaining = consumeAmount !== null && !isNaN(consumeAmount)
          ? shared.availableQuantity - consumeAmount
          : null;
        return (
        <>
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
                {shared.activeUnitSymbol}
              </Text>
            )}
          </View>

          {/* Purpose Selection */}
          <View style={commonStyles.bottomSheetSection}>
            <Text style={commonStyles.bottomSheetSectionLabel}>Purpose *</Text>
            <View style={commonStyles.bottomSheetOptionContainer}>
              {PURPOSE_OPTIONS.map(option => (
                <Pressable
                  key={option.value}
                  style={({ pressed }) => [
                    commonStyles.bottomSheetOption,
                    purpose === option.value && commonStyles.bottomSheetOptionSelected,
                    pressed && styles.pressed,
                  ]}
                  onPress={() => setPurpose(option.value)}
                >
                  <Text
                    style={[
                      commonStyles.bottomSheetOptionText,
                      purpose === option.value && commonStyles.bottomSheetOptionTextSelected,
                    ]}
                  >
                    {option.label}
                  </Text>
                  {purpose === option.value && (
                    <Icon name="checkmark" size={16} color={theme.colors.primary} />
                  )}
                </Pressable>
              ))}
            </View>
          </View>

          {/* Notes */}
          <View style={commonStyles.bottomSheetSection}>
            <FormInput
              label="Notes"
              value={shared.notes}
              onChangeText={shared.setNotes}
              placeholder="Add any notes about this usage..."
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
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));
