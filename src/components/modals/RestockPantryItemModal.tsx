import React, { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from '#/i18n';
import { StyleSheet } from 'react-native-unistyles';
import { alertService } from '#/services/alertService';
import { FractionInput } from '#components/molecules/FractionInput';
import { FormInput } from '#components/molecules/FormInput';
import { DatePickerField } from '#components/molecules/DatePickerField';
import { ConversionPreview } from '#components/atoms/ConversionPreview';
import { FractionQuickSelect } from '#components/atoms/FractionQuickSelect';
import { parseFractionalInput } from '#/utils/fractionUtils';
import { formatQuantity } from '#/utils/formatQuantity';
import { useConversionPreview } from '#features/pantry/hooks/useConversionPreview';
import { commonStyles } from '#/styles/commonStyles';
import { PantryOperation } from '#features/pantry/hooks/useOperationUnits';
import {
  PantryActionModal,
  type PantryActionSharedState,
} from './PantryActionModal';
import { Text } from '#components/atoms/Text';
import { parseDecimalInput } from '#/utils/parseDecimalInput';
import {
  formatNumberForInput,
  localizeNumericHint,
} from '#/utils/formatters/number';

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

  const handleReset = () => {
    setQuantityInput('1');
    setCostPerUnitInput('');
    setTotalCostInput('');
    setExpiresAt(null);
  };

  const handleConfirm = (shared: PantryActionSharedState) => {
    if (!pantryItemId) return;

    const quantityValue = parseFractionalInput(quantityInput);
    if (quantityValue === null || isNaN(quantityValue) || quantityValue <= 0) {
      alertService.alert(
        t('labels.error'),
        t('adjustQuantity.invalidQuantity'),
      );
      return;
    }

    const costPerUnit = costPerUnitInput
      ? parseDecimalInput(costPerUnitInput)
      : undefined;
    const totalCost = totalCostInput
      ? parseDecimalInput(totalCostInput)
      : undefined;

    // Pass the quantity and unit directly — the backend handles conversion
    onConfirm(
      quantityValue,
      quantityInput,
      shared.notes,
      shared.activeUnitId,
      isNaN(costPerUnit!) ? undefined : costPerUnit,
      isNaN(totalCost!) ? undefined : totalCost,
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
  shared,
}) => {
  const { t } = useTranslation();
  const addAmount = parseFractionalInput(quantityInput);

  // For dual-tracked items, show conversion to net weight unit (e.g. cups → grams)
  const conversion = useConversionPreview({
    pantryItemId: shared.pantryItemId,
    inputQuantity: addAmount,
    selectedUnitId: shared.activeUnitId,
    selectedUnitSymbol: shared.activeUnitSymbol,
    trackingUnitId:
      shared.isDualTracked && shared.isConvertedUnit
        ? shared.netWeightUnitId!
        : shared.trackingUnitId,
    trackingUnitSymbol:
      shared.isDualTracked && shared.isConvertedUnit
        ? shared.netWeightUnitSymbol!
        : shared.trackingUnitSymbol,
    conversionRatio: shared.isDualTracked
      ? null
      : shared.selectedUnitInfo?.conversionRatio ?? null,
  });

  // For dual-tracked items, show new total in net weight
  const currentInUnit =
    shared.isDualTracked && shared.isConvertedUnit
      ? shared.remainingNetWeight
      : shared.isConvertedUnit
      ? shared.availableInSelectedUnit
      : shared.trackingQuantity;

  const newQuantitySymbol =
    shared.isDualTracked && shared.isConvertedUnit
      ? shared.netWeightUnitSymbol!
      : shared.activeUnitSymbol;

  const newQuantity =
    addAmount !== null &&
    !isNaN(addAmount) &&
    currentInUnit != null &&
    (shared.isDualTracked ? conversion.convertedValue != null : true)
      ? currentInUnit +
        (shared.isDualTracked && conversion.convertedValue != null
          ? conversion.convertedValue
          : addAmount)
      : null;

  return (
    <>
      {/* Quantity Input */}
      <View style={commonStyles.bottomSheetSection}>
        <FractionInput
          label={t('restockItem.quantityToAdd')}
          value={quantityInput}
          onChangeText={setQuantityInput}
          placeholder={localizeNumericHint(
            t('restockItem.quantityPlaceholder'),
          )}
          keyboardType="numeric"
          useBottomSheetInput
          required
        />
        {newQuantity !== null || shared.isConvertedUnit ? (
          <View style={commonStyles.bottomSheetInfoRow}>
            {newQuantity !== null ? (
              <Text
                size="sm"
                weight="medium"
                tone="accent"
                style={[styles.newQuantityText, { marginTop: 0 }]}
              >
                {t('restockItem.newQuantityPrefix')}
                {formatQuantity(newQuantity)} {newQuantitySymbol}
              </Text>
            ) : null}
            {shared.isConvertedUnit ? (
              <ConversionPreview
                previewText={conversion.previewText}
                loading={conversion.previewLoading}
                confidence={
                  shared.selectedUnitInfo?.conversionConfidence ?? null
                }
              />
            ) : null}
          </View>
        ) : null}
        {shared.commonFractions != null && shared.commonFractions.length > 0 ? (
          <FractionQuickSelect
            fractions={shared.commonFractions}
            onSelect={value => setQuantityInput(formatNumberForInput(value))}
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
            />
          </View>
          <View style={styles.costField}>
            <FormInput
              label={t('restockItem.totalCost')}
              value={totalCostInput}
              onChangeText={setTotalCostInput}
              placeholder={localizeNumericHint('0.00')}
              keyboardType="decimal-pad"
              useBottomSheetInput
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
          label={t('restockItem.expirationDate')}
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
  newQuantityText: {
    marginTop: theme.spacing.xs,
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));
