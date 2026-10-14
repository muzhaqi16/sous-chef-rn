import React, { useState } from 'react';
import { View } from 'react-native';
import { useTranslation, type TranslationKey } from '#/i18n';
import { StyleSheet } from 'react-native-unistyles';
import { FractionInput } from '#components/molecules/FractionInput';
import { FormInput } from '#components/atoms/FormInput';
import { DatePickerField } from '#components/molecules/DatePickerField';
import { ConversionPreview } from '#features/pantry/components/ConversionPreview';
import { FractionQuickSelect } from '#features/pantry/components/FractionQuickSelect';
import { parseFractionalInput } from '#/utils/fractionUtils';
import {
  formatQuantityForDisplay,
  formatQuantityForInput,
} from '#/utils/formatQuantity';
import { useConversionPreview } from '#features/pantry/hooks/useConversionPreview';
import { actionConversionOptions } from '#features/pantry/hooks/useQuantityFeedback';
import { inCountedUnit } from '#domain/stockDisplay';
import { commonStyles } from '#/styles/commonStyles';
import { PantryOperation } from '#features/pantry/hooks/useOperationUnits';
import {
  PantryActionModal,
  type PantryActionSharedState,
  type ShownQuantity,
} from '#features/pantry/components/modals/PantryActionModal';
import { Text } from '#components/atoms/Text';
import { localizeNumericHint } from '#/utils/formatters/number';
import { parseMoneyInput } from '#/utils/validation/common';

interface RestockPantryItemModalProps {
  visible: boolean;
  pantryItemId: string | null;
  onClose: () => void;
  onConfirm: (
    quantity: number,
    quantityInput: string,
    notes: string,
    unitId?: string,
    costPerUnit?: number,
    totalCost?: number,
    expiresAt?: Date | null,
  ) => void;
}

export const RestockPantryItemModal: React.FC<RestockPantryItemModalProps> = ({
  visible,
  pantryItemId,
  onClose,
  onConfirm,
}) => {
  const { t } = useTranslation();
  const [quantityInput, setQuantityInput] = useState('1');
  const [costPerUnitInput, setCostPerUnitInput] = useState('');
  const [totalCostInput, setTotalCostInput] = useState('');
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);
  const [confirmRefused, setConfirmRefused] = useState(false);

  const handleReset = () => {
    setQuantityInput('1');
    setCostPerUnitInput('');
    setTotalCostInput('');
    setExpiresAt(null);
    setConfirmRefused(false);
  };

  const quantityValue = parseFractionalInput(quantityInput);
  const quantityIsUsable =
    quantityValue !== null && !isNaN(quantityValue) && quantityValue > 0;
  const costPerUnit = parseMoneyInput(costPerUnitInput);
  const totalCost = parseMoneyInput(totalCostInput);
  // On the fields once a confirm is refused, then live; until then the
  // quantity field's own format hint speaks.
  const errorOn = (refused: boolean, key: TranslationKey) =>
    confirmRefused && refused ? t(key) : undefined;
  const errors = {
    quantity: errorOn(!quantityIsUsable, 'errors.invalidQuantity'),
    costPerUnit: errorOn(costPerUnit === undefined, 'errors.invalidAmountPaid'),
    totalCost: errorOn(totalCost === undefined, 'errors.invalidAmountPaid'),
  };

  const handleConfirm = (shared: PantryActionSharedState) => {
    if (!pantryItemId) return;
    if (
      !quantityIsUsable ||
      costPerUnit === undefined ||
      totalCost === undefined
    ) {
      setConfirmRefused(true);
      return;
    }

    // Pass the quantity and unit directly — the backend handles conversion
    onConfirm(
      quantityValue,
      quantityInput,
      shared.notes,
      shared.activeUnitId,
      costPerUnit ?? undefined,
      totalCost ?? undefined,
      expiresAt,
    );
    onClose();
  };

  return (
    <PantryActionModal
      visible={visible}
      pantryItemId={pantryItemId}
      onClose={onClose}
      title={t('restockItem.title')}
      confirmLabel={t('restockItem.restock')}
      snapPoints={['80%', '95%']}
      unitToggleLabel={t('restockItem.restockBy')}
      currentQuantityLabel={t('restockItem.currentLabel')}
      operation={PantryOperation.Restock}
      onConfirm={handleConfirm}
      onReset={handleReset}
      renderActionFields={shared => (
        <RestockActionFields
          quantityInput={quantityInput}
          setQuantityInput={setQuantityInput}
          costPerUnitInput={costPerUnitInput}
          setCostPerUnitInput={setCostPerUnitInput}
          totalCostInput={totalCostInput}
          setTotalCostInput={setTotalCostInput}
          expiresAt={expiresAt}
          setExpiresAt={setExpiresAt}
          errors={errors}
          shared={shared}
        />
      )}
    />
  );
};

