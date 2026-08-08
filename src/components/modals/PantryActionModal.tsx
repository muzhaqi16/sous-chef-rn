import React, { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useFragment, useQuery } from '@apollo/client/react';
import { BottomSheetModal } from '#hooks/useStandardBottomSheet';
import { useStandardBottomSheet } from '#hooks/useStandardBottomSheet';
import { FormattedItemSubtitle } from '#components/atoms/FormattedItemSubtitle';
import { BottomSheetHeader } from '#components/atoms/BottomSheetHeader';
import { BottomSheetKeyboardAwareScrollView } from '#components/atoms/BottomSheetKeyboardAwareScrollView';
import { UnitPicker } from '#components/molecules/UnitPicker';
import {
  useOperationUnits,
  type SelectedUnitInfo,
  type PantryOperation,
} from '#features/pantry/hooks/useOperationUnits';
import { useConvertAvailableQuantity } from '#features/pantry/hooks/useConvertAvailableQuantity';
import { commonStyles } from '#/styles/commonStyles';
import { Text } from '#components/atoms/Text';
import { ThemedActivityIndicator } from '#components/atoms/themedComponents';
import {
  GetPantryActionItemDocument,
  PantryActionModal_PantryItemFragmentDoc,
  type PantryActionModal_PantryItemFragment,
} from './PantryActionModal.generated';

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
  /** For dual-tracked items: remaining quantity in net weight units */
  remainingNetWeight: number | null;
  /** For dual-tracked items: net weight unit symbol (e.g. "g") */
  netWeightUnitSymbol: string | undefined;
  /** For dual-tracked items: net weight unit ID */
  netWeightUnitId: string | undefined;
  /** Whether the item has dual-tracking (net weight + net weight unit) */
  isDualTracked: boolean;
}

interface PantryActionModalProps {
  visible: boolean;
  pantryItemId: string | null;
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
    pantryItem: PantryActionModal_PantryItemFragment,
    defaultUnit: SelectedUnitInfo | null,
    defaultIncrement: number | null,
  ) => void;
  renderActionFields: (
    shared: PantryActionSharedState,
    pantryItem: PantryActionModal_PantryItemFragment,
  ) => React.ReactNode;
}

/**
 * Shared base component for pantry action modals (Consume, RecordWaste, Restock).
 *
 * Manages common state (selectedUnit, notes) and renders the shared shell
 * (header, item info, unit picker). Action-specific form fields are
 * rendered via the `renderActionFields` prop.
 *
 * Reads the pantry item live from the Apollo cache via `useFragment` keyed
 * by `pantryItemId` so any cache update (e.g. an in-flight mutation) is
 * reflected in the open modal without re-snapshotting state.
 */
