import React, { useEffect, useState } from 'react';
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
import { Text } from '#components/atoms/Text';
import { AdjustQuantityModal_PantryItemFragmentDoc } from './AdjustQuantityModal.generated';
import { localizeNumericHint } from '#/utils/formatters/number';
import {
  formatNetWeightDisplay,
  formatQuantityForInput,
  isUnchangedQuantity,
  resolveQuantityNotation,
} from '#/utils/formatQuantity';
import { Sheet } from '#components/templates/Sheet';
import {
  adjustQuantitySchema,
  adjustQuantityDefaults,
  parseQuantity,
  parseRemainingWeight,
  type AdjustQuantityFormValues,
} from './adjustQuantityFormConfig';
import { logValidationErrors } from '#/utils/validation/common';
import {
  currentReading,
  formatReading,
  readingNotation,
} from '#domain/measure';
import { useReadingSystem } from '#hooks/settings/useReadingSystem';
import type { RecountUnits } from '#features/pantry/types';

interface AdjustQuantityModalProps {
  visible: boolean;
  pantryItemId: string | null;
  onClose: () => void;
  onConfirm: (
    newQuantity: number,
    reason: string,
    remainingNetWeight?: number,
    units?: RecountUnits,
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
  const readingSystem = useReadingSystem();
  // The count as the row reads it ("3 lb" for 1360.78 g) while `held` still
  // describes the stack; after a local write, as stored. Only the server
  // converts, so a figure typed in the reading's unit goes with that unit.
  const heldReading = pantryItem
    ? currentReading(
        pantryItem.held,
        {
          value: pantryItem.displayAmount.quantity,
          unitId: pantryItem.displayAmount.unit.id,
        },
        readingSystem,
      )
    : null;
  // The API refuses a weight stated in the tracking unit: there it is as stored.
  const remainingRead = pantryItem
    ? currentReading(
        pantryItem.remaining,
        {
          value: pantryItem.remainingNetWeight,
          unitId: pantryItem.netWeightUnit?.id,
        },
        readingSystem,
      )
    : null;
  const remainingReading =
    remainingRead &&
    (remainingRead.unitId !== pantryItem?.unit.id ||
      remainingRead.unitId === pantryItem.netWeightUnit?.id)
      ? remainingRead
      : null;

  const { control, handleSubmit, reset } = useForm<AdjustQuantityFormValues>({
    resolver: yupResolver(adjustQuantitySchema),
    defaultValues: adjustQuantityDefaults(),
  });

  // `reset` notifies mounted `Controller`s synchronously, so the seed is
  // computed during render and applied from an effect. Keyed on the item id so
  // a cache update to the same item keeps typed input.
  const [pendingSeed, setPendingSeed] =
    useState<AdjustQuantityFormValues | null>(null);
  const [seedKey, setSeedKey] = useState<string | null>(null);
  const nextSeedKey = visible && pantryItem ? pantryItem.id : null;
  if (nextSeedKey !== seedKey) {
    setSeedKey(nextSeedKey);
    setPendingSeed(
      nextSeedKey && pantryItem
        ? {
            quantityInput: heldReading
              ? formatQuantityForInput(heldReading.value, {
                  notation: readingNotation(heldReading),
                })
              : formatQuantityForInput(pantryItem.quantity, {
                  notation: resolveQuantityNotation(
                    null,
                    pantryItem.unit.displayAsFraction,
                  ),
                }),
            reason: '',
            remainingWeightInput: '',
          }
        : null,
    );
  }

  useEffect(() => {
    if (pendingSeed) reset(pendingSeed);
  }, [pendingSeed, reset]);

  // Reaching here means the schema passed; a refusal renders under its field.
  const handleConfirm = handleSubmit(values => {
    if (!pantryItem) return;
    // The seed is rounded to what the field can show. Sent back unedited, it
    // rewrites the stock and books an adjustment for the rounding; the exact
    // stored value moves nothing, so the server records nothing.
    const edited = parseQuantity(values);
    const unchanged = isUnchangedQuantity(
      edited,
      heldReading ? heldReading.value : pantryItem.quantity,
    );
    const statedIn =
      heldReading && heldReading.unitId !== pantryItem.unit.id
        ? heldReading.unitId
        : null;
    const remaining = parseRemainingWeight(values);
    const remainingIn =
      remainingReading &&
      remainingReading.unitId !== pantryItem.netWeightUnit?.id
        ? remainingReading.unitId
        : null;
    onConfirm(
      unchanged ? pantryItem.quantity : edited,
      values.reason.trim(),
      remaining,
      {
        ...(!unchanged && statedIn ? { newQuantityUnitId: statedIn } : {}),
        ...(remaining != null && remainingIn
          ? { remainingNetWeightUnitId: remainingIn }
          : {}),
      },
    );
    onClose();
  }, logValidationErrors);

  return (
    <Sheet
      mode="form"
      visible={visible ? !!pantryItem : false}
      onDismiss={onClose}
      snapPoints={['65%', '85%']}
      contentContainerStyle={commonStyles.bottomSheetContent}
    >
      <BottomSheetHeader
        contentPadding="md"
        title={t('adjustQuantity.title')}
        onCancel={onClose}
        onConfirm={handleConfirm}
        confirmLabel={t('adjustQuantity.adjust')}
      />

      {!!pantryItem && (
        <>
          <View style={commonStyles.bottomSheetItemInfo}>
            <Text role="heading" style={commonStyles.bottomSheetItemName}>
              {pantryItem.itemName}
            </Text>
            <View style={commonStyles.bottomSheetItemRow}>
              <Text role="body" tone="secondary">
                {t('adjustQuantity.currentLabel')}
              </Text>
              {heldReading ? (
                <Text role="body">{formatReading(heldReading)}</Text>
              ) : (
                <FormattedItemSubtitle
                  quantity={pantryItem.quantity}
                  displayAsFraction={pantryItem.unit.displayAsFraction}
                  unitSymbol={pantryItem.unit.symbol}
                />
              )}
            </View>
          </View>

          {pantryItem.lastUsedAt != null &&
            pantryItem.remainingNetWeight != null && (
              <View style={commonStyles.bottomSheetItemRow}>
                <Text role="body" tone="secondary">
                  {t('labels.remaining')}
                  {remainingReading
                    ? formatReading(remainingReading)
                    : formatNetWeightDisplay(
                        pantryItem.remainingNetWeight,
                        pantryItem.netWeightUnit,
                      )}
                </Text>
              </View>
            )}

          <Text
            role="caption"
            tone="secondary"
            style={commonStyles.bottomSheetSection}
          >
            {t('adjustQuantity.description')}
          </Text>

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
