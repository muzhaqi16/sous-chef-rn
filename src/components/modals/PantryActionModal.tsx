import React, { useState, useEffect } from 'react';
import { View, Text, Pressable } from 'react-native';
import { BottomSheetModal } from '@gorhom/bottom-sheet';
import { useStandardBottomSheet } from '#hooks/useStandardBottomSheet';
import { StyleSheet } from 'react-native-unistyles';
import { FormattedItemSubtitle } from '#components/atoms/FormattedItemSubtitle';
import { BottomSheetHeader } from '#components/atoms/BottomSheetHeader';
import { BottomSheetKeyboardAwareScrollView } from '#components/atoms/BottomSheetKeyboardAwareScrollView';
import { Icon } from '#/utils/iconUtils';
import type { PantryItemFragment } from '#generated';
import { commonStyles } from '#/styles/commonStyles';

export interface PantryActionSharedState {
  selectedUnit: 'tracking' | 'content' | 'weight';
  setSelectedUnit: (unit: 'tracking' | 'content' | 'weight') => void;
  notes: string;
  setNotes: (notes: string) => void;
  isDualTracked: boolean;
  hasContentUnit: boolean;
  contentUnitCount: number;
  availableQuantity: number;
  activeUnitSymbol: string;
  activeUnitId: string | undefined;
}

interface PantryActionModalProps {
  visible: boolean;
  pantryItem: PantryItemFragment | null;
  onClose: () => void;
  title: string;
  confirmLabel: string;
  confirmColor?: 'primary' | 'success' | 'warning' | 'error';
  snapPoints?: (string | number)[];
  unitToggleLabel?: string;
  currentQuantityLabel?: string;
  onConfirm: (shared: PantryActionSharedState) => void;
  /** Called when the modal opens with a valid pantryItem. Use to reset consumer-specific state. */
  onReset?: (pantryItem: PantryItemFragment, setSelectedUnit: (u: 'tracking' | 'content' | 'weight') => void) => void;
  renderActionFields: (shared: PantryActionSharedState) => React.ReactNode;
}

/**
 * Shared base component for pantry action modals (Consume, RecordWaste, Restock).
 *
 * Manages common state (selectedUnit, notes, dual-tracking computed values) and renders
 * the shared shell (header, item info, unit toggle). Action-specific form fields are
 * rendered via the `renderActionFields` prop.
 */
