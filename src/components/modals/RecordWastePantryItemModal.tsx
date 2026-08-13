import React, { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { StyleSheet } from 'react-native-unistyles';
import { FractionInput } from '#components/molecules/FractionInput';
import { FormInput } from '#components/molecules/FormInput';
import { FormCheckbox } from '#components/molecules/FormCheckbox';
import { CollapsibleChipPicker } from '#components/molecules/CollapsibleChipPicker';
import { QuantityInputFeedback } from '#components/molecules/QuantityInputFeedback';
import { parseFractionalInput } from '#/utils/fractionUtils';
import { validateDeductionQuantity } from '#/utils/validateDeductionQuantity';
import { useQuantityFeedback } from '#features/pantry/hooks/useQuantityFeedback';
import { WasteReason } from '#/graphql/generated/schemaTypes';
import { commonStyles } from '#/styles/commonStyles';
import { PantryOperation } from '#features/pantry/hooks/useOperationUnits';
import {
  PantryActionModal,
  type PantryActionSharedState,
} from './PantryActionModal';
import { type PantryActionModal_PantryItemFragment } from './PantryActionModal.generated';
import { Text } from '#components/atoms/Text';
import {
  formatNumberForInput,
  localizeNumericHint,
} from '#/utils/formatters/number';

interface RecordWastePantryItemModalProps {
  visible: boolean;
  pantryItemId: string | null;
  onClose: () => void;
  onConfirm: (
    wasteAmount: number,
    wasteReason: WasteReason,
    isComposted: boolean,
    isRecycled: boolean,
    notes: string,
    wasteUnitId?: string,
  ) => void;
}

const WASTE_REASON_OPTIONS: Array<{ labelKey: string; value: WasteReason }> = [
  { labelKey: 'recordWaste.reasonExpired', value: WasteReason.Expired },
  { labelKey: 'recordWaste.reasonSpoiled', value: WasteReason.Spoiled },
  { labelKey: 'recordWaste.reasonMold', value: WasteReason.Mold },
  { labelKey: 'recordWaste.reasonPest', value: WasteReason.Pest },
  { labelKey: 'recordWaste.reasonCookingFail', value: WasteReason.CookingFail },
  { labelKey: 'recordWaste.reasonSpilled', value: WasteReason.Spilled },
  { labelKey: 'recordWaste.reasonBurnt', value: WasteReason.Burnt },
  { labelKey: 'recordWaste.reasonOverstock', value: WasteReason.Overstock },
  { labelKey: 'recordWaste.reasonBadTaste', value: WasteReason.Taste },
  { labelKey: 'recordWaste.reasonGaveAway', value: WasteReason.GaveAway },
  { labelKey: 'recordWaste.reasonUnknownLoss', value: WasteReason.UnknownLoss },
  { labelKey: 'recordWaste.reasonOther', value: WasteReason.Other },
];

export const RecordWastePantryItemModal: React.FC<
  RecordWastePantryItemModalProps
> = ({ visible, pantryItemId, onClose, onConfirm }) => {
  const { t } = useTranslation();
  const [wasteAmountInput, setWasteAmountInput] = useState('');
  const [wasteReason, setWasteReason] = useState<WasteReason>(
    WasteReason.Expired,
  );
  const [isComposted, setIsComposted] = useState(false);
  const [isRecycled, setIsRecycled] = useState(false);

  const handleReset = (item: PantryActionModal_PantryItemFragment) => {
    setWasteAmountInput(formatNumberForInput(item.quantity));
    setWasteReason(WasteReason.Expired);
    setIsComposted(false);
    setIsRecycled(false);
  };

  const handleConfirm = (shared: PantryActionSharedState) => {
    if (!pantryItemId) return;

    const wasteValue = validateDeductionQuantity(
      wasteAmountInput,
      shared,
      'waste',
    );
    if (wasteValue === null) return;

    onConfirm(
      wasteValue,
      wasteReason,
      isComposted,
      isRecycled,
      shared.notes,
      shared.activeUnitId,
    );
    onClose();
  };

  const wasteReasonOptions = WASTE_REASON_OPTIONS.map(
    ({ labelKey, value }) => ({
      label: t(labelKey),
      value,
    }),
  );

  return (
    <PantryActionModal
      visible={visible}
      pantryItemId={pantryItemId}
      onClose={onClose}
      title={t('recordWaste.title')}
      confirmLabel={t('recordWaste.recordWaste')}
      confirmColor="warning"
      snapPoints={['80%', '95%']}
      unitToggleLabel={t('recordWaste.wasteBy')}
      operation={PantryOperation.Waste}
      onConfirm={handleConfirm}
      onReset={handleReset}
      renderActionFields={shared => (
        <WasteActionFields
          wasteAmountInput={wasteAmountInput}
          setWasteAmountInput={setWasteAmountInput}
          wasteReason={wasteReason}
          setWasteReason={setWasteReason}
          isComposted={isComposted}
          setIsComposted={setIsComposted}
          isRecycled={isRecycled}
          setIsRecycled={setIsRecycled}
          shared={shared}
          wasteReasonOptions={wasteReasonOptions}
        />
      )}
    />
  );
};

const WasteActionFields: React.FC<{
  wasteAmountInput: string;
  setWasteAmountInput: (v: string) => void;
  wasteReason: WasteReason;
  setWasteReason: (v: WasteReason) => void;
  isComposted: boolean;
  setIsComposted: (v: boolean) => void;
  isRecycled: boolean;
  setIsRecycled: (v: boolean) => void;
  shared: PantryActionSharedState;
  wasteReasonOptions: Array<{ label: string; value: WasteReason }>;
}> = ({
  wasteAmountInput,
  setWasteAmountInput,
  wasteReason,
  setWasteReason,
  isComposted,
  setIsComposted,
  isRecycled,
  setIsRecycled,
  shared,
  wasteReasonOptions,
}) => {
  const { t } = useTranslation();
  const wasteAmount = parseFractionalInput(wasteAmountInput);
  const { conversion, remaining, availableInUnit, remainingUnitSymbol } =
    useQuantityFeedback(wasteAmount, shared);

  return (
    <>
      {/* Waste Amount Input */}
      <View style={commonStyles.bottomSheetSection}>
        <FractionInput
          label={t('recordWaste.wasteAmount')}
          required
          value={wasteAmountInput}
          onChangeText={setWasteAmountInput}
          placeholder={localizeNumericHint(
            t('recordWaste.wasteAmountPlaceholder'),
          )}
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
          onFractionSelect={value =>
            setWasteAmountInput(formatNumberForInput(value))
          }
          selectedFractionValue={wasteAmount ?? undefined}
        />
      </View>

      {/* Waste Reason Selection */}
      <CollapsibleChipPicker
        label={t('recordWaste.wasteReason')}
        options={wasteReasonOptions}
        selectedValue={wasteReason}
        onSelect={setWasteReason}
      />

      {/* Sustainability Tracking */}
      <View style={commonStyles.bottomSheetSection}>
        <Text style={commonStyles.bottomSheetSectionLabel}>
          {t('recordWaste.sustainability')}
        </Text>
        <View style={styles.checkboxContainer}>
          <FormCheckbox
            label={t('recordWaste.composted')}
            checked={isComposted}
            onPress={() => setIsComposted(!isComposted)}
          />
        </View>
        <View style={styles.checkboxContainer}>
          <FormCheckbox
            label={t('recordWaste.recycledPackaging')}
            checked={isRecycled}
            onPress={() => setIsRecycled(!isRecycled)}
          />
        </View>
      </View>

      {/* Notes */}
      <View style={commonStyles.bottomSheetSection}>
        <FormInput
          label={t('recordWaste.notes')}
          value={shared.notes}
          onChangeText={shared.setNotes}
          placeholder={t('recordWaste.notesPlaceholder')}
          multiline
          numberOfLines={3}
          useBottomSheetInput
        />
      </View>
    </>
  );
};

const styles = StyleSheet.create(theme => ({
  checkboxContainer: {
    marginBottom: theme.spacing.sm,
  },
}));
