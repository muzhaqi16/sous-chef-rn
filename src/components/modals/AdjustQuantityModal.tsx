import React, { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { BottomSheetModal } from '#hooks/useStandardBottomSheet';
import { alertService } from '#/services/alertService';
import { useStandardBottomSheet } from '#hooks/useStandardBottomSheet';
import { FractionInput } from '#components/molecules/FractionInput';
import { FormInput } from '#components/molecules/FormInput';
import { FormattedItemSubtitle } from '#components/atoms/FormattedItemSubtitle';
import { BottomSheetHeader } from '#components/atoms/BottomSheetHeader';
import { BottomSheetKeyboardAwareScrollView } from '#components/atoms/BottomSheetKeyboardAwareScrollView';
import { parseFractionalInput } from '#/utils/fractionUtils';
import { type PantryItemFragment } from '#features/pantry/graphql/pantryFragments.generated';
import { commonStyles } from '#/styles/commonStyles';
import { formatNetWeightDisplay } from '#features/pantry/hooks/usePantryItemTransformation';
import { Text } from '#components/atoms/Text';

interface AdjustQuantityModalProps {
  visible: boolean;
  pantryItem: PantryItemFragment | null;
  onClose: () => void;
  onConfirm: (
    newQuantity: number,
    reason: string,
    remainingNetWeight?: number,
  ) => void;
}

export const AdjustQuantityModal: React.FC<AdjustQuantityModalProps> = ({
  visible,
  pantryItem,
  onClose,
  onConfirm,
}) => {
  const { t } = useTranslation();
  const { ref, modalProps, contentContainerStyle } = useStandardBottomSheet({
    visible: visible && !!pantryItem,
    onDismiss: onClose,
    snapPoints: ['65%', '85%'],
  });
  const [quantityInput, setQuantityInput] = useState('');
  const [reason, setReason] = useState('');
  const [remainingWeightInput, setRemainingWeightInput] = useState('');

  // Reset state when sheet opens (render-time conditional state update)
  const [prevVisible, setPrevVisible] = useState(visible);
  const [prevPantryItem, setPrevPantryItem] = useState(pantryItem);
  if (visible !== prevVisible || pantryItem !== prevPantryItem) {
    setPrevVisible(visible);
    setPrevPantryItem(pantryItem);
    if (visible && pantryItem) {
      setQuantityInput(pantryItem.quantity.toString());
      setReason('');
      setRemainingWeightInput('');
    }
  }

  const handleConfirm = () => {
    if (!pantryItem) return;

    const newQuantity = parseFractionalInput(quantityInput);

    if (newQuantity === null || isNaN(newQuantity) || newQuantity < 0) {
      alertService.alert(
        t('labels.error'),
        t('adjustQuantity.invalidQuantity'),
      );
      return;
    }

    if (!reason.trim()) {
      alertService.alert(t('labels.error'), t('adjustQuantity.reasonRequired'));
      return;
    }

    const parsedWeight = parseFloat(remainingWeightInput);
    const remainingNetWeight =
      !isNaN(parsedWeight) && parsedWeight >= 0 ? parsedWeight : undefined;

    onConfirm(newQuantity, reason.trim(), remainingNetWeight);
    onClose();
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
                    {t('adjustQuantity.remainingLabel')}
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
                placeholder={t('adjustQuantity.quantityPlaceholder')}
                keyboardType="numeric"
                useBottomSheetInput
              />
            </View>

            <View style={commonStyles.bottomSheetSection}>
              <FormInput
                label={t('adjustQuantity.reason')}
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
                  label={t('adjustQuantity.remainingWeight')}
                  value={remainingWeightInput}
                  onChangeText={setRemainingWeightInput}
                  placeholder={t('adjustQuantity.remainingWeightPlaceholder')}
                  keyboardType="decimal-pad"
                  useBottomSheetInput
                />
              )}
          </>
        )}
      </BottomSheetKeyboardAwareScrollView>
    </BottomSheetModal>
  );
};
