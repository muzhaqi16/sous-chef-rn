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
import { FormattedItemSubtitle } from '#components/atoms/FormattedItemSubtitle';
import { Icon, parseFractionalInput } from '#/utils';
import { UsagePurpose, PantryItemFragment } from '#generated';

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
    weightUsed?: number,
    weightUsedUnitId?: string,
  ) => void;
}

type TrackingMode = 'count' | 'weight' | 'both';

/**
 * Determines the tracking mode based on item properties:
 * - No weight → count only
 * - Count = 1 → weight only
 * - Count > 1 AND has weight → let user choose
 */
function determineTrackingMode(pantryItem: PantryItemFragment): TrackingMode {
  const hasWeight =
    pantryItem.item?.netWeight != null && pantryItem.item?.displayUnit != null;
  const count = pantryItem.currentQuantity;

  if (!hasWeight) return 'count';
  if (count === 1) return 'weight';
  return 'both';
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
  const insets = useSafeAreaInsets();
  const bottomSheetRef = useRef<BottomSheetModal>(null);
  const [quantityInput, setQuantityInput] = useState('1');
  const [purpose, setPurpose] = useState<UsagePurpose>(UsagePurpose.General);
  const [notes, setNotes] = useState('');
  const [trackingUnit, setTrackingUnit] = useState<'count' | 'weight'>('count');

  // Determine tracking mode based on item properties
  const trackingMode = pantryItem ? determineTrackingMode(pantryItem) : 'count';

  /**
   * Calculate the effective total weight for an item.
   * Uses actualNetWeight override if set, otherwise falls back to
   * catalog per-item weight * quantity.
   */
  const getEffectiveTotalWeight = useCallback(
    (item: PantryItemFragment): number => {
      if (item.actualNetWeight != null && item.actualNetWeight > 0) {
        return item.actualNetWeight;
      }
      // Fall back to catalog per-item weight * quantity
      const perItemWeight = item.item?.netWeight ?? 0;
      return perItemWeight * item.currentQuantity;
    },
    [],
  );

  // Control bottom sheet visibility based on visible prop
  useEffect(() => {
    if (visible && pantryItem) {
      bottomSheetRef.current?.present();
      // Reset form when modal opens with new item
      setQuantityInput('1');
      setPurpose(UsagePurpose.General);
      setNotes('');
      // Set default tracking unit based on mode
      const mode = determineTrackingMode(pantryItem);
      if (mode === 'count') {
        setTrackingUnit('count');
      } else {
        // Default to weight when available
        setTrackingUnit('weight');
      }
    } else {
      bottomSheetRef.current?.dismiss();
    }
  }, [visible, pantryItem]);

  const calculateRemaining = useCallback((): number | null => {
    if (!pantryItem) return null;
    const consumeAmount = parseFractionalInput(quantityInput);
    if (consumeAmount === null) return null;

    if (trackingUnit === 'weight') {
      // Calculate remaining weight
      const totalWeight = getEffectiveTotalWeight(pantryItem);
      return totalWeight - consumeAmount;
    } else {
      // Calculate remaining count
      return pantryItem.currentQuantity - consumeAmount;
    }
  }, [pantryItem, quantityInput, trackingUnit, getEffectiveTotalWeight]);

  const handleConfirm = useCallback(() => {
    if (!pantryItem) return;

    const quantityValue = parseFractionalInput(quantityInput);

    if (quantityValue === null || isNaN(quantityValue) || quantityValue <= 0) {
      Alert.alert('Error', 'Please enter a valid quantity');
      return;
    }

    // Validate based on tracking unit
    if (trackingUnit === 'weight') {
      const totalWeight = getEffectiveTotalWeight(pantryItem);
      if (quantityValue > totalWeight) {
        Alert.alert(
          'Error',
          `Cannot consume more than available weight (${totalWeight} ${
            pantryItem.item?.displayUnit?.symbol || 'g'
          })`,
        );
        return;
      }
    } else {
      if (quantityValue > pantryItem.currentQuantity) {
        Alert.alert(
          'Error',
          `Cannot consume more than available quantity (${
            pantryItem.currentQuantity
          } ${pantryItem.unit?.symbol || ''})`,
        );
        return;
      }
    }

    // Determine the unit ID to send
    const usageUnitId =
      trackingUnit === 'weight'
        ? pantryItem.item?.displayUnit?.id
        : pantryItem.unit?.id;

    // Calculate weight values when tracking by count
    let weightUsed: number | undefined;
    let weightUsedUnitId: string | undefined;

    if (trackingUnit === 'count') {
      const totalWeight = getEffectiveTotalWeight(pantryItem);
      if (totalWeight > 0) {
        const perItemWeight = totalWeight / pantryItem.currentQuantity;
        weightUsed = quantityValue * perItemWeight;
        weightUsedUnitId =
          pantryItem.actualNetWeightUnit?.id || pantryItem.item?.displayUnit?.id;
      }
    }

    onConfirm(
      quantityValue,
      quantityInput,
      purpose,
      notes,
      usageUnitId,
      weightUsed,
      weightUsedUnitId,
    );
    onClose();
  }, [
    pantryItem,
    quantityInput,
    purpose,
    notes,
    onConfirm,
    onClose,
    trackingUnit,
    getEffectiveTotalWeight,
  ]);

  const remaining = pantryItem ? calculateRemaining() : null;

  return (
    <BottomSheetModal
      ref={bottomSheetRef}
      snapPoints={['75%']}
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
        <Text style={styles.title}>Consume Item</Text>

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
                  unitSymbol={
                    pantryItem.item?.displayUnit?.symbol ||
                    pantryItem.unit?.symbol
                  }
                />
              </View>
            </View>

            {/* Unit Toggle - only show when both count and weight are available */}
            {trackingMode === 'both' && (
              <View style={styles.section}>
                <Text style={styles.label}>Track by</Text>
                <View style={styles.unitToggleContainer}>
                  <TouchableOpacity
                    style={[
                      styles.unitToggleOption,
                      trackingUnit === 'count' && styles.unitToggleOptionSelected,
                    ]}
                    onPress={() => {
                      setTrackingUnit('count');
                      setQuantityInput('1');
                    }}
                  >
                    <Text
                      style={[
                        styles.unitToggleText,
                        trackingUnit === 'count' && styles.unitToggleTextSelected,
                      ]}
                    >
                      Count ({pantryItem.unit?.symbol || 'item'})
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.unitToggleOption,
                      trackingUnit === 'weight' && styles.unitToggleOptionSelected,
                    ]}
                    onPress={() => {
                      setTrackingUnit('weight');
                      setQuantityInput('1');
                    }}
                  >
                    <Text
                      style={[
                        styles.unitToggleText,
                        trackingUnit === 'weight' && styles.unitToggleTextSelected,
                      ]}
                    >
                      Weight ({pantryItem.item?.displayUnit?.symbol || 'g'})
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Quantity Input */}
            <View style={styles.section}>
              <FractionInput
                label={
                  trackingUnit === 'weight'
                    ? `Weight to Consume (${pantryItem.item?.displayUnit?.symbol || 'g'}) *`
                    : `Quantity to Consume (${pantryItem.unit?.symbol || 'item'}) *`
                }
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
                  {trackingUnit === 'weight'
                    ? pantryItem.item?.displayUnit?.symbol || 'g'
                    : pantryItem.unit?.symbol || ''}
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
                        purpose === option.value &&
                          styles.purposeOptionTextSelected,
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
  unitToggleContainer: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  unitToggleOption: {
    flex: 1,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radii.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
  },
  unitToggleOptionSelected: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.surfaceVariant,
  },
  unitToggleText: {
    fontSize: theme.fonts.size.sm,
    color: theme.colors.textSecondary,
  },
  unitToggleTextSelected: {
    color: theme.colors.primary,
    fontWeight: theme.fonts.weight.semibold,
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
    backgroundColor: theme.colors.primary,
  },
  confirmButtonText: {
    fontSize: theme.fonts.size.base,
    fontWeight: theme.fonts.weight.semibold,
    color: theme.colors.onPrimary || '#FFFFFF',
  },
}));
