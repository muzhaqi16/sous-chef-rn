import React, { useRef, useState } from 'react';
import { errorService } from '#services/errorService';
import { alertService } from '#services/alertService';
import { View } from 'react-native';
import { useTranslation } from '#i18n';
import { Sheet } from '#components/templates/Sheet';
import { SheetHeader } from '#components/templates/SheetHeader';
import { SheetHeaderSlot } from '#components/templates/SheetHeaderSlot';
import { pantryTestIDs } from '#features/pantry/testIDs';
import { UnitPicker } from '#features/pantry/components/UnitPicker';
import {
  useOperationUnits,
  type SelectedUnitInfo,
  type PantryOperation,
} from '#features/pantry/hooks/useOperationUnits';
import { useConvertAvailableQuantity } from '#features/pantry/hooks/useConvertAvailableQuantity';
import { useOpening } from '#hooks/ui/useOpening';
import { commonStyles } from '#styles/commonStyles';
import { Text } from '#components/atoms/Text';
import type { UnitLabelSource } from '#utils/formatQuantity';
import { ThemedActivityIndicator } from '#components/atoms/themedComponents';
import { DataStateView } from '#components/organisms/DataStateView';
import type { PantryActionModal_PantryItemFragment } from './PantryActionModal.generated';
import { usePantryActionItem } from '#features/pantry/components/modals/usePantryActionItem';
import {
  amountLeftOf,
  fullPackagesAfter,
  shownStock,
} from '#features/pantry/utils/stockDisplay';
import { formatAmountLeft } from '#features/pantry/hooks/usePantryItemTransformation';
import { useReadingSystem } from '#hooks/settings/useReadingSystem';
import type {
  PantryActionSharedState,
  ShownQuantity,
} from '#features/pantry/types';

interface PantryActionModalProps {
  visible: boolean;
  /** Read as the sheet opens; the caller may clear it as the sheet closes. */
  pantryItemId: string | null;
  onClose: () => void;
  snapPoints?: (string | number)[];
  unitToggleLabel?: string;
  currentQuantityLabel?: string;
  /** Selects which unit-eligibility query runs. */
  operation: PantryOperation;
  /**
   * The action's form: its bar (`PantryActionHeader`) and its fields, mounted
   * fresh for each opening. `pantryItem` is null until the stack is read.
   */
  renderForm: (
    shared: PantryActionSharedState,
    pantryItem: PantryActionModal_PantryItemFragment | null,
  ) => React.ReactNode;
}

/**
 * The sheet the pantry actions (consume, waste, restock) open in. Each opening
 * mounts the stack's frame and the action's form afresh.
 */
export const PantryActionModal: React.FC<PantryActionModalProps> = ({
  visible,
  pantryItemId,
  onClose,
  snapPoints = ['75%', '95%'],
  ...frame
}) => {
  const presented = visible && !!pantryItemId;
  const opening = useOpening(presented, pantryItemId);

  return (
    <Sheet
      mode="form"
      headerFromContent
      visible={presented}
      onDismiss={onClose}
      snapPoints={snapPoints}
      style={commonStyles.bottomSheetScrollView}
      contentContainerStyle={commonStyles.bottomSheetContent}
    >
      {opening?.payload ? (
        <PantryActionFrame
          key={opening.id}
          pantryItemId={opening.payload}
          {...frame}
        />
      ) : null}
    </Sheet>
  );
};

type PantryActionFrameProps = Omit<
  PantryActionModalProps,
  'visible' | 'pantryItemId' | 'onClose' | 'snapPoints'
> & { pantryItemId: string };

/**
 * One opening: the stack, read live so a cache update reaches the open sheet,
 * and the unit the action is measured in, around the action's form.
 */