export const PantryActionModal: React.FC<PantryActionModalProps> = ({
  visible,
  pantryItemId,
  onClose,
  title,
  confirmLabel,
  confirmColor,
  snapPoints = ['75%', '95%'],
  unitToggleLabel,
  currentQuantityLabel,
  operation,
  onConfirm,
  onReset,
  renderActionFields,
}) => {
  const { t } = useTranslation();
  const resolvedUnitToggleLabel =
    unitToggleLabel ?? t('pantryAction.useByDefault');
  const resolvedCurrentQuantityLabel =
    currentQuantityLabel ?? t('pantryAction.availableDefault');
  const { ref, modalProps, contentContainerStyle } = useStandardBottomSheet({
    visible: visible && !!pantryItemId,
    onDismiss: onClose,
    snapPoints,
  });

  // Guarantee the modal's full read shape is in the cache regardless of how
  // the item arrived (list query, create mutation, subscription push).
  // `cache-first` is a no-op when the cache already satisfies the fragment and
  // only fetches when a field is missing — so partial entries self-heal.
  const { loading: itemQueryLoading } = useQuery(GetPantryActionItemDocument, {
    variables: { id: pantryItemId ?? '' },
    skip: !pantryItemId,
    fetchPolicy: 'cache-first',
    errorPolicy: 'all',
  });

  const { data, complete } = useFragment({
    fragment: PantryActionModal_PantryItemFragmentDoc,
    fragmentName: 'PantryActionModal_pantryItem',
    from: pantryItemId ? { __typename: 'PantryItem', id: pantryItemId } : null,
  });
  const pantryItem = pantryItemId && complete ? data : null;

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
    trackingUnitType: pantryItem?.unit?.type,
    netWeightUnitId: pantryItem?.netWeightUnit?.id,
    operation,
  });

  // Dual-tracking info (kept for the item info display)
  // Matches API lazy init: quantity × netWeight (see pantry-quantity-engine.md)
  const effectiveNetWeight =
    pantryItem?.remainingNetWeight ??
    (pantryItem?.netWeight != null
      ? pantryItem.quantity * pantryItem.netWeight
      : null);
  const isDualTracked =
    effectiveNetWeight != null && pantryItem?.netWeightUnit != null;
  // When tracking unit equals net-weight unit, the tracking count is redundant
  // (e.g. "1 g (100 g remaining)") — collapse the display to just the net weight.
  const isSingleUnitDualTracked =
    isDualTracked && pantryItem?.unit?.id === pantryItem?.netWeightUnit?.id;
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

  // Fallback: net weight unit for dual-tracked items, then tracking unit
  const fallbackUnitSymbol =
    pantryItem?.netWeightUnit?.symbol || trackingUnitSymbol;
  const fallbackUnitId = pantryItem?.netWeightUnit?.id || trackingUnitId;
  const activeUnitSymbol = selectedUnitInfo?.unitSymbol || fallbackUnitSymbol;
  const activeUnitId = selectedUnitInfo?.unitId || fallbackUnitId;
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
      remainingNetWeight: effectiveNetWeight,
      netWeightUnitId: pantryItem?.netWeightUnit?.id,
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
    remainingNetWeight: effectiveNetWeight,
    netWeightUnitSymbol: pantryItem?.netWeightUnit?.symbol,
    netWeightUnitId: pantryItem?.netWeightUnit?.id,
    isDualTracked,
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
                  {resolvedCurrentQuantityLabel}{' '}
                </Text>
                <FormattedItemSubtitle
                  quantity={
                    isSingleUnitDualTracked
                      ? effectiveNetWeight!
                      : pantryItem.quantity
                  }
                  displayAsFraction={
                    isSingleUnitDualTracked
                      ? undefined
                      : pantryItem.unit?.displayAsFraction
                  }
                  unitSymbol={
                    isSingleUnitDualTracked
                      ? pantryItem.netWeightUnit?.symbol
                      : pantryItem.unit?.symbol
                  }
                />
                {!!isDualTracked && !isSingleUnitDualTracked && (
                  <Text style={commonStyles.bottomSheetItemLabel}>
                    {' '}
                    {t('pantryAction.remainingAmount', {
                      amount: pantryItem.quantityBreakdown
                        ? `${
                            pantryItem.quantityBreakdown.fullPackages
                          } full + ${Math.floor(
                            pantryItem.quantityBreakdown.looseContentUnits,
                          )} loose ${
                            pantryItem.quantityBreakdown.contentUnit?.symbol ||
                            ''
                          }`
                        : hasContentUnit
                        ? `${contentUnitCount} ${
                            pantryItem.packageBreakdown!.contentUnit.symbol ||
                            pantryItem.packageBreakdown!.contentUnit.name
                          }`
                        : `${effectiveNetWeight} ${pantryItem.netWeightUnit?.symbol}`,
                    })}
                  </Text>
                )}
              </View>
            </View>

            {/* Unit Picker */}
            <UnitPicker
              label={resolvedUnitToggleLabel}
              groups={groups}
              selectedUnitId={selectedUnitInfo?.unitId}
              onSelect={setSelectedUnitInfo}
              loading={unitsLoading}
            />

            {/* Action-specific fields */}
            {renderActionFields(shared, pantryItem)}
          </>
        )}

        {!pantryItem && !!pantryItemId && itemQueryLoading ? (
          <View style={commonStyles.bottomSheetLoading}>
            <ThemedActivityIndicator />
          </View>
        ) : null}
      </BottomSheetKeyboardAwareScrollView>
    </BottomSheetModal>
  );
};
