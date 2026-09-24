import React, { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from '#/i18n';
import { BottomSheetModal } from '#hooks/useStandardBottomSheet';
import { useStandardBottomSheet } from '#hooks/useStandardBottomSheet';
import { FormattedItemSubtitle } from '#components/molecules/FormattedItemSubtitle';
import { BottomSheetHeader } from '#components/molecules/BottomSheetHeader';
import { BottomSheetFormScrollView } from '#components/atoms/BottomSheetFormScrollView';
import { UnitPicker } from '#features/pantry/components/UnitPicker';
import {
  useOperationUnits,
  type SelectedUnitInfo,
  type PantryOperation,
} from '#features/pantry/hooks/useOperationUnits';
import { useConvertAvailableQuantity } from '#features/pantry/hooks/useConvertAvailableQuantity';
import { commonStyles } from '#/styles/commonStyles';
import { Text } from '#components/atoms/Text';
import {
  formatQuantityForDisplay,
  getUnitDisplayText,
} from '#/utils/formatQuantity';
import { ThemedActivityIndicator } from '#components/atoms/themedComponents';
import type { PantryActionModal_PantryItemFragment } from './PantryActionModal.generated';
import { usePantryActionItem } from '#features/pantry/hooks/usePantryActionItem';

export interface PantryActionSharedState {
  selectedUnitInfo: SelectedUnitInfo | null;
  setSelectedUnitInfo: (unit: SelectedUnitInfo) => void;
  notes: string;
  setNotes: (notes: string) => void;
  /** Available quantity in the tracking unit, which is always the base. */
  trackingQuantity: number;
  trackingUnitSymbol: string;
  trackingUnitId: string | undefined;
  /** A unit's own notation; null where its flag is unknown. */
  displayAsFractionOf: (unitId: string | undefined) => boolean | null;
  /** Selected unit, falling back to the tracking unit. */
  activeUnitSymbol: string;
  activeUnitId: string | undefined;
  /** A non-tracking unit is selected, so quantities need conversion. */
  isConvertedUnit: boolean;
  pantryItemId: string | undefined;
  /** Resolved from the ranked-units API, along with the two below. */
  defaultUnit: SelectedUnitInfo | null;
  defaultIncrement: number | null;
  commonFractions: number[] | null;
  /** Null when the unit is the same or the conversion failed. */
  availableInSelectedUnit: number | null;
  availableLoading: boolean;
  /** Dual-tracked items only. */
  remainingNetWeight: number | null;
  netWeightUnitSymbol: string | undefined;
  netWeightUnitId: string | undefined;
  isDualTracked: boolean;
}

interface PantryActionModalProps {
  visible: boolean;
  pantryItemId: string | null;
  onClose: () => void;
  title: string;
  confirmLabel: string;
  confirmColor?: React.ComponentProps<typeof BottomSheetHeader>['confirmColor'];
  snapPoints?: (string | number)[];
  unitToggleLabel?: string;
  currentQuantityLabel?: string;
  /** Selects which unit-eligibility query runs. */
  operation: PantryOperation;
  onConfirm: (shared: PantryActionSharedState) => void;
  /** Fires when the modal opens; reset consumer-specific state here. */
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
 * Shared shell for the pantry action modals (Consume, RecordWaste, Restock);
 * action-specific fields arrive through `renderActionFields`. The item is read
 * live, so a cache update reaches the open modal without re-snapshotting state.
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

  const { pantryItem, loading: itemQueryLoading } =
    usePantryActionItem(pantryItemId);

  const [selectedUnitInfo, setSelectedUnitInfo] =
    useState<SelectedUnitInfo | null>(null);
  const [notes, setNotes] = useState('');

  // A row created offline holds a neutral unit with an empty id. Sent as
  // `usageUnitId` it names no unit; omitted, the server uses the stack's own.
  const placeholderOrUnitId = pantryItem?.unit.id;
  const trackingUnitId =
    placeholderOrUnitId === '' ? undefined : placeholderOrUnitId;

  const {
    groups,
    allUnits,
    defaultUnit,
    defaultIncrement,
    defaultCommonFractions,
    loading: unitsLoading,
  } = useOperationUnits({
    pantryItemId: pantryItem?.id,
    trackingUnitId,
    trackingUnitType: pantryItem?.unit.type,
    netWeightUnitId: pantryItem?.netWeightUnit?.id,
    operation,
  });

  // Matches the API's lazy init: quantity × netWeight.
  const effectiveNetWeight =
    pantryItem?.remainingNetWeight ??
    (pantryItem?.netWeight != null
      ? pantryItem.quantity * pantryItem.netWeight
      : null);
  const isDualTracked =
    effectiveNetWeight != null && pantryItem?.netWeightUnit != null;
  // Same unit both sides makes the tracking count redundant ("1 g (100 g
  // remaining)") — collapse to the net weight alone.
  const isSingleUnitDualTracked =
    isDualTracked && pantryItem.unit.id === pantryItem.netWeightUnit?.id;
  const contentBreakdown = isDualTracked ? pantryItem.packageBreakdown : null;
  const perUnitNetWeight = contentBreakdown?.perUnitNetWeight ?? null;
  const hasContentUnit = perUnitNetWeight != null && perUnitNetWeight > 0;
  const contentUnitCount =
    pantryItem?.quantityBreakdown?.totalContentUnits != null
      ? Math.floor(pantryItem.quantityBreakdown.totalContentUnits)
      : hasContentUnit && pantryItem?.remainingNetWeight != null
      ? Math.floor(pantryItem.remainingNetWeight / perUnitNetWeight)
      : 0;

  const trackingQuantity = pantryItem?.quantity ?? 0;
  const trackingUnitSymbol = pantryItem?.unit.symbol ?? '';

  const fallbackUnitSymbol = pantryItem?.netWeightUnit
    ? getUnitDisplayText(pantryItem.netWeightUnit)
    : trackingUnitSymbol;
  const fallbackUnitId = pantryItem?.netWeightUnit?.id ?? trackingUnitId;
  const activeUnitSymbol = selectedUnitInfo?.unitSymbol ?? fallbackUnitSymbol;
  const activeUnitId = selectedUnitInfo?.unitId ?? fallbackUnitId;
  const isConvertedUnit =
    selectedUnitInfo != null && !selectedUnitInfo.isTrackingUnit;

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

  // Also picks up the default unit once it loads, if nothing is selected yet.
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

  const displayAsFractionOf = (unitId: string | undefined) =>
    unitId === trackingUnitId
      ? pantryItem?.unit.displayAsFraction ?? null
      : allUnits.find(u => u.unitId === unitId)?.displayAsFraction ?? null;

  const shared: PantryActionSharedState = {
    selectedUnitInfo,
    setSelectedUnitInfo,
    notes,
    setNotes,
    trackingQuantity,
    trackingUnitSymbol,
    trackingUnitId,
    displayAsFractionOf,
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
      <BottomSheetFormScrollView
        style={commonStyles.bottomSheetScrollView}
        contentContainerStyle={[
          commonStyles.bottomSheetContent,
          contentContainerStyle,
        ]}
        showsVerticalScrollIndicator={false}
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
              <Text role="heading" style={commonStyles.bottomSheetItemName}>
                {pantryItem.itemName}
              </Text>
              <View style={commonStyles.bottomSheetItemRow}>
                <Text role="body" tone="secondary">
                  {resolvedCurrentQuantityLabel}{' '}
                </Text>
                <FormattedItemSubtitle
                  quantity={
                    isSingleUnitDualTracked
                      ? effectiveNetWeight
                      : pantryItem.displayAmount.quantity
                  }
                  displayAsFraction={
                    isSingleUnitDualTracked ||
                    pantryItem.displayAmount.unit.id !== pantryItem.unit.id
                      ? undefined
                      : pantryItem.unit.displayAsFraction
                  }
                  unitSymbol={
                    isSingleUnitDualTracked
                      ? pantryItem.netWeightUnit?.symbol
                      : pantryItem.displayAmount.unit.symbol
                  }
                />
                {!!isDualTracked && !isSingleUnitDualTracked && (
                  <Text role="body" tone="secondary">
                    {' '}
                    {t('pantryAction.remainingAmount', {
                      amount: pantryItem.quantityBreakdown
                        ? t('pantryAction.quantityBreakdown', {
                            packages: pantryItem.quantityBreakdown.fullPackages,
                            loose: Math.floor(
                              pantryItem.quantityBreakdown.looseContentUnits,
                            ),
                            unit:
                              pantryItem.quantityBreakdown.contentUnit
                                ?.symbol ?? '',
                          })
                        : contentBreakdown && hasContentUnit
                        ? t('pantryAction.amountWithUnit', {
                            amount: contentUnitCount,
                            unit:
                              contentBreakdown.contentUnit.symbol ||
                              contentBreakdown.contentUnit.name,
                          })
                        : t('pantryAction.amountWithUnit', {
                            amount: formatQuantityForDisplay(
                              effectiveNetWeight,
                              { notation: 'decimal' },
                            ),
                            unit: pantryItem.netWeightUnit?.symbol ?? '',
                          }),
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
      </BottomSheetFormScrollView>
    </BottomSheetModal>
  );
};
