import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Controller, useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { useTranslation } from '#/i18n';
import { useFragment } from '@apollo/client/react';
import { FormInput } from '#components/atoms/FormInput';
import { UnitAutocompleteField } from '#features/catalog/ui/autocomplete/UnitAutocompleteField';
import { FormattedItemSubtitle } from '#components/molecules/FormattedItemSubtitle';
import { BottomSheetHeader } from '#components/molecules/BottomSheetHeader';
import { commonStyles } from '#/styles/commonStyles';
import { formatNetWeightDisplay } from '#features/pantry/hooks/usePantryItemTransformation';
import { Text } from '#components/atoms/Text';
import { CorrectWeightModal_PantryItemFragmentDoc } from './CorrectWeightModal.generated';
import {
  formatNumberForInput,
  localizeNumericHint,
} from '#/utils/formatters/number';
import { Sheet } from '#components/templates/Sheet';
import {
  correctWeightSchema,
  correctWeightDefaults,
  parseWeight,
  type CorrectWeightFormValues,
} from './correctWeightFormConfig';

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

  const { control, handleSubmit, setValue, reset, getValues } =
    useForm<CorrectWeightFormValues>({
      resolver: yupResolver(correctWeightSchema),
      defaultValues: correctWeightDefaults(),
    });

  // `reset` notifies mounted `Controller` children synchronously, so calling it
  // during render updates components that are not rendering. The seed is
  // computed here (own state only) and applied from an effect. Keyed on the
  // item id so a cache update to the same item does not clobber typed input.
  const [pendingSeed, setPendingSeed] =
    useState<CorrectWeightFormValues | null>(null);
  const [seedKey, setSeedKey] = useState<string | null>(null);
  const nextSeedKey = visible && pantryItem ? pantryItem.id : null;
  if (nextSeedKey !== seedKey) {
    setSeedKey(nextSeedKey);
    setPendingSeed(
      nextSeedKey && pantryItem
        ? {
            weightInput: formatNumberForInput(pantryItem.netWeight),
            unitDisplay:
              pantryItem.netWeightUnit?.symbol ||
              pantryItem.netWeightUnit?.name ||
              '',
            selectedUnitId: pantryItem.netWeightUnit?.id || null,
            reason: '',
          }
        : null,
    );
  }

  useEffect(() => {
    if (pendingSeed) reset(pendingSeed);
  }, [pendingSeed, reset]);

  const handleUnitSelected = (
    unitId: string | null,
    unitName: string | null,
  ) => {
    setValue('selectedUnitId', unitId, { shouldDirty: true });
    if (unitName) setValue('unitDisplay', unitName, { shouldDirty: true });
  };

  // Reaching here means the schema passed; a refusal renders under its field.
  const handleConfirm = handleSubmit(values => {
    if (!pantryItem) return;
    const { selectedUnitId } = getValues();
    onConfirm(
      parseWeight(values),
      values.reason.trim(),
      selectedUnitId && selectedUnitId !== pantryItem.netWeightUnit?.id
        ? selectedUnitId
        : undefined,
    );
    onClose();
  });

  const currentWeightText = formatNetWeightDisplay(
    pantryItem?.netWeight,
    pantryItem?.netWeightUnit,
  );
  const remainingWeightText = formatNetWeightDisplay(
    pantryItem?.remainingNetWeight,
    pantryItem?.netWeightUnit,
  );

  return (
    <Sheet
      mode="form"
      visible={visible ? !!pantryItem : false}
      onDismiss={onClose}
      snapPoints={['65%', '85%']}
      contentContainerStyle={commonStyles.bottomSheetContent}
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
                  {t('labels.remaining')}
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
            <Controller
              control={control}
              name="weightInput"
              render={({ field, fieldState }) => (
                <FormInput
                  label={t('correctWeight.newNetWeight')}
                  required
                  value={field.value}
                  onChangeText={field.onChange}
                  error={fieldState.error?.message}
                  placeholder={localizeNumericHint(t('labels.eG145'))}
                  keyboardType="decimal-pad"
                  useBottomSheetInput
                />
              )}
            />
          </View>

          <View style={commonStyles.bottomSheetSection}>
            <Controller
              control={control}
              name="unitDisplay"
              render={({ field }) => (
                <UnitAutocompleteField
                  variant="modal"
                  label={t('storageLocationForm.unit')}
                  value={field.value}
                  onChangeText={field.onChange}
                  onUnitSelected={handleUnitSelected}
                  placeholder={t('labels.ozGMl')}
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
                  placeholder={t('correctWeight.reasonPlaceholder')}
                  useBottomSheetInput
                />
              )}
            />
          </View>
        </>
      )}
    </Sheet>
  );
};
