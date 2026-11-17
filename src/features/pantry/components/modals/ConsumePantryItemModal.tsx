import React, { useState } from 'react';
import { AppPressable } from '#components/atoms/AppPressable';
import { pantryTestIDs } from '#features/pantry/testIDs';
import { View } from 'react-native';
import { useTranslation, type TranslationKey } from '#/i18n';
import { FractionInput } from '#components/molecules/FractionInput';
import { FormInput } from '#components/atoms/FormInput';
import { CollapsibleChipPicker } from '#features/pantry/components/CollapsibleChipPicker';
import { QuantityInputFeedback } from '#features/pantry/components/QuantityInputFeedback';
import { parseFractionalInput } from '#/utils/fractionUtils';
import { validateDeductionQuantity } from '#features/pantry/utils/validateDeductionQuantity';
import { useQuantityFeedback } from '#features/pantry/hooks/useQuantityFeedback';
import { UsagePurpose } from '#/graphql/generated/schemaTypes';
import { commonStyles } from '#/styles/commonStyles';
import {
  PantryOperation,
  type SelectedUnitInfo,
} from '#features/pantry/hooks/useOperationUnits';
import { PantryActionModal } from '#features/pantry/components/modals/PantryActionModal';
import type { PantryActionModal_PantryItemFragment } from './PantryActionModal.generated';
import { Text } from '#components/atoms/Text';
import { localizeNumericHint } from '#/utils/formatters/number';
import { unitLabel } from '#/utils/formatQuantity';
import { formatQuantityForInput } from '#/utils/formatQuantity';
import type { PantryActionSharedState } from '#features/pantry/types';

interface ConsumePantryItemModalProps {
  compact?: boolean;
  visible: boolean;
  pantryItemId: string | null;
  onClose: () => void;
  onConfirm: (
    quantityUsed: number,
    quantityInput: string,
    purpose: UsagePurpose,
    notes: string,
    usageUnitId?: string,
  ) => Promise<unknown>;
}

const PURPOSE_OPTIONS: Array<{
  labelKey: TranslationKey;
  value: UsagePurpose;
}> = [
  { labelKey: 'consumeItem.purposeCooking', value: UsagePurpose.Cooking },
  { labelKey: 'labels.mealPrep', value: UsagePurpose.MealPrep },
  { labelKey: 'usagePurpose.SNACK', value: UsagePurpose.Snack },
  { labelKey: 'labels.general', value: UsagePurpose.General },
  { labelKey: 'usagePurpose.GIFT', value: UsagePurpose.Gift },
  { labelKey: 'consumeItem.purposeTransfer', value: UsagePurpose.Transfer },
];

export const ConsumePantryItemModal: React.FC<ConsumePantryItemModalProps> = ({
  visible,
  compact = false,
  pantryItemId,
  onClose,
  onConfirm,
}) => {
  const { t } = useTranslation();
  const [fieldError, setFieldError] = useState<string>();
  const [quantityInput, setQuantityInput] = useState('1');
  const [purpose, setPurpose] = useState<UsagePurpose>(UsagePurpose.General);

  const handleReset = (
    _item: PantryActionModal_PantryItemFragment,
    _defaultUnit: SelectedUnitInfo | null,
    increment: number | null,
  ) => {
    setQuantityInput(increment ? formatQuantityForInput(increment) : '1');
    setPurpose(UsagePurpose.General);
    setFieldError(undefined);
  };

  const handleConfirm = async (shared: PantryActionSharedState) => {
    if (!pantryItemId) return;

    const quantityValue = validateDeductionQuantity(
      quantityInput,
      shared,
      'consume',
      setFieldError,
    );
    if (quantityValue === null) return;

    await onConfirm(
      quantityValue,
      quantityInput,
      purpose,
      shared.notes,
      shared.activeUnitId,
    );
  };

  const purposeOptions = PURPOSE_OPTIONS.map(({ labelKey, value }) => ({
    label: t(labelKey),
    value,
  }));

  return (
    <PantryActionModal
      visible={visible}
      pantryItemId={pantryItemId}
      onClose={onClose}
      title={t('consumeItem.title')}
      confirmLabel={t('labels.confirm')}
      snapPoints={['75%', '95%']}
      unitToggleLabel={t('consumeItem.consumeBy')}
      operation={PantryOperation.Consume}
      onConfirm={handleConfirm}
      onReset={handleReset}
      renderActionFields={(shared, pantryItem) => (
        <ConsumeActionFields
          compact={compact}
          fieldError={fieldError}
          quantityInput={quantityInput}
          setQuantityInput={value => {
            setFieldError(undefined);
            setQuantityInput(value);
          }}
          purpose={purpose}
          setPurpose={setPurpose}
          shared={shared}
          showFifoHint={pantryItem.activeBatchCount > 1}
          purposeOptions={purposeOptions}
        />
      )}
    />
  );
};

