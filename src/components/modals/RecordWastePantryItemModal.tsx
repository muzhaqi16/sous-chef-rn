import React, { useState, useCallback, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, Alert, Platform } from 'react-native';
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
import { FormCheckbox } from '#components/molecules/FormCheckbox';
import { FormattedItemSubtitle } from '#components/atoms/FormattedItemSubtitle';
import { Icon, parseFractionalInput } from '#/utils';
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
    wasteUnitId?: string,
    wasteWeight?: number,
    wasteWeightUnitId?: string,
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
  const [wasteAmountInput, setWasteAmountInput] = useState('');
  const [wasteReason, setWasteReason] = useState<WasteReason>(
    WasteReason.Expired,
  );
  const [isComposted, setIsComposted] = useState(false);
  const [isRecycled, setIsRecycled] = useState(false);
  const [notes, setNotes] = useState('');
  const [trackingUnit, setTrackingUnit] = useState<'count' | 'weight'>('count');

  // Determine tracking mode based on item properties
  const trackingMode = pantryItem ? determineTrackingMode(pantryItem) : 'count';

  // Calculate effective total weight (packageWeight or catalog weight * quantity)
  const getEffectiveTotalWeight = useCallback(
    (item: PantryItemFragment): number => {
      if (item.packageWeight != null && item.packageWeight > 0) {
        return item.packageWeight;
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
      const mode = determineTrackingMode(pantryItem);
      if (mode === 'count') {
        setTrackingUnit('count');
        setWasteAmountInput(pantryItem.currentQuantity.toString());
      } else {
        // Default to weight when available
        setTrackingUnit('weight');
        const totalWeight = getEffectiveTotalWeight(pantryItem);
        setWasteAmountInput(totalWeight.toString());
      }
      setWasteReason(WasteReason.Expired);
      setIsComposted(false);
      setIsRecycled(false);
      setNotes('');
    } else {
      bottomSheetRef.current?.dismiss();
    }
  }, [visible, pantryItem, getEffectiveTotalWeight]);

  const calculateRemaining = useCallback((): number | null => {
    if (!pantryItem) return null;
    const wasteAmount = parseFractionalInput(wasteAmountInput);
    if (wasteAmount === null || isNaN(wasteAmount)) return null;

    if (trackingUnit === 'weight') {
      // Calculate remaining weight using effective total weight
      const totalWeight = getEffectiveTotalWeight(pantryItem);
      const remaining = totalWeight - wasteAmount;
      return isNaN(remaining) ? null : remaining;
    } else {
      // Calculate remaining count
      const remaining = pantryItem.currentQuantity - wasteAmount;
      return isNaN(remaining) ? null : remaining;
    }
  }, [pantryItem, wasteAmountInput, trackingUnit, getEffectiveTotalWeight]);

  const handleConfirm = useCallback(() => {
    if (!pantryItem) return;

    const wasteValue = parseFractionalInput(wasteAmountInput);

    if (wasteValue === null || isNaN(wasteValue) || wasteValue <= 0) {
      Alert.alert('Error', 'Please enter a valid waste amount');
      return;
    }

    // Validate based on tracking unit
    if (trackingUnit === 'weight') {
      const totalWeight = getEffectiveTotalWeight(pantryItem);
      if (wasteValue > totalWeight) {
        Alert.alert(
          'Error',
          `Cannot waste more than available weight (${totalWeight} ${
            pantryItem.item?.displayUnit?.symbol || 'g'
          })`,
        );
        return;
      }
    } else {
      if (wasteValue > pantryItem.currentQuantity) {
        Alert.alert(
          'Error',
          `Cannot waste more than available quantity (${
            pantryItem.currentQuantity
          } ${pantryItem.unit?.symbol || ''})`,
        );
        return;
      }
    }

    // Determine the unit ID to send
    const wasteUnitId =
      trackingUnit === 'weight'
        ? pantryItem.item?.displayUnit?.id
        : pantryItem.unit?.id;

    // Calculate proportional weight when tracking by count and item has weight
    let wasteWeight: number | undefined;
    let wasteWeightUnitId: string | undefined;

    if (trackingUnit === 'count') {
      const totalWeight = getEffectiveTotalWeight(pantryItem);
      if (totalWeight > 0) {
        // Calculate per-item weight and multiply by waste quantity
        const perItemWeight = totalWeight / pantryItem.currentQuantity;
        wasteWeight = wasteValue * perItemWeight;
        wasteWeightUnitId =
          pantryItem.packageWeightUnit?.id ||
          pantryItem.item?.displayUnit?.id;
      }
      // If no weight tracking, wasteWeight and wasteWeightUnitId remain undefined
    }

    onConfirm(
      wasteValue,
      wasteReason,
      isComposted,
      isRecycled,
      notes,
      wasteUnitId,
      wasteWeight,
      wasteWeightUnitId,
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
    trackingUnit,
    getEffectiveTotalWeight,
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
        <Text style={styles.title}>Record Waste</Text>

        {pantryItem && (
          <>
            {/* Item Info */}
            <View style={styles.itemInfo}>
              <Text style={styles.itemName}>{pantryItem.itemName}</Text>
              <View style={styles.availableRow}>
                <Text style={styles.availableLabel}>Available: </Text>
                {trackingMode === 'count' ? (
                  <FormattedItemSubtitle
                    quantity={pantryItem.currentQuantity}
                    displayAsFraction={pantryItem.unit?.displayAsFraction}
                    unitSymbol={pantryItem.unit?.symbol}
                  />
                ) : (
                  <Text style={styles.availableValue}>
                    {getEffectiveTotalWeight(pantryItem)}{' '}
                    {pantryItem.item?.displayUnit?.symbol || 'g'}
                  </Text>
                )}
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
                      trackingUnit === 'count' &&
                        styles.unitToggleOptionSelected,
                    ]}
                    onPress={() => {
                      setTrackingUnit('count');
                      setWasteAmountInput(
                        pantryItem.currentQuantity.toString(),
                      );
                    }}
                  >
                    <Text
                      style={[
                        styles.unitToggleText,
                        trackingUnit === 'count' &&
                          styles.unitToggleTextSelected,
                      ]}
                    >
                      Count ({pantryItem.unit?.symbol || 'item'})
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.unitToggleOption,
                      trackingUnit === 'weight' &&
                        styles.unitToggleOptionSelected,
                    ]}
                    onPress={() => {
                      setTrackingUnit('weight');
                      setWasteAmountInput(
                        getEffectiveTotalWeight(pantryItem).toString(),
                      );
                    }}
                  >
                    <Text
                      style={[
                        styles.unitToggleText,
                        trackingUnit === 'weight' &&
                          styles.unitToggleTextSelected,
                      ]}
                    >
                      Weight ({pantryItem.item?.displayUnit?.symbol || 'g'})
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Waste Amount Input */}
            <View style={styles.section}>
              <FractionInput
                label={
                  trackingUnit === 'weight'
                    ? `Waste Amount (${
                        pantryItem.item?.displayUnit?.symbol || 'g'
                      }) *`
                    : `Waste Amount (${pantryItem.unit?.symbol || 'item'}) *`
                }
                value={wasteAmountInput}
                onChangeText={setWasteAmountInput}
                placeholder="e.g., 1, 1 1/4, or 1.5"
                keyboardType={
                  trackingUnit === 'weight'
                    ? Platform.OS === 'ios'
                      ? 'numbers-and-punctuation'
                      : 'decimal-pad'
                    : 'numeric'
                }
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
  availableValue: {
    fontSize: theme.fonts.size.base,
    color: theme.colors.textPrimary,
    fontWeight: theme.fonts.weight.semibold,
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