export const PantryActionModal: React.FC<PantryActionModalProps> = ({
  visible,
  pantryItem,
  onClose,
  title,
  confirmLabel,
  confirmColor,
  snapPoints = ['75%', '95%'],
  unitToggleLabel = 'Use by',
  currentQuantityLabel = 'Available:',
  onConfirm,
  onReset,
  renderActionFields,
}) => {
  const { ref, modalProps, contentContainerStyle, theme } = useStandardBottomSheet({
    onDismiss: onClose,
    snapPoints,
  });

  const [selectedUnit, setSelectedUnit] = useState<'tracking' | 'content' | 'weight'>('tracking');
  const [notes, setNotes] = useState('');

  // Dual-tracking computed values
  const isDualTracked = pantryItem?.remainingNetWeight != null && pantryItem?.netWeightUnit != null;

  const hasContentUnit = isDualTracked
    && pantryItem?.packageBreakdown != null
    && pantryItem.packageBreakdown.perUnitNetWeight != null
    && pantryItem.packageBreakdown.perUnitNetWeight > 0;

  const contentUnitCount = pantryItem?.quantityBreakdown?.totalContentUnits != null
    ? Math.floor(pantryItem.quantityBreakdown.totalContentUnits)
    : (hasContentUnit && pantryItem?.remainingNetWeight != null
      ? Math.floor(pantryItem.remainingNetWeight / pantryItem.packageBreakdown!.perUnitNetWeight!)
      : 0);

  const availableQuantity = (() => {
    if (selectedUnit === 'content' && hasContentUnit) return contentUnitCount;
    if (selectedUnit === 'weight' && isDualTracked) return pantryItem!.remainingNetWeight!;
    return pantryItem?.quantity ?? 0;
  })();

  const activeUnitSymbol = (() => {
    if (selectedUnit === 'content' && hasContentUnit) {
      return pantryItem!.packageBreakdown!.contentUnit.symbol || pantryItem!.packageBreakdown!.contentUnit.name;
    }
    if (selectedUnit === 'weight' && isDualTracked) {
      return pantryItem!.netWeightUnit!.symbol || '';
    }
    return pantryItem?.unit?.symbol || '';
  })();

  const activeUnitId = (() => {
    if (selectedUnit === 'content' && hasContentUnit) return pantryItem!.packageBreakdown!.contentUnit.id;
    if (selectedUnit === 'weight' && isDualTracked) return pantryItem!.netWeightUnit!.id;
    return pantryItem?.unit?.id;
  })();

  // Present/dismiss + reset
  useEffect(() => {
    if (visible && pantryItem) {
      ref.current?.present();
      setNotes('');
      setSelectedUnit('tracking');
      onReset?.(pantryItem, setSelectedUnit);
    } else {
      ref.current?.dismiss();
    }
  }, [visible, pantryItem, onReset, ref]);

  const shared: PantryActionSharedState = {
    selectedUnit,
    setSelectedUnit,
    notes,
    setNotes,
    isDualTracked,
    hasContentUnit,
    contentUnitCount,
    availableQuantity,
    activeUnitSymbol,
    activeUnitId,
  };

  return (
    <BottomSheetModal ref={ref} {...modalProps}>
      <BottomSheetKeyboardAwareScrollView
        style={commonStyles.bottomSheetScrollView}
        contentContainerStyle={[commonStyles.bottomSheetContent, contentContainerStyle]}
        showsVerticalScrollIndicator={false}
        bottomOffset={16}
      >
        <BottomSheetHeader
          title={title}
          onCancel={onClose}
          onConfirm={() => onConfirm(shared)}
          confirmLabel={confirmLabel}
          confirmColor={confirmColor}
        />

        {!!pantryItem && <>
            {/* Item Info */}
            <View style={commonStyles.bottomSheetItemInfo}>
              <Text style={commonStyles.bottomSheetItemName}>
                {pantryItem.itemName}
              </Text>
              <View style={commonStyles.bottomSheetItemRow}>
                <Text style={commonStyles.bottomSheetItemLabel}>
                  {currentQuantityLabel}{' '}
                </Text>
                <FormattedItemSubtitle
                  quantity={pantryItem.quantity}
                  displayAsFraction={pantryItem.unit?.displayAsFraction}
                  unitSymbol={pantryItem.unit?.symbol}
                />
                {!!isDualTracked && (
                  <Text style={commonStyles.bottomSheetItemLabel}>
                    {' '}({pantryItem.quantityBreakdown
                      ? `${pantryItem.quantityBreakdown.fullPackages} full + ${Math.floor(pantryItem.quantityBreakdown.looseContentUnits)} loose ${pantryItem.quantityBreakdown.contentUnit?.symbol || ''}`
                      : hasContentUnit
                        ? `${contentUnitCount} ${pantryItem.packageBreakdown!.contentUnit.symbol || pantryItem.packageBreakdown!.contentUnit.name}`
                        : `${pantryItem.remainingNetWeight} ${pantryItem.netWeightUnit?.symbol}`
                    } remaining)
                  </Text>
                )}
              </View>
            </View>

            {/* Unit Toggle for dual-tracked items */}
            {!!isDualTracked && (
              <View style={commonStyles.bottomSheetSection}>
                <Text style={commonStyles.bottomSheetSectionLabel}>
                  {unitToggleLabel}
                </Text>
                <View style={commonStyles.bottomSheetOptionContainer}>
                  <UnitOption
                    label={pantryItem.unit?.symbol || pantryItem.unit?.name || 'Unit'}
                    selected={selectedUnit === 'tracking'}
                    onPress={() => setSelectedUnit('tracking')}
                    primaryColor={theme.colors.primary}
                  />
                  {!!hasContentUnit && (
                    <UnitOption
                      label={pantryItem.packageBreakdown!.contentUnit.symbol || pantryItem.packageBreakdown!.contentUnit.name}
                      selected={selectedUnit === 'content'}
                      onPress={() => setSelectedUnit('content')}
                      primaryColor={theme.colors.primary}
                    />
                  )}
                  <UnitOption
                    label={pantryItem.netWeightUnit?.symbol || pantryItem.netWeightUnit?.name || 'Weight'}
                    selected={selectedUnit === 'weight'}
                    onPress={() => setSelectedUnit('weight')}
                    primaryColor={theme.colors.primary}
                  />
                </View>
              </View>
            )}

            {/* Action-specific fields */}
            {renderActionFields(shared)}
          </>}
      </BottomSheetKeyboardAwareScrollView>
    </BottomSheetModal>
  );
};

/** Single unit option pill used in the unit toggle section. */
const UnitOption: React.FC<{
  label: string;
  selected: boolean;
  onPress: () => void;
  primaryColor: string;
}> = ({ label, selected, onPress, primaryColor }) => (
  <Pressable
    style={({ pressed }) => [
      commonStyles.bottomSheetOption,
      selected && commonStyles.bottomSheetOptionSelected,
      pressed && styles.pressed,
    ]}
    onPress={onPress}
  >
    <Text
      style={[
        commonStyles.bottomSheetOptionText,
        selected && commonStyles.bottomSheetOptionTextSelected,
      ]}
    >
      {label}
    </Text>
    {!!selected && <Icon name="checkmark" size={16} color={primaryColor} />}
  </Pressable>
);

const styles = StyleSheet.create(theme => ({
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));