/** Extracted to keep the render prop body simple */
const ConsumeActionFields: React.FC<{
  compact: boolean;
  fieldError?: string;
  quantityInput: string;
  setQuantityInput: (v: string) => void;
  purpose: UsagePurpose;
  setPurpose: (v: UsagePurpose) => void;
  shared: PantryActionSharedState;
  showFifoHint?: boolean;
  purposeOptions: Array<{ label: string; value: UsagePurpose }>;
}> = ({
  compact,
  fieldError,
  quantityInput,
  setQuantityInput,
  purpose,
  setPurpose,
  shared,
  showFifoHint,
  purposeOptions,
}) => {
  const { t } = useTranslation();
  const [details, setDetails] = useState(false);
  const useAll =
    shared.exactFactor != null
      ? shared.trackingQuantity / shared.exactFactor
      : shared.availableInSelectedUnit;
  const consumeAmount = parseFractionalInput(quantityInput);
  const { conversion, remaining, available } = useQuantityFeedback(
    consumeAmount,
    shared,
  );

  return (
    <>
      {/* Quantity Input */}
      <View style={commonStyles.bottomSheetSection}>
        <FractionInput
          label={`${t('consumeItem.quantityToConsume')} (${unitLabel(
            shared.activeUnit,
          )})`}
          error={fieldError}
          required
          value={quantityInput}
          onChangeText={setQuantityInput}
          placeholder={localizeNumericHint(t('labels.eG1114Or15'))}
          useBottomSheetInput
        />
        <QuantityInputFeedback
          remaining={remaining}
          available={available}
          consumeUnit={shared.activeUnit}
          isConvertedUnit={shared.isConvertedUnit}
          previewText={conversion.previewText}
          previewLoading={conversion.previewLoading}
          conversionConfidence={conversion.confidence}
          commonFractions={shared.commonFractions}
          onFractionSelect={value =>
            setQuantityInput(formatQuantityForInput(value))
          }
          selectedFractionValue={consumeAmount ?? undefined}
        />
        {showFifoHint ? (
          <Text role="caption" style={commonStyles.bottomSheetHelperText}>
            {t('consumeItem.fifoHint')}
          </Text>
        ) : null}
      </View>

      {!!compact && (
        <View style={commonStyles.bottomSheetSection}>
          <AppPressable
            testID={pantryTestIDs.consumeUseAll}
            accessibilityRole="button"
            accessibilityLabel={t('consumeItem.useAll')}
            disabled={useAll == null || useAll <= 0}
            onPress={() => {
              if (useAll != null)
                setQuantityInput(formatQuantityForInput(useAll));
            }}
          >
            <Text role="body">{t('consumeItem.useAll')}</Text>
          </AppPressable>
          <AppPressable
            testID={pantryTestIDs.consumeDetails}
            accessibilityRole="button"
            accessibilityLabel={t('consumeItem.optionalDetails')}
            accessibilityState={{ expanded: details }}
            onPress={() => setDetails(!details)}
          >
            <Text role="body">{t('consumeItem.optionalDetails')}</Text>
          </AppPressable>
        </View>
      )}
      {!!(!compact || details) && (
        <>
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
              label={t('labels.notes')}
              value={shared.notes}
              onChangeText={shared.setNotes}
              placeholder={t('consumeItem.notesPlaceholder')}
              multiline
              numberOfLines={3}
              useBottomSheetInput
            />
          </View>
        </>
      )}
    </>
  );
};
