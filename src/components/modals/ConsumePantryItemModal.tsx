import React, { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { FractionInput } from '#components/molecules/FractionInput';
import { FormInput } from '#components/molecules/FormInput';
import { CollapsibleChipPicker } from '#components/molecules/CollapsibleChipPicker';
import { QuantityInputFeedback } from '#components/molecules/QuantityInputFeedback';
import { parseFractionalInput } from '#/utils/fractionUtils';
import { validateDeductionQuantity } from '#/utils/validateDeductionQuantity';
import { useQuantityFeedback } from '#features/pantry/hooks/useQuantityFeedback';
import { UsagePurpose } from '#/graphql/generated/schemaTypes';
import { type PantryItemFragment } from '#features/pantry/graphql/pantryFragments.generated';
import { commonStyles } from '#/styles/commonStyles';
import {
  PantryOperation,
  type SelectedUnitInfo,
} from '#features/pantry/hooks/useOperationUnits';
import {
  PantryActionModal,
  type PantryActionSharedState,
} from './PantryActionModal';
import { Text } from '#components/atoms/Text';

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
  ) => void;
}

const PURPOSE_OPTIONS: Array<{ labelKey: string; value: UsagePurpose }> = [
  { labelKey: 'consumeItem.purposeCooking', value: UsagePurpose.Cooking },
  { labelKey: 'consumeItem.purposeMealPrep', value: UsagePurpose.MealPrep },
  { labelKey: 'consumeItem.purposeSnack', value: UsagePurpose.Snack },
  { labelKey: 'consumeItem.purposeGeneral', value: UsagePurpose.General },
  { labelKey: 'consumeItem.purposeGift', value: UsagePurpose.Gift },
  { labelKey: 'consumeItem.purposeTransfer', value: UsagePurpose.Transfer },
];

export const ConsumePantryItemModal: React.FC<ConsumePantryItemModalProps> = ({
  visible,
  pantryItem,
  onClose,
  onConfirm,
}) => {
  const { t } = useTranslation();
  const [quantityInput, setQuantityInput] = useState('1');
  const [purpose, setPurpose] = useState<UsagePurpose>(UsagePurpose.General);

  const handleReset = (
    _item: PantryItemFragment,
    _defaultUnit: SelectedUnitInfo | null,
    increment: number | null,
  ) => {
    setQuantityInput(increment ? increment.toString() : '1');
    setPurpose(UsagePurpose.General);
  };

  const handleConfirm = (shared: PantryActionSharedState) => {
    if (!pantryItem) return;

    const quantityValue = validateDeductionQuantity(
      quantityInput,
      shared,
      'consume',
    );
    if (quantityValue === null) return;

    onConfirm(
      quantityValue,
      quantityInput,
      purpose,
      shared.notes,
      shared.activeUnitId,
    );
    onClose();
  };

  const showFifoHint = (pantryItem?.activeBatchCount ?? 0) > 1;

  const purposeOptions = PURPOSE_OPTIONS.map(({ labelKey, value }) => ({
    label: t(labelKey),
    value,
  }));

  return (
    <PantryActionModal
      visible={visible}
      pantryItem={pantryItem}
      onClose={onClose}
      title={t('consumeItem.title')}
      confirmLabel={t('consumeItem.confirm')}
      snapPoints={['75%', '95%']}
      unitToggleLabel={t('consumeItem.consumeBy')}
      operation={PantryOperation.Consume}
      onConfirm={handleConfirm}
      onReset={handleReset}
      renderActionFields={shared => (
        <ConsumeActionFields
          quantityInput={quantityInput}
          setQuantityInput={setQuantityInput}
          purpose={purpose}
          setPurpose={setPurpose}
          shared={shared}
          showFifoHint={showFifoHint}
          purposeOptions={purposeOptions}
        />
      )}
    />
  );
};

/** Extracted to keep the render prop body simple */
const ConsumeActionFields: React.FC<{
  quantityInput: string;
  setQuantityInput: (v: string) => void;
  purpose: UsagePurpose;
  setPurpose: (v: UsagePurpose) => void;
  shared: PantryActionSharedState;
  showFifoHint?: boolean;
  purposeOptions: Array<{ label: string; value: UsagePurpose }>;
}> = ({
  quantityInput,
  setQuantityInput,
  purpose,
  setPurpose,
  shared,
  showFifoHint,
  purposeOptions,
}) => {
  const { t } = useTranslation();
  const consumeAmount = parseFractionalInput(quantityInput);
  const { conversion, remaining, availableInUnit, remainingUnitSymbol } =
    useQuantityFeedback(consumeAmount, shared);

  return (
    <>
      {/* Quantity Input */}
      <View style={commonStyles.bottomSheetSection}>
        <FractionInput
          label={t('consumeItem.quantityToConsume')}
          required
          value={quantityInput}
          onChangeText={setQuantityInput}
          placeholder={t('consumeItem.quantityPlaceholder')}
          keyboardType="numeric"
          useBottomSheetInput
        />
        <QuantityInputFeedback
          remaining={remaining}
          availableInUnit={availableInUnit}
          activeUnitSymbol={remainingUnitSymbol}
          consumeUnitSymbol={shared.activeUnitSymbol}
          isConvertedUnit={shared.isConvertedUnit}
          previewText={conversion.previewText}
          previewLoading={conversion.previewLoading}
          conversionConfidence={
            shared.selectedUnitInfo?.conversionConfidence ?? null
          }
          commonFractions={shared.commonFractions}
          onFractionSelect={value => setQuantityInput(value.toString())}
          selectedFractionValue={consumeAmount ?? undefined}
        />
        {showFifoHint ? (
          <Text style={commonStyles.bottomSheetHelperText}>
            {t('consumeItem.fifoHint')}
          </Text>
        ) : null}
      </View>

      {/* Purpose Selection */}
      <CollapsibleChipPicker
        label={t('consumeItem.purpose')}
        options={purposeOptions}
        selectedValue={purpose}
        onSelect={setPurpose}
      />

      {/* Notes */}
      <View style={commonStyles.bottomSheetSection}>
        <FormInput
          label={t('consumeItem.notes')}
          value={shared.notes}
          onChangeText={shared.setNotes}
          placeholder={t('consumeItem.notesPlaceholder')}
          multiline
          numberOfLines={3}
          useBottomSheetInput
        />
      </View>
    </>
  );
};
