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
import { BaseSwitch } from '#components/atoms/BaseSwitch';
import { Card } from '#components/atoms/Card';
import { FieldRow } from '#components/atoms/FieldRow';
import { FormInput } from '#components/atoms/FormInput';
import { Icon } from '#components/atoms/Icon';
import { Text } from '#components/atoms/Text';
import { FractionInput } from '#components/molecules/FractionInput';
import { UnitAutocompleteField } from '#features/catalog/ui/autocomplete/UnitAutocompleteField';
import { barcodeTestIDs } from '#features/barcode/testIDs';
import {
  formatQuantityWithUnit,
  type QuantityDisplayOptions,
} from '#utils/formatQuantity';
import { parseFractionalInput } from '#/utils/fractionUtils';
import { parseDecimalInput } from '#/utils/parseDecimalInput';
import { localizeNumericHint } from '#/utils/formatters/number';
import type { ScanAmountFormValues } from './scanAmountFormConfig';

interface ScanAmountSectionProps {
  form: UseFormReturn<ScanAmountFormValues>;
  /** The fields show once opened; until then the summary stands for them. */
  editing: boolean;
  onEdit: () => void;
}

const AS_DECIMAL: QuantityDisplayOptions = { notation: 'decimal' };

/** What a pantry add from a scan records, read as text and opened to edit. */
export const ScanAmountSection: React.FC<ScanAmountSectionProps> = ({
  form,
  editing,
  onEdit,
}) => {
  const { t } = useTranslation();
  const { control, setValue, trigger } = form;
  const [packaged, quantityInput, unitDisplay, sizeInput, sizeUnitDisplay] =
    useWatch({
      control,
      name: [
        'packaged',
        'quantityInput',
        'unitDisplay',
        'sizeInput',
        'sizeUnitDisplay',
      ],
    });
  const { fieldState: unitState } = useController({ control, name: 'unitId' });
  const { fieldState: sizeUnitState } = useController({
    control,
    name: 'sizeUnitId',
  });

  const amount = formatQuantityWithUnit(
    parseFractionalInput(quantityInput),
    unitDisplay,
  );
  const size =
    packaged && sizeInput.trim()
      ? formatQuantityWithUnit(
          parseDecimalInput(sizeInput),
          sizeUnitDisplay,
          AS_DECIMAL,
        )
      : null;
  const summary = size
    ? t('barcode.amount.eachPackage', { amount, size })
    : amount;

  if (!editing) {
    return (
      <Card>
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
              label={packaged ? t('labels.package') : t('labels.unit')}
              required
              value={field.value}
              onChangeText={field.onChange}
              onUnitSelected={(unitId, unitName, unitType, unitSymbol) => {
                // Typing clears the pick on every keystroke; only a pick is
                // checked here, so the error waits for a submit without one.
                setValue('unitType', unitType ?? null);
                setValue('unitId', unitId, { shouldValidate: unitId !== null });
                const shown = unitSymbol ?? unitName;
                if (shown) setValue('unitDisplay', shown);
              }}
              error={unitState.error?.message}
              placeholder={t('labels.pcsDozen')}
            />
          )}
        />
      </FieldRow>

      <View style={styles.switchRow}>
        <View style={styles.switchText}>
          <Text role="body">{t('barcode.amount.packaged')}</Text>
          <Text role="caption" tone="secondary">
            {t('barcode.amount.packagedHint')}
          </Text>
        </View>
        <Controller
          control={control}
          name="packaged"
          render={({ field }) => (
            <BaseSwitch
              value={field.value}
              onValueChange={value => {
                field.onChange(value);
                // The count and unit rules hold only for packages.
                void trigger(['quantityInput', 'unitId', 'sizeUnitId']);
              }}
              accessibilityLabel={t('barcode.amount.packaged')}
              testID={barcodeTestIDs.scanAmountPackaged}
            />
          )}
        />
      </View>

      {packaged ? (
        <FieldRow>
          <Controller
            control={control}
            name="sizeInput"
            render={({ field, fieldState }) => (
              <FormInput
                label={t('barcode.amount.sizeLabel')}
                value={field.value}
                onChangeText={field.onChange}
                error={fieldState.error?.message}
                placeholder={localizeNumericHint(t('labels.eG145'))}
                keyboardType="decimal-pad"
                testID={barcodeTestIDs.scanAmountSize}
              />
            )}
          />
          <Controller
            control={control}
            name="sizeUnitDisplay"
            render={({ field }) => (
              <UnitAutocompleteField
                variant="modal"
                label={t('labels.unit')}
                value={field.value}
                onChangeText={field.onChange}
                onUnitSelected={(unitId, unitName, _unitType, unitSymbol) => {
                  setValue('sizeUnitId', unitId, {
                    shouldDirty: true,
                    shouldValidate: unitId !== null,
                  });
                  const shown = unitSymbol ?? unitName;
                  if (shown) setValue('sizeUnitDisplay', shown);
                }}
                error={sizeUnitState.error?.message}
                placeholder={t('labels.ozGMl')}
              />
            )}
          />
        </FieldRow>
      ) : null}
    </Card>
  );
};

const styles = StyleSheet.create(theme => ({
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
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  switchText: {
    flex: 1,
    gap: theme.spacing.xs,
  },
}));