const PantryActionFrame: React.FC<PantryActionFrameProps> = ({
  pantryItemId,
  unitToggleLabel,
  currentQuantityLabel,
  operation,
  renderForm,
}) => {
  const { t } = useTranslation();
  const readingSystem = useReadingSystem();
  const resolvedUnitToggleLabel =
    unitToggleLabel ?? t('pantryAction.useByDefault');
  const resolvedCurrentQuantityLabel =
    currentQuantityLabel ?? t('pantryAction.availableDefault');
  const {
    pantryItem,
    loading: itemQueryLoading,
    state: itemState,
    retry: retryItem,
  } = usePantryActionItem(pantryItemId);

  const [selectedUnitInfo, setSelectedUnitInfo] =
    useState<SelectedUnitInfo | null>(null);

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
    consumeUnitId: pantryItem?.consumeUnit?.id,
    operation,
  });

  // The ranked default once it is read, kept until another unit is picked: a
  // later ranking never moves an amount already typed to another unit.
  if (selectedUnitInfo === null && defaultUnit !== null) {
    setSelectedUnitInfo(defaultUnit);
  }

  // Matches the API's lazy init: quantity × netWeight.
  const effectiveNetWeight =
    pantryItem?.remainingNetWeight ??
    (pantryItem?.netWeight != null
      ? pantryItem.quantity * pantryItem.netWeight
      : null);
  const isDualTracked =
    effectiveNetWeight != null && pantryItem?.netWeightUnit != null;

  const trackingQuantity = pantryItem?.quantity ?? 0;
  const trackingUnit: UnitLabelSource = pantryItem?.unit ?? {};

  const fallbackUnit = pantryItem?.netWeightUnit ?? trackingUnit;
  const fallbackUnitId = pantryItem?.netWeightUnit?.id ?? trackingUnitId;
  const activeUnit = selectedUnitInfo?.unit ?? fallbackUnit;
  const activeUnitId = selectedUnitInfo?.unitId ?? fallbackUnitId;
  const isConvertedUnit =
    selectedUnitInfo != null && !selectedUnitInfo.isTrackingUnit;

  // The selected unit's ranked metadata: increment, fractions, dozen factor
  const selectedRankedUnit = allUnits.find(
    u => u.unitId === selectedUnitInfo?.unitId,
  );
  const countFactor = selectedRankedUnit?.countFactor ?? null;
  const exactFactor = isDualTracked
    ? null
    : activeUnitId !== undefined && activeUnitId === trackingUnitId
    ? 1
    : countFactor;

  // What is left once `drawn` packages go, as the row will read it; a restock
  // draws a negative amount. The stack's figures move by its own per-package
  // ones, so nothing converts.
  const leftAfter = (drawn: number): ShownQuantity => {
    if (!pantryItem) {
      return {
        quantity: trackingQuantity - drawn,
        unit: trackingUnit,
        displayAsFraction: null,
      };
    }
    const {
      unit,
      heldQuantity,
      portionUnit,
      portionsPerTrackingUnit,
      remainingPortions,
      netWeight,
      remainingNetWeight,
      netWeightUnit,
    } = pantryItem;
    const held = heldQuantity - drawn;
    const left = amountLeftOf({
      held,
      fullPackages: fullPackagesAfter(
        pantryItem.stockBreakdown.fullPackages,
        heldQuantity,
        held,
      ),
      shown: shownStock(held, unit, pantryItem.displayUnit),
      trackingType: unit.type,
      commonFractions: unit.commonFractions,
      portions:
        portionUnit && remainingPortions != null && portionsPerTrackingUnit
          ? {
              left: remainingPortions - drawn * portionsPerTrackingUnit,
              unit: portionUnit,
            }
          : null,
      netWeight:
        netWeightUnit && remainingNetWeight != null && netWeight
          ? {
              left: remainingNetWeight - drawn * netWeight,
              unit: netWeightUnit,
            }
          : null,
    });
    return {
      quantity: left.quantity,
      unit: left.unit,
      // A dozen reads in fractions; the stack's own unit in its own notation.
      displayAsFraction: left.unit === unit ? unit.displayAsFraction : null,
    };
  };

  const packagesOfNetWeight = (amount: number) =>
    pantryItem?.netWeight ? amount / pantryItem.netWeight : null;

  const { availableInSelectedUnit, availableLoading, conversionUnavailable } =
    useConvertAvailableQuantity({
      pantryItemId: pantryItem?.id,
      selectedUnitId: activeUnitId,
      trackingUnitId,
      availableInTrackingUnit: trackingQuantity,
      conversionRatio:
        countFactor !== null
          ? 1 / countFactor
          : selectedUnitInfo?.conversionRatio ?? null,
      remainingNetWeight: effectiveNetWeight,
      netWeightUnitId: pantryItem?.netWeightUnit?.id,
    });

  const displayAsFractionOf = (unitId: string | undefined) =>
    unitId === trackingUnitId
      ? pantryItem?.unit.displayAsFraction ?? null
      : allUnits.find(u => u.unitId === unitId)?.displayAsFraction ?? null;

  const shared: PantryActionSharedState = {
    selectedUnitInfo,
    setSelectedUnitInfo,
    trackingQuantity,
    trackingUnit,
    trackingUnitId,
    displayAsFractionOf,
    activeUnit,
    activeUnitId,
    isConvertedUnit,
    exactFactor,
    leftAfter,
    packagesOfNetWeight,
    pantryItemId: pantryItem?.id,
    defaultUnit,
    defaultIncrement: selectedRankedUnit?.defaultIncrement ?? defaultIncrement,
    defaultUnitIncrement: defaultIncrement,
    commonFractions:
      selectedRankedUnit?.commonFractions ?? defaultCommonFractions,
    availableInSelectedUnit,
    availableLoading,
    conversionUnavailable,
    remainingNetWeight: effectiveNetWeight,
    netWeightUnit: pantryItem?.netWeightUnit ?? undefined,
    netWeightUnitId: pantryItem?.netWeightUnit?.id,
    isDualTracked,
    portionUnitId: pantryItem?.portionUnitId ?? null,
  };

  return (
    <>
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
              <Text role="bodyStrong">
                {formatAmountLeft(pantryItem, readingSystem)}
              </Text>
            </View>
          </View>

          {/* Unit Picker */}
          <UnitPicker
            label={resolvedUnitToggleLabel}
            ranked={allUnits}
            groups={groups}
            selectedUnitId={selectedUnitInfo?.unitId}
            onSelect={setSelectedUnitInfo}
            loading={unitsLoading}
          />
        </>
      )}

      {renderForm(shared, pantryItem)}

      {!pantryItem && itemQueryLoading ? (
        <View style={commonStyles.bottomSheetLoading}>
          <ThemedActivityIndicator />
        </View>
      ) : null}

      {itemState === 'error' || itemState === 'offline' ? (
        <DataStateView state={itemState} onRetry={retryItem} />
      ) : null}
    </>
  );
};