const RestockActionFields: React.FC<{
  quantityInput: string;
  setQuantityInput: (v: string) => void;
  costPerUnitInput: string;
  setCostPerUnitInput: (v: string) => void;
  totalCostInput: string;
  setTotalCostInput: (v: string) => void;
  expiresAt: Date | null;
  setExpiresAt: (v: Date | null) => void;
  errors: Record<'quantity' | 'costPerUnit' | 'totalCost', string | undefined>;
  shared: PantryActionSharedState;
}> = ({
  quantityInput,
  setQuantityInput,
  costPerUnitInput,
  setCostPerUnitInput,
  totalCostInput,
  setTotalCostInput,
  expiresAt,
  setExpiresAt,
  errors,
  shared,
}) => {
  const { t } = useTranslation();
  const addAmount = parseFractionalInput(quantityInput);

  // For dual-tracked items, show conversion to net weight unit (e.g. cups → grams)
  const conversion = useConversionPreview(
    actionConversionOptions(addAmount, shared),
  );

  // For dual-tracked items, show new total in net weight
  const currentInUnit =
    shared.isDualTracked && shared.isConvertedUnit
      ? shared.remainingNetWeight
      : shared.isConvertedUnit
      ? shared.availableInSelectedUnit
      : shared.trackingQuantity;

  const newQuantitySymbol =
    shared.isDualTracked &&
    shared.isConvertedUnit &&
    shared.netWeightUnitSymbol !== undefined
      ? shared.netWeightUnitSymbol
      : shared.activeUnitSymbol;

  let newQuantity: ShownQuantity | null = null;
  if (addAmount !== null && !isNaN(addAmount)) {
    if (shared.exactFactor !== null) {
      // The tracking unit or a dozen of it: the total reads as the stack will.
      newQuantity = shared.showStock(
        shared.trackingQuantity + inCountedUnit(addAmount, shared.exactFactor),
      );
    } else if (
      currentInUnit != null &&
      (shared.isDualTracked ? conversion.convertedValue != null : true)
    ) {
      newQuantity = {
        quantity:
          currentInUnit +
          (shared.isDualTracked && conversion.convertedValue != null
            ? conversion.convertedValue
            : addAmount),
        unitSymbol: newQuantitySymbol,
        displayAsFraction: null,
      };
    }
  }

  return (
    <>
      {/* Quantity Input */}
      <View style={commonStyles.bottomSheetSection}>
        <FractionInput
          label={t('restockItem.quantityToAdd')}
          value={quantityInput}
          onChangeText={setQuantityInput}
          placeholder={localizeNumericHint(t('labels.eG1114Or15'))}
          useBottomSheetInput
          required
          error={errors.quantity}
        />
        {newQuantity !== null || shared.isConvertedUnit ? (
          <View style={commonStyles.bottomSheetInfoRow}>
            {newQuantity !== null ? (
              <Text role="label" tone="accent" style={styles.newQuantityText}>
                {t('restockItem.newQuantityPrefix')}
                {formatQuantityForDisplay(newQuantity.quantity)}{' '}
                {newQuantity.unitSymbol}
              </Text>
            ) : null}
            {shared.isConvertedUnit ? (
              <ConversionPreview
                previewText={conversion.previewText}
                loading={conversion.previewLoading}
                confidence={conversion.confidence}
              />
            ) : null}
          </View>
        ) : null}
        {shared.commonFractions != null && shared.commonFractions.length > 0 ? (
          <FractionQuickSelect
            fractions={shared.commonFractions}
            onSelect={value => setQuantityInput(formatQuantityForInput(value))}
            selectedValue={addAmount ?? undefined}
            unitSymbol={shared.activeUnitSymbol}
            displayAsFraction
          />
        ) : null}
      </View>

      {/* Cost Tracking */}
      <View style={commonStyles.bottomSheetSection}>
        <View style={styles.costRow}>
          <View style={styles.costField}>
            <FormInput
              label={t('restockItem.costPerUnit')}
              value={costPerUnitInput}
              onChangeText={setCostPerUnitInput}
              placeholder={localizeNumericHint('0.00')}
              keyboardType="decimal-pad"
              useBottomSheetInput
              error={errors.costPerUnit}
            />
          </View>
          <View style={styles.costField}>
            <FormInput
              label={t('labels.totalPaid')}
              value={totalCostInput}
              onChangeText={setTotalCostInput}
              placeholder={localizeNumericHint('0.00')}
              keyboardType="decimal-pad"
              useBottomSheetInput
              error={errors.totalCost}
            />
          </View>
        </View>
      </View>

      {/* Notes */}
      <View style={commonStyles.bottomSheetSection}>
        <FormInput
          label={t('restockItem.notes')}
          value={shared.notes}
          onChangeText={shared.setNotes}
          placeholder={t('restockItem.notesPlaceholder')}
          multiline
          numberOfLines={3}
          useBottomSheetInput
        />
      </View>

      {/* Expiration Date */}
      <View style={commonStyles.bottomSheetSection}>
        <DatePickerField
          label={t('labels.expirationDate')}
          value={expiresAt}
          onChange={setExpiresAt}
          placeholder={t('restockItem.expirationPlaceholder')}
          minimumDate={new Date()}
        />
      </View>
    </>
  );
};

const styles = StyleSheet.create(theme => ({
  costRow: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  costField: {
    flex: 1,
  },
  // The row already spaces its children; a top margin here doubles the gap.
  newQuantityText: {
    marginTop: 0,
  },
}));
