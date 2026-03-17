import React, { useState, useEffect } from 'react';
import { View, Text } from 'react-native';
import { BottomSheetModal } from '@gorhom/bottom-sheet';
import { useStandardBottomSheet } from '#hooks/useStandardBottomSheet';
import { FormattedItemSubtitle } from '#components/atoms/FormattedItemSubtitle';
import { BottomSheetHeader } from '#components/atoms/BottomSheetHeader';
import { BottomSheetKeyboardAwareScrollView } from '#components/atoms/BottomSheetKeyboardAwareScrollView';
import { UnitPicker } from '#components/molecules/UnitPicker';
import {
  useOperationUnits,
  type SelectedUnitInfo,
  type PantryOperation,
} from '#hooks/pantry/useOperationUnits';
import { useConvertAvailableQuantity } from '#hooks/pantry/useConvertAvailableQuantity';
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
  /** Default unit resolved from ranked units */
  defaultUnit: SelectedUnitInfo | null;
  /** Default increment from the ranked unit API for the selected unit */
  defaultIncrement: number | null;
  /** Common fractions from the ranked unit API for the selected unit */
  commonFractions: number[] | null;
  /** Available quantity converted to the selected unit (null if same unit or failed) */
  availableInSelectedUnit: number | null;
  /** Whether the available quantity conversion is still loading */
  availableLoading: boolean;
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
  /** The operation type determines which unit eligibility query to use */
  operation: PantryOperation;
  onConfirm: (shared: PantryActionSharedState) => void;
  /** Called when the modal opens with a valid pantryItem. Use to reset consumer-specific state. */
  onReset?: (
    pantryItem: PantryItemFragment,
    defaultUnit: SelectedUnitInfo | null,
    defaultIncrement: number | null,
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
  operation,
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

  // Fetch operation-specific eligible units for the item
  const {
    groups,
    allUnits,
    defaultUnit,
    defaultIncrement,
    defaultCommonFractions,
    loading: unitsLoading,
  } = useOperationUnits({
    itemId: pantryItem?.itemId,
    pantryItemId: pantryItem?.id,
    trackingUnitId: pantryItem?.unit?.id,
    trackingUnitType: pantryItem?.unit?.type as UnitType | undefined,
    netWeightUnitId: pantryItem?.netWeightUnit?.id,
    operation,
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

  // Convert available quantity to the selected unit for display & validation
  const { availableInSelectedUnit, availableLoading } =
    useConvertAvailableQuantity({
      pantryItemId: pantryItem?.id,
      selectedUnitId: activeUnitId,
      trackingUnitId,
      availableInTrackingUnit: trackingQuantity,
      conversionRatio: selectedUnitInfo?.conversionRatio ?? null,
    });

  // Reset state when modal opens (render-time state update)
  const [prevVisible, setPrevVisible] = useState(visible);
  const [prevPantryItemId, setPrevPantryItemId] = useState(pantryItem?.id);
  if (visible !== prevVisible || pantryItem?.id !== prevPantryItemId) {
    setPrevVisible(visible);
    setPrevPantryItemId(pantryItem?.id);
    if (visible && pantryItem) {
      setNotes('');
      setSelectedUnitInfo(defaultUnit);
      onReset?.(pantryItem, defaultUnit, defaultIncrement);
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

  // Look up the selected unit's ranked metadata for increment/fractions
  const selectedRankedUnit = allUnits.find(
    u => u.unitId === selectedUnitInfo?.unitId,
  );

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
    defaultIncrement: selectedRankedUnit?.defaultIncrement ?? defaultIncrement,
    commonFractions:
      selectedRankedUnit?.commonFractions ?? defaultCommonFractions,
    availableInSelectedUnit,
    availableLoading,
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
