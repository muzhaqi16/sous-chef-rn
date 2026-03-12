import React, { useState, useEffect } from 'react';
import { View, Text } from 'react-native';
import { BottomSheetModal } from '@gorhom/bottom-sheet';
import { useStandardBottomSheet } from '#hooks/useStandardBottomSheet';
import { FormattedItemSubtitle } from '#components/atoms/FormattedItemSubtitle';
import { BottomSheetHeader } from '#components/atoms/BottomSheetHeader';
import { BottomSheetKeyboardAwareScrollView } from '#components/atoms/BottomSheetKeyboardAwareScrollView';
import { UnitPicker } from '#components/molecules/UnitPicker';
import {
  useCompatibleUnits,
  type SelectedUnitInfo,
} from '#hooks/pantry/useCompatibleUnits';
import type { PantryItemFragment, UnitType } from '#generated';
import { commonStyles } from '#/styles/commonStyles';

export interface PantryActionSharedState {
  selectedUnitInfo: SelectedUnitInfo | null;
  setSelectedUnitInfo: (unit: SelectedUnitInfo) => void;
  notes: string;
  setNotes: (notes: string) => void;
  /** Available quantity in the tracking unit (always the base) */
  trackingQuantity: number;
  /** The tracking unit's symbol */
  trackingUnitSymbol: string;
  /** The tracking unit's ID */
  trackingUnitId: string | undefined;
  /** The active unit symbol (selected unit or tracking unit fallback) */
  activeUnitSymbol: string;
  /** The active unit ID (selected unit or tracking unit fallback) */
  activeUnitId: string | undefined;
  /** Whether a non-tracking unit is selected (needs conversion) */
  isConvertedUnit: boolean;
  /** The pantry item's own ID for conversion queries */
  pantryItemId: string | undefined;
  /** Default unit resolved from compatible units */
  defaultUnit: SelectedUnitInfo | null;
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
  onReset?: (
    pantryItem: PantryItemFragment,
    defaultUnit: SelectedUnitInfo | null,
  ) => void;
  renderActionFields: (shared: PantryActionSharedState) => React.ReactNode;
}

/**
 * Shared base component for pantry action modals (Consume, RecordWaste, Restock).
 *
 * Manages common state (selectedUnit, notes) and renders the shared shell
 * (header, item info, unit picker). Action-specific form fields are
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
  const { ref, modalProps, contentContainerStyle } = useStandardBottomSheet({
    onDismiss: onClose,
    snapPoints,
  });

  const [selectedUnitInfo, setSelectedUnitInfo] =
    useState<SelectedUnitInfo | null>(null);
  const [notes, setNotes] = useState('');

  // Fetch compatible units for the item
  const {
    groups,
    defaultUnit,
    loading: unitsLoading,
  } = useCompatibleUnits({
    itemId: pantryItem?.itemId,
    trackingUnitId: pantryItem?.unit?.id,
    trackingUnitType: pantryItem?.unit?.type as UnitType | undefined,
    netWeightUnitId: pantryItem?.netWeightUnit?.id,
    contentUnitId: pantryItem?.packageBreakdown?.contentUnit?.id,
    defaultConsumeUnitId: pantryItem?.item?.defaultConsumeUnitId,
  });

  // Dual-tracking info (kept for the item info display)
  const isDualTracked =
    pantryItem?.remainingNetWeight != null && pantryItem?.netWeightUnit != null;
  const hasContentUnit =
    isDualTracked &&
    pantryItem?.packageBreakdown != null &&
    pantryItem.packageBreakdown.perUnitNetWeight != null &&
    pantryItem.packageBreakdown.perUnitNetWeight > 0;
  const contentUnitCount =
    pantryItem?.quantityBreakdown?.totalContentUnits != null
      ? Math.floor(pantryItem.quantityBreakdown.totalContentUnits)
      : hasContentUnit && pantryItem?.remainingNetWeight != null
      ? Math.floor(
          pantryItem.remainingNetWeight /
            pantryItem.packageBreakdown!.perUnitNetWeight!,
        )
      : 0;

  const trackingQuantity = pantryItem?.quantity ?? 0;
  const trackingUnitSymbol = pantryItem?.unit?.symbol || '';
  const trackingUnitId = pantryItem?.unit?.id;

  const activeUnitSymbol = selectedUnitInfo?.unitSymbol || trackingUnitSymbol;
  const activeUnitId = selectedUnitInfo?.unitId || trackingUnitId;
  const isConvertedUnit =
    selectedUnitInfo != null && !selectedUnitInfo.isTrackingUnit;

  // Reset state when modal opens (render-time state update)
  const [prevVisible, setPrevVisible] = useState(visible);
  const [prevPantryItemId, setPrevPantryItemId] = useState(pantryItem?.id);
  if (visible !== prevVisible || pantryItem?.id !== prevPantryItemId) {
    setPrevVisible(visible);
    setPrevPantryItemId(pantryItem?.id);
    if (visible && pantryItem) {
      setNotes('');
      setSelectedUnitInfo(defaultUnit);
      onReset?.(pantryItem, defaultUnit);
    }
  }

  // Also set default unit once it loads if we haven't selected anything yet
  const [prevDefaultUnitId, setPrevDefaultUnitId] = useState(
    defaultUnit?.unitId,
  );
  if (defaultUnit?.unitId !== prevDefaultUnitId) {
    setPrevDefaultUnitId(defaultUnit?.unitId);
    if (
      visible &&
      pantryItem &&
      selectedUnitInfo == null &&
      defaultUnit != null
    ) {
      setSelectedUnitInfo(defaultUnit);
    }
  }

  // Present/dismiss bottom sheet
  useEffect(() => {
    if (visible && pantryItem) {
      ref.current?.present();
    } else {
      ref.current?.dismiss();
    }
  }, [visible, pantryItem, ref]);

  const shared: PantryActionSharedState = {
    selectedUnitInfo,
    setSelectedUnitInfo,
    notes,
    setNotes,
    trackingQuantity,
    trackingUnitSymbol,
    trackingUnitId,
    activeUnitSymbol,
    activeUnitId,
    isConvertedUnit,
    pantryItemId: pantryItem?.id,
    defaultUnit,
  };

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
          title={title}
          onCancel={onClose}
          onConfirm={() => onConfirm(shared)}
          confirmLabel={confirmLabel}
          confirmColor={confirmColor}
        />

        {!!pantryItem && (
          <>
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
                    {' '}
                    (
                    {pantryItem.quantityBreakdown
                      ? `${
                          pantryItem.quantityBreakdown.fullPackages
                        } full + ${Math.floor(
                          pantryItem.quantityBreakdown.looseContentUnits,
                        )} loose ${
                          pantryItem.quantityBreakdown.contentUnit?.symbol || ''
                        }`
                      : hasContentUnit
                      ? `${contentUnitCount} ${
                          pantryItem.packageBreakdown!.contentUnit.symbol ||
                          pantryItem.packageBreakdown!.contentUnit.name
                        }`
                      : `${pantryItem.remainingNetWeight} ${pantryItem.netWeightUnit?.symbol}`}{' '}
                    remaining)
                  </Text>
                )}
              </View>
            </View>

            {/* Unit Picker */}
            <UnitPicker
              label={unitToggleLabel}
              groups={groups}
              selectedUnitId={selectedUnitInfo?.unitId}
              onSelect={setSelectedUnitInfo}
              loading={unitsLoading}
            />

            {/* Action-specific fields */}
            {renderActionFields(shared)}
          </>
        )}
      </BottomSheetKeyboardAwareScrollView>
    </BottomSheetModal>
  );
};
