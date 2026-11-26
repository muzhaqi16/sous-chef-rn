import React from 'react';
import { SheetHeader } from '#components/templates/SheetHeader';
import { View } from 'react-native';
import { Controller, useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { useTranslation } from '#i18n';
import { useFragment } from '@apollo/client/react';
import { FractionInput } from '#components/molecules/FractionInput';
import { FormInput } from '#components/atoms/FormInput';
import { FormattedItemSubtitle } from '#components/molecules/FormattedItemSubtitle';
import { commonStyles } from '#styles/commonStyles';
import { Text } from '#components/atoms/Text';
import { AdjustQuantityModal_PantryItemFragmentDoc } from './AdjustQuantityModal.generated';
import { localizeNumericHint } from '#utils/formatters/number';
import {
  formatNetWeightDisplay,
  formatQuantityForInput,
  isUnchangedQuantity,
  resolveQuantityNotation,
} from '#utils/formatQuantity';
import { Sheet } from '#components/templates/Sheet';
import { SheetHeaderSlot } from '#components/templates/SheetHeaderSlot';
import { useOpening } from '#hooks/ui/useOpening';
import {
  adjustQuantitySchema,
  adjustQuantityDefaults,
  parseQuantity,
  parseRemainingWeight,
  type AdjustQuantityFormValues,
} from './adjustQuantityFormConfig';
import { reportValidationErrors } from '#utils/validation/common';
import {
  currentReading,
  formatReading,
  readingNotation,
} from '#domain/measure';
import { useReadingSystem } from '#hooks/settings/useReadingSystem';
import type { RecountUnits } from '#features/pantry/types';
import { useSheetUnsavedInput } from '#components/templates/SheetCloseGuard';

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
  const { complete } = useFragment({
    fragment: AdjustQuantityModal_PantryItemFragmentDoc,
    fragmentName: 'AdjustQuantityModal_pantryItem',
    from: pantryItemId ? { __typename: 'PantryItem', id: pantryItemId } : null,
  });
  // Shown once the stack is read, so each opening's form seeds from it once:
  // a cache update to the stack while it is open keeps what was typed.
  const presented = visible && !!pantryItemId && complete;
  const opening = useOpening(presented, pantryItemId);

  return (
    <Sheet
      mode="form"
      visible={presented}
      onDismiss={onClose}
      headerFromContent
      snapPoints={['65%', '85%']}
      contentContainerStyle={commonStyles.bottomSheetContent}
    >
      {opening?.payload ? (
        <AdjustQuantityForm
          key={opening.id}
          pantryItemId={opening.payload}
          onClose={onClose}
          onConfirm={onConfirm}
        />
      ) : null}
    </Sheet>
  );
};

/** One opening's recount, seeded from the stack as it opened. */
const AdjustQuantityForm: React.FC<
  Omit<AdjustQuantityModalProps, 'visible' | 'pantryItemId'> & {
    pantryItemId: string;
  }
> = ({ pantryItemId, onClose, onConfirm }) => {
  const { t } = useTranslation();
  const { data, complete } = useFragment({
    fragment: AdjustQuantityModal_PantryItemFragmentDoc,
    fragmentName: 'AdjustQuantityModal_pantryItem',
    from: { __typename: 'PantryItem', id: pantryItemId },
  });
  const pantryItem = complete ? data : null;
  const readingSystem = useReadingSystem();
  // The count as the row reads it ("3 lb" for 1360.78 g) while the row reads
  // the count: an opened stack reads what is inside, so this keeps its own unit.
  // Only the server converts, so a figure typed in the reading's unit goes with
  // that unit.
  const heldReading = pantryItem
    ? currentReading(
        pantryItem.amountLeft,
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

  const seed: AdjustQuantityFormValues | undefined = pantryItem
    ? {
        quantityInput: heldReading
          ? formatQuantityForInput(heldReading.value, {
              notation: readingNotation(heldReading),
            })
          : formatQuantityForInput(pantryItem.quantity, {
              notation: resolveQuantityNotation(
                pantryItem.unit.displayAsFraction,
              ),
            }),
        reason: '',
        remainingWeightInput: '',
      }
    : undefined;
  const {
    control,
    handleSubmit,
    formState: { isDirty },
  } = useForm<AdjustQuantityFormValues>({
    resolver: yupResolver(adjustQuantitySchema),
    defaultValues: seed ?? adjustQuantityDefaults(),
  });
  useSheetUnsavedInput(isDirty);

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
  }, reportValidationErrors);

  return (
    <>
      <SheetHeaderSlot>
        <SheetHeader
          title={t('adjustQuantity.title')}
          onClose={onClose}
          confirm={{
            onPress: () => {
              void handleConfirm();
            },
            accessibilityLabel: t('adjustQuantity.adjust'),
          }}
        />
      </SheetHeaderSlot>
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
                  unit={pantryItem.unit}
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
                  ref={field.ref}
                  label={t('adjustQuantity.newQuantity')}
                  required
                  value={field.value}
                  onChangeText={field.onChange}
                  error={fieldState.error?.message}
                  placeholder={localizeNumericHint(t('labels.eG1114Or15'))}
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
                  ref={field.ref}
                  label={t('labels.reason')}
                  required
                  value={field.value}
                  onChangeText={field.onChange}
                  error={fieldState.error?.message}
                  placeholder={t('adjustQuantity.reasonPlaceholder')}
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
                    ref={field.ref}
                    label={t('labels.remainingWeight')}
                    value={field.value}
                    onChangeText={field.onChange}
                    placeholder={t('adjustQuantity.remainingWeightPlaceholder')}
                    keyboardType="decimal-pad"
                  />
                )}
              />
            )}
        </>
      )}
    </>
  );
};
