import React, { useState } from 'react';
import { View } from 'react-native';
import { Controller, useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { useTranslation } from '#/i18n';
import { useFragment } from '@apollo/client/react';
import { FractionInput } from '#components/molecules/FractionInput';
import { FormInput } from '#components/atoms/FormInput';
import { FormattedItemSubtitle } from '#components/molecules/FormattedItemSubtitle';
import { BottomSheetHeader } from '#components/molecules/BottomSheetHeader';
import { commonStyles } from '#/styles/commonStyles';
import { formatNetWeightDisplay } from '#features/pantry/hooks/usePantryItemTransformation';
import { Text } from '#components/atoms/Text';
import { AdjustQuantityModal_PantryItemFragmentDoc } from './AdjustQuantityModal.generated';
import {
  formatNumberForInput,
  localizeNumericHint,
} from '#/utils/formatters/number';
import { Sheet } from '#components/templates/Sheet';
import {
  adjustQuantitySchema,
  adjustQuantityDefaults,
  parseQuantity,
  parseRemainingWeight,
  type AdjustQuantityFormValues,
} from './adjustQuantityFormConfig';

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

  const { control, handleSubmit, reset } = useForm<AdjustQuantityFormValues>({
    resolver: yupResolver(adjustQuantitySchema),
    defaultValues: adjustQuantityDefaults(),
  });

  // Reset state when sheet opens (render-time conditional state update).
  // Key on pantryItemId so the reset still fires on a different item, but a
  // cache update to the same item (mutation result) does not clobber user input.
  const [prevVisible, setPrevVisible] = useState(visible);
  const [prevPantryItemId, setPrevPantryItemId] = useState(pantryItem?.id);
  if (visible !== prevVisible || pantryItem?.id !== prevPantryItemId) {
    setPrevVisible(visible);
    setPrevPantryItemId(pantryItem?.id);
    if (visible && pantryItem) {
      reset({
        quantityInput: formatNumberForInput(pantryItem.quantity),
        reason: '',
        remainingWeightInput: '',
      });
    }
  }

  // Reaching here means the schema passed; a refusal renders under its field.
  const handleConfirm = handleSubmit(values => {
    if (!pantryItem) return;
    onConfirm(
      parseQuantity(values),
      values.reason.trim(),
      parseRemainingWeight(values),
    );
    onClose();
  });

  return (
    <Sheet
      mode="form"
      visible={visible ? !!pantryItem : false}
      onDismiss={onClose}
      snapPoints={['65%', '85%']}
      contentContainerStyle={commonStyles.bottomSheetContent}
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
            <Controller
              control={control}
              name="quantityInput"
              render={({ field, fieldState }) => (
                <FractionInput
                  label={t('adjustQuantity.newQuantity')}
                  required
                  value={field.value}
                  onChangeText={field.onChange}
                  error={fieldState.error?.message}
                  placeholder={localizeNumericHint(t('labels.eG1114Or15'))}
                  keyboardType="numeric"
                  useBottomSheetInput
                />
              )}
            />
          </View>

          <View style={commonStyles.bottomSheetSection}>
            <Controller
              control={control}
              name="reason"
              render={({ field, fieldState }) => (
                <FormInput
                  label={t('labels.reason')}
                  required
                  value={field.value}
                  onChangeText={field.onChange}
                  error={fieldState.error?.message}
                  placeholder={t('adjustQuantity.reasonPlaceholder')}
                  useBottomSheetInput
                />
              )}
            />
          </View>

          {pantryItem.lastUsedAt != null &&
            pantryItem.remainingNetWeight != null && (
              <Controller
                control={control}
                name="remainingWeightInput"
                render={({ field }) => (
                  <FormInput
                    label={t('labels.remainingWeight')}
                    value={field.value}
                    onChangeText={field.onChange}
                    placeholder={t('adjustQuantity.remainingWeightPlaceholder')}
                    keyboardType="decimal-pad"
                    useBottomSheetInput
                  />
                )}
              />
            )}
        </>
      )}
    </Sheet>
  );
};
