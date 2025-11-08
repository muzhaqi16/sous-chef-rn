import React, { useState, useCallback, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { FractionInput } from '#components/molecules/FractionInput';
import { FormInput } from '#components/molecules/FormInput';
import { Icon } from '#/utils';
import { UsagePurpose, PantryItemFragment } from '#generated';

interface ConsumePantryItemModalProps {
  visible: boolean;
  pantryItem: PantryItemFragment | null;
  onClose: () => void;
  onConfirm: (quantityUsed: number, quantityInput: string, purpose: UsagePurpose, notes: string) => void;
}

const PURPOSE_OPTIONS: Array<{ label: string; value: UsagePurpose }> = [
  { label: 'Cooking', value: UsagePurpose.Cooking },
  { label: 'Meal Prep', value: UsagePurpose.MealPrep },
  { label: 'Snack', value: UsagePurpose.Snack },
  { label: 'General', value: UsagePurpose.General },
  { label: 'Gift', value: UsagePurpose.Gift },
  { label: 'Transfer', value: UsagePurpose.Transfer },
  // Note: WASTE removed - use dedicated recordPantryItemWaste mutation instead
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
  const [notes, setNotes] = useState('');

  // Reset form when modal opens with new item
  useEffect(() => {
    if (visible && pantryItem) {
      // Default to 1 (defaultConsumeAmount feature not yet implemented)
      setQuantityInput('1');
      setPurpose(UsagePurpose.General);
      setNotes('');
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
    const consumeAmount = parseFractionalInput(quantityInput);
    if (consumeAmount === null) return null;
    return pantryItem.currentQuantity - consumeAmount;
  }, [pantryItem, quantityInput, parseFractionalInput]);

  const handleConfirm = useCallback(() => {
    if (!pantryItem) return;

    const quantityValue = parseFractionalInput(quantityInput);

    if (quantityValue === null || isNaN(quantityValue) || quantityValue <= 0) {
      Alert.alert('Error', 'Please enter a valid quantity');
      return;
    }

    if (quantityValue > pantryItem.currentQuantity) {
      Alert.alert(
        'Error',
        `Cannot consume more than available quantity (${pantryItem.currentQuantity} ${pantryItem.unit?.symbol || ''})`,
      );
      return;
    }

    onConfirm(quantityValue, quantityInput, purpose, notes);
    onClose();
  }, [pantryItem, quantityInput, purpose, notes, onConfirm, onClose, parseFractionalInput]);

  if (!pantryItem) return null;

  const remaining = calculateRemaining();

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={onClose}
            style={styles.closeButton}
          >
            <Icon
              library="Feather"
              name="x"
              size={24}
              color={theme.colors.textPrimary}
            />
          </TouchableOpacity>
          <Text style={styles.title}>Consume Item</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView style={styles.content}>
          {/* Item Info */}
          <View style={styles.itemInfo}>
            <Text style={styles.itemName}>{pantryItem.itemName}</Text>
            <Text style={styles.currentQuantity}>
              Available: {pantryItem.currentQuantity} {pantryItem.unit?.symbol || ''}
            </Text>
          </View>

          {/* Quantity Input */}
          <View style={styles.section}>
            <FractionInput
              label="Quantity to Consume *"
              value={quantityInput}
              onChangeText={setQuantityInput}
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

          {/* Purpose Selection */}
          <View style={styles.section}>
            <Text style={styles.label}>Purpose *</Text>
            <View style={styles.purposeOptions}>
              {PURPOSE_OPTIONS.map(option => (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.purposeOption,
                    purpose === option.value && styles.purposeOptionSelected,
                  ]}
                  onPress={() => setPurpose(option.value)}
                >
                  <Text
                    style={[
                      styles.purposeOptionText,
                      purpose === option.value && styles.purposeOptionTextSelected,
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
          <View style={styles.section}>
            <FormInput
              label="Notes (Optional)"
              value={notes}
              onChangeText={setNotes}
              placeholder="Add any notes about this usage..."
              multiline
              numberOfLines={3}
            />
          </View>
        </ScrollView>

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
            <Text style={styles.confirmButtonText}>Confirm</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create(theme => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: theme.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.divider,
  },
  closeButton: {
    padding: theme.spacing.xs,
    minWidth: 40,
  },
  title: {
    fontSize: theme.fonts.size.xl,
    fontWeight: theme.fonts.weight.semibold,
    color: theme.colors.textPrimary,
    textAlign: 'center',
    flex: 1,
  },
  headerSpacer: {
    width: 40,
  },
  content: {
    flex: 1,
    padding: theme.spacing.lg,
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
  currentQuantity: {
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
  purposeOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  purposeOption: {
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
  purposeOptionSelected: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.surfaceVariant,
  },
  purposeOptionText: {
    fontSize: theme.fonts.size.sm,
    color: theme.colors.textSecondary,
  },
  purposeOptionTextSelected: {
    color: theme.colors.primary,
    fontWeight: theme.fonts.weight.semibold,
  },
  actions: {
    flexDirection: 'row',
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.divider,
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
    backgroundColor: theme.colors.primary,
  },
  confirmButtonText: {
    fontSize: theme.fonts.size.base,
    fontWeight: theme.fonts.weight.semibold,
    color: theme.colors.onPrimary || '#FFFFFF',
  },
}));