interface PantryActionHeaderProps {
  title: string;
  /** Names the confirm for a screen reader: the action it takes. */
  confirmLabel: string;
  onClose: () => void;
  /**
   * Null while there is no stack to act on. Resolves once the action settles;
   * a throw is a failure no field can hold, said in an alert.
   */
  onConfirm: (() => Promise<unknown>) | null;
}

/** An action form's bar: close, its title, and a confirm that saves once at a time. */
export const PantryActionHeader: React.FC<PantryActionHeaderProps> = ({
  title,
  confirmLabel,
  onClose,
  onConfirm,
}) => {
  const { t } = useTranslation();
  const submitting = useRef(false);
  const [saving, setSaving] = useState(false);

  const confirm = async (send: () => Promise<unknown>) => {
    if (submitting.current) return;
    submitting.current = true;
    setSaving(true);
    try {
      await send();
    } catch (error) {
      errorService.reportError(error, {
        operation: 'Confirm pantry action',
      });
      alertService.alert(t('labels.error'), t('errors.codes.genericRetry'));
    }
    submitting.current = false;
    setSaving(false);
  };

  return (
    <SheetHeaderSlot>
      <SheetHeader
        title={title}
        onClose={onClose}
        confirm={
          onConfirm
            ? {
                onPress: () => {
                  void confirm(onConfirm);
                },
                accessibilityLabel: confirmLabel,
                loading: saving,
                testID: pantryTestIDs.actionConfirm,
              }
            : undefined
        }
      />
    </SheetHeaderSlot>
  );
};
