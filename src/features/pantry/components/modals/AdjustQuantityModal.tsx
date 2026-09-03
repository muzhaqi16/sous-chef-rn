import React, { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from '#/i18n';
import { useFragment } from '@apollo/client/react';
import { BottomSheetModal } from '#hooks/useStandardBottomSheet';
import { alertService } from '#/services/alertService';
import { useStandardBottomSheet } from '#hooks/useStandardBottomSheet';
import { FractionInput } from '#components/molecules/FractionInput';
import { FormInput } from '#components/molecules/FormInput';
import { FormattedItemSubtitle } from '#components/atoms/FormattedItemSubtitle';
import { BottomSheetHeader } from '#components/atoms/BottomSheetHeader';
import { BottomSheetFormScrollView } from '#components/atoms/BottomSheetFormScrollView';
import { parseFractionalInput } from '#/utils/fractionUtils';
import { commonStyles } from '#/styles/commonStyles';
import { formatNetWeightDisplay } from '#features/pantry/hooks/usePantryItemTransformation';
import { Text } from '#components/atoms/Text';
import { AdjustQuantityModal_PantryItemFragmentDoc } from './AdjustQuantityModal.generated';
import { parseDecimalInput } from '#/utils/parseDecimalInput';
import {
  formatNumberForInput,
  localizeNumericHint,
} from '#/utils/formatters/number';

interface AdjustQuantityModalProps {
  visible: boolean;
  pantryItemId: string | null;
  onClose: () => void;
  onConfirm: (
    newQuantity: number,
    reason: string,
    remainingNetWeight?: number,
  ) => void;
}

export const AdjustQuantityModal: React.FC<AdjustQuantityModalProps> = ({
  visible,
  pantryItemId,
  onClose,
  onConfirm,
}) => {
  const { t } = useTranslation();
  const { data, complete } = useFragment({
    fragment: AdjustQuantityModal_PantryItemFragmentDoc,
    fragmentName: 'AdjustQuantityModal_pantryItem',
    from: pantryItemId ? { __typename: 'PantryItem', id: pantryItemId } : null,
  });
  const pantryItem = pantryItemId && complete ? data : null;

  const { ref, modalProps, contentContainerStyle } = useStandardBottomSheet({
    visible: visible && !!pantryItem,
    onDismiss: onClose,
    snapPoints: ['65%', '85%'],
  });
  const [quantityInput, setQuantityInput] = useState('');
  const [reason, setReason] = useState('');
  const [remainingWeightInput, setRemainingWeightInput] = useState('');

  // Reset state when sheet opens (render-time conditional state update).
  // Key on pantryItemId so the reset still fires on a different item, but a
  // cache update to the same item (mutation result) does not clobber user input.
  const [prevVisible, setPrevVisible] = useState(visible);
  const [prevPantryItemId, setPrevPantryItemId] = useState(pantryItem?.id);
  if (visible !== prevVisible || pantryItem?.id !== prevPantryItemId) {
    setPrevVisible(visible);
    setPrevPantryItemId(pantryItem?.id);
    if (visible && pantryItem) {
      setQuantityInput(formatNumberForInput(pantryItem.quantity));
      setReason('');
      setRemainingWeightInput('');
    }
  }

  const handleConfirm = () => {
    if (!pantryItem) return;

    const newQuantity = parseFractionalInput(quantityInput);

    if (newQuantity === null || isNaN(newQuantity) || newQuantity < 0) {
      alertService.alert(t('labels.error'), t('errors.invalidQuantity'));
      return;
    }

    if (!reason.trim()) {
      alertService.alert(t('labels.error'), t('adjustQuantity.reasonRequired'));
      return;
    }

    const parsedWeight = parseDecimalInput(remainingWeightInput);
    const remainingNetWeight =
      !isNaN(parsedWeight) && parsedWeight >= 0 ? parsedWeight : undefined;

    onConfirm(newQuantity, reason.trim(), remainingNetWeight);
    onClose();
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
          title={t('adjustQuantity.title')}
          onCancel={onClose}
          onConfirm={handleConfirm}
          confirmLabel={t('adjustQuantity.adjust')}
        />

        {!!pantryItem && (
          <>
            <View style={commonStyles.bottomSheetItemInfo}>
              <Text style={commonStyles.bottomSheetItemName}>
                {pantryItem.itemName}
              </Text>
              <View style={commonStyles.bottomSheetItemRow}>
                <Text style={commonStyles.bottomSheetItemLabel}>
                  {t('adjustQuantity.currentLabel')}
                </Text>
                <FormattedItemSubtitle
                  quantity={pantryItem.quantity}
                  displayAsFraction={pantryItem.unit?.displayAsFraction}
                  unitSymbol={pantryItem.unit?.symbol}
                />
              </View>
            </View>

            {pantryItem.lastUsedAt != null &&
              pantryItem.remainingNetWeight != null && (
                <View style={commonStyles.bottomSheetItemRow}>
                  <Text style={commonStyles.bottomSheetItemLabel}>
                    {t('labels.remaining')}
                    {formatNetWeightDisplay(
                      pantryItem.remainingNetWeight,
                      pantryItem.netWeightUnit,
                    )}
                  </Text>
                </View>
              )}

            <View style={commonStyles.bottomSheetSection}>
              <FractionInput
                label={t('adjustQuantity.newQuantity')}
                required
                value={quantityInput}
                onChangeText={setQuantityInput}
                placeholder={localizeNumericHint(t('labels.eG1114Or15'))}
                keyboardType="numeric"
                useBottomSheetInput
              />
            </View>

            <View style={commonStyles.bottomSheetSection}>
              <FormInput
                label={t('labels.reason')}
                required
                value={reason}
                onChangeText={setReason}
                placeholder={t('adjustQuantity.reasonPlaceholder')}
                useBottomSheetInput
              />
            </View>

            {pantryItem.lastUsedAt != null &&
              pantryItem.remainingNetWeight != null && (
                <FormInput
                  label={t('labels.remainingWeight')}
                  value={remainingWeightInput}
                  onChangeText={setRemainingWeightInput}
                  placeholder={t('adjustQuantity.remainingWeightPlaceholder')}
                  keyboardType="decimal-pad"
                  useBottomSheetInput
                />
              )}
          </>
        )}
      </BottomSheetFormScrollView>
    </BottomSheetModal>
  );
};
