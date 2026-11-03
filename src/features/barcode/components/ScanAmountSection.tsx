import React from 'react';
import { View } from 'react-native';
import {
  Controller,
  useController,
  useWatch,
  type UseFormReturn,
} from 'react-hook-form';
import { StyleSheet } from 'react-native-unistyles';
import { useTranslation } from '#/i18n';
import { AppPressable } from '#components/atoms/AppPressable';
import { Card } from '#components/atoms/Card';
import { FieldRow } from '#components/atoms/FieldRow';
import { Icon } from '#components/atoms/Icon';
import { Text } from '#components/atoms/Text';
import { FractionInput } from '#components/molecules/FractionInput';
import { UnitAutocompleteField } from '#features/catalog/ui/autocomplete/UnitAutocompleteField';
import { PackageContentsFields } from '#features/pantry/ui/PackageContentsFields';
import { takesContents } from '#domain/stockAmount';
import { barcodeTestIDs } from '#features/barcode/testIDs';
import {
  formatQuantityWithUnit,
  type QuantityDisplayOptions,
} from '#utils/formatQuantity';
import { parseFractionalInput } from '#/utils/fractionUtils';
import { parseDecimalInput } from '#/utils/parseDecimalInput';
import type { ScanAmountFormValues } from './scanAmountFormConfig';

interface ScanAmountSectionProps {
  form: UseFormReturn<ScanAmountFormValues>;
  /** The fields show once opened; until then the summary stands for them. */
  editing: boolean;
  onEdit: () => void;
  /**
   * The held stack the add joins while it is in that stack's unit, read as its
   * row reads it. In another unit the server may open a stack of its own.
   */
  joins?: { amount: string; unitId: string } | null;
  /** The add, at the card's foot: it adds what the card says, fields open or not. */
  action?: React.ReactNode;
}

const AS_DECIMAL: QuantityDisplayOptions = { notation: 'decimal' };

/** What a pantry add from a scan records, read as text and opened to edit. */
export const ScanAmountSection: React.FC<ScanAmountSectionProps> = ({
  form,
  editing,
  onEdit,
  joins,
  action,
}) => {
  const { t } = useTranslation();
  const { control, setValue, trigger } = form;
  const [
    quantityInput,
    unitDisplay,
    unitType,
    sizeInput,
    sizeUnitDisplay,
    packageUnitId,
  ] = useWatch({
    control,
    name: [
      'quantityInput',
      'unitDisplay',
      'unitType',
      'sizeInput',
      'sizeUnitDisplay',
      'unitId',
    ],
  });
  const holdsContents = takesContents(unitType);
  const { fieldState: unitState } = useController({ control, name: 'unitId' });
  const { fieldState: sizeUnitState } = useController({
    control,
    name: 'sizeUnitId',
  });
  const { field: sizeField, fieldState: sizeState } = useController({
    control,
    name: 'sizeInput',
  });
  const { field: sizeUnitField } = useController({
    control,
    name: 'sizeUnitDisplay',
  });

  // Read here, closed or open: a field state subscribes when it is read, and a
  // refusal arrives as the card opens.
  const unitError = unitState.error?.message;
  const sizeError = sizeState.error?.message;
  const sizeUnitError = sizeUnitState.error?.message;

  const amount = formatQuantityWithUnit(parseFractionalInput(quantityInput), {
    symbol: unitDisplay,
  });
  const size =
    holdsContents && sizeInput.trim()
      ? formatQuantityWithUnit(
          parseDecimalInput(sizeInput),
          { symbol: sizeUnitDisplay },
          AS_DECIMAL,
        )
      : null;
  const stated = size ? t('barcode.amount.ofSize', { amount, size }) : amount;
  // A held product joins its stack: the summary says so ("Adds 1 can to your 2 cans").
  const summary =
    joins && joins.unitId === packageUnitId
      ? t('barcode.amount.joinsHeld', { amount: stated, held: joins.amount })
      : stated;

  if (!editing) {
    return (
      <Card style={styles.summaryCard}>
        <AppPressable
          onPress={onEdit}
          accessibilityRole="button"
          style={styles.summary}
          testID={barcodeTestIDs.scanAmountSummary}
        >
          <View style={styles.summaryText}>
            <Text role="caption" tone="secondary">
              {t('barcode.amount.title')}
            </Text>
            <Text role="bodyStrong">{summary}</Text>
          </View>
          <Text role="label" tone="accent">
            {t('labels.edit')}
          </Text>
          <Icon name="chevron-forward" size={16} tone="primary" />
        </AppPressable>
        {action}
      </Card>
    );
  }

  return (
    <Card style={styles.editor}>
      <Text role="caption" tone="secondary">
        {t('barcode.amount.title')}
      </Text>
      <FieldRow>
        <Controller
          control={control}
          name="quantityInput"
          render={({ field, fieldState }) => (
            <FractionInput
              label={t('labels.quantity')}
              required
              value={field.value}
              onChangeText={field.onChange}
              error={fieldState.error?.message}
              testID={barcodeTestIDs.scanAmountQuantity}
            />
          )}
        />
        <Controller
          control={control}
          name="unitDisplay"
          render={({ field }) => (
            <UnitAutocompleteField
              variant="modal"
              label={t('labels.unit')}
              required
              value={field.value}
              onChangeText={field.onChange}
              onUnitSelected={(unitId, unitName, pickedType, unitSymbol) => {
                // Typing clears the pick on every keystroke; only a pick is
                // checked here, so the error waits for a submit without one.
                setValue('unitType', pickedType ?? null);
                setValue('unitId', unitId, { shouldValidate: unitId !== null });
                const shown = unitSymbol ?? unitName;
                if (shown) setValue('unitDisplay', shown);
                // A measure holds nothing, which retires a contents message.
                if (form.formState.isSubmitted) {
                  void trigger(['quantityInput', 'sizeUnitId']);
                }
              }}
              error={unitError}
              placeholder={t('labels.pcsDozen')}
              testID={barcodeTestIDs.scanAmountUnit}
            />
          )}
        />
      </FieldRow>

      {holdsContents ? (
        <PackageContentsFields
          variant="modal"
          size={sizeField.value}
          onSizeChange={text => {
            sizeField.onChange(text);
            // Only a size asks for its unit, so clearing it clears that error;
            // re-checked only once shown, never mid-typing.
            if (sizeUnitError) void trigger('sizeUnitId');
          }}
          sizeError={sizeError}
          unit={sizeUnitField.value}
          onUnitChange={sizeUnitField.onChange}
          onUnitSelected={(unitId, unitName, pickedType, unitSymbol) => {
            setValue('sizeUnitType', pickedType ?? null);
            setValue('sizeUnitId', unitId, {
              shouldDirty: true,
              shouldValidate: unitId !== null,
            });
            const shown = unitSymbol ?? unitName;
            if (shown) setValue('sizeUnitDisplay', shown);
          }}
          unitError={sizeUnitError}
          sizeTestID={barcodeTestIDs.scanAmountSize}
          unitTestID={barcodeTestIDs.scanAmountSizeUnit}
        />
      ) : null}
      {action}
    </Card>
  );
};

const styles = StyleSheet.create(theme => ({
  summaryCard: {
    gap: theme.spacing.md,
  },
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  summaryText: {
    flex: 1,
    gap: theme.spacing.xs,
  },
  editor: {
    gap: theme.spacing.md,
  },
}));
