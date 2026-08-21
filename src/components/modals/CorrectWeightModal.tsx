import React, { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from '#/i18n';
import { useFragment } from '@apollo/client/react';
import { BottomSheetModal } from '#hooks/useStandardBottomSheet';
import { alertService } from '#/services/alertService';
import { useStandardBottomSheet } from '#hooks/useStandardBottomSheet';
import { FormInput } from '#components/molecules/FormInput';
import { UnitAutocompleteField } from '#components/molecules/AutocompleteField/UnitAutocompleteField';
import { FormattedItemSubtitle } from '#components/atoms/FormattedItemSubtitle';
import { BottomSheetHeader } from '#components/atoms/BottomSheetHeader';
import { BottomSheetFormScrollView } from '#components/atoms/BottomSheetFormScrollView';
import { commonStyles } from '#/styles/commonStyles';
import { formatNetWeightDisplay } from '#features/pantry/hooks/usePantryItemTransformation';
import { Text } from '#components/atoms/Text';
import { CorrectWeightModal_PantryItemFragmentDoc } from './CorrectWeightModal.generated';
import { parseDecimalInput } from '#/utils/parseDecimalInput';
import {
  formatNumberForInput,
  localizeNumericHint,
} from '#/utils/formatters/number';

interface CorrectWeightModalProps {
  visible: boolean;
  pantryItemId: string | null;
  onClose: () => void;
  onConfirm: (
    netWeight: number,
    reason: string,
    netWeightUnitId?: string,
  ) => void;
}

export const CorrectWeightModal: React.FC<CorrectWeightModalProps> = ({
  visible,
  pantryItemId,
  onClose,
  onConfirm,
}) => {
  const { t } = useTranslation();
  const { data, complete } = useFragment({
    fragment: CorrectWeightModal_PantryItemFragmentDoc,
    fragmentName: 'CorrectWeightModal_pantryItem',
    from: pantryItemId ? { __typename: 'PantryItem', id: pantryItemId } : null,
  });
  const pantryItem = pantryItemId && complete ? data : null;

  const { ref, modalProps, contentContainerStyle } = useStandardBottomSheet({
    visible: visible && !!pantryItem,
    onDismiss: onClose,
    snapPoints: ['65%', '85%'],
  });
  const [weightInput, setWeightInput] = useState('');
  const [unitDisplay, setUnitDisplay] = useState('');
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);
  const [reason, setReason] = useState('');

  // Reset state when sheet opens (render-time conditional state update).
  // Key on pantryItemId so cache updates to the same item don't clobber input.
  const [prevVisible, setPrevVisible] = useState(visible);
  const [prevPantryItemId, setPrevPantryItemId] = useState(pantryItem?.id);
  if (visible !== prevVisible || pantryItem?.id !== prevPantryItemId) {
    setPrevVisible(visible);
    setPrevPantryItemId(pantryItem?.id);
    if (visible && pantryItem) {
      setWeightInput(formatNumberForInput(pantryItem.netWeight));
      setUnitDisplay(
        pantryItem.netWeightUnit?.symbol ||
          pantryItem.netWeightUnit?.name ||
          '',
      );
      setSelectedUnitId(pantryItem.netWeightUnit?.id || null);
      setReason('');
    }
  }

  const handleUnitSelected = (
    unitId: string | null,
    unitName: string | null,
  ) => {
    setSelectedUnitId(unitId);
    if (unitName) setUnitDisplay(unitName);
  };

  const handleConfirm = () => {
    if (!pantryItem) return;

    const netWeight = parseDecimalInput(weightInput);
    if (isNaN(netWeight) || netWeight <= 0) {
      alertService.alert(t('labels.error'), t('correctWeight.invalidWeight'));
      return;
    }

    if (!reason.trim()) {
      alertService.alert(t('labels.error'), t('correctWeight.reasonRequired'));
      return;
    }

    onConfirm(
      netWeight,
      reason.trim(),
      selectedUnitId && selectedUnitId !== pantryItem.netWeightUnit?.id
        ? selectedUnitId
        : undefined,
    );
    onClose();
  };

  const currentWeightText = formatNetWeightDisplay(
    pantryItem?.netWeight,
    pantryItem?.netWeightUnit,
  );
  const remainingWeightText = formatNetWeightDisplay(
    pantryItem?.remainingNetWeight,
    pantryItem?.netWeightUnit,
  );

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
          title={t('correctWeight.title')}
          onCancel={onClose}
          onConfirm={handleConfirm}
          confirmLabel={t('correctWeight.correct')}
        />

        {!!pantryItem && (
          <>
            <View style={commonStyles.bottomSheetItemInfo}>
              <Text style={commonStyles.bottomSheetItemName}>
                {pantryItem.itemName}
              </Text>
              {!!currentWeightText && (
                <View style={commonStyles.bottomSheetItemRow}>
                  <Text style={commonStyles.bottomSheetItemLabel}>
                    {t('correctWeight.netWeightPrefix')}
                    {currentWeightText}
                  </Text>
                </View>
              )}
              {!!remainingWeightText && (
                <View style={commonStyles.bottomSheetItemRow}>
                  <Text style={commonStyles.bottomSheetItemLabel}>
                    {t('correctWeight.remainingPrefix')}
                    {remainingWeightText}
                  </Text>
                </View>
              )}
              <View style={commonStyles.bottomSheetItemRow}>
                <Text style={commonStyles.bottomSheetItemLabel}>
                  {t('correctWeight.quantityLabel')}
                </Text>
                <FormattedItemSubtitle
                  quantity={pantryItem.quantity}
                  displayAsFraction={pantryItem.unit?.displayAsFraction}
                  unitSymbol={pantryItem.unit?.symbol}
                />
              </View>
            </View>

            <View style={commonStyles.bottomSheetSection}>
              <FormInput
                label={t('correctWeight.newNetWeight')}
                required
                value={weightInput}
                onChangeText={setWeightInput}
                placeholder={localizeNumericHint(
                  t('correctWeight.newNetWeightPlaceholder'),
                )}
                keyboardType="decimal-pad"
                useBottomSheetInput
              />
            </View>

            <View style={commonStyles.bottomSheetSection}>
              <UnitAutocompleteField
                variant="modal"
                label={t('correctWeight.unit')}
                value={unitDisplay}
                onChangeText={setUnitDisplay}
                onUnitSelected={handleUnitSelected}
                placeholder={t('correctWeight.unitPlaceholder')}
              />
            </View>

            <View style={commonStyles.bottomSheetSection}>
              <FormInput
                label={t('correctWeight.reason')}
                required
                value={reason}
                onChangeText={setReason}
                placeholder={t('correctWeight.reasonPlaceholder')}
                useBottomSheetInput
              />
            </View>
          </>
        )}
      </BottomSheetFormScrollView>
    </BottomSheetModal>
  );
};
