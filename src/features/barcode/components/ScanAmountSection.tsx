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
  /** Whether the add creates a stack, which alone takes a consume unit here. */
  createsStack: boolean;
  /**
   * The held stack the add joins while it is in that stack's unit, read as its
   * row reads it. In another unit the server may open a stack of its own.
   */
  joins?: { amount: string; unitId: string } | null;
}

const AS_DECIMAL: QuantityDisplayOptions = { notation: 'decimal' };

/** What a pantry add from a scan records, read as text and opened to edit. */
export const ScanAmountSection: React.FC<ScanAmountSectionProps> = ({
  form,
  editing,
  onEdit,
  createsStack,
  joins,
}) => {
  const { t } = useTranslation();
  const { control, setValue, trigger } = form;
  const [
    packaged,
    quantityInput,
    unitDisplay,
    sizeInput,
    sizeUnitDisplay,
    consumeUnitDisplay,
    packageUnitId,
  ] = useWatch({
    control,
    name: [
      'packaged',
      'quantityInput',
      'unitDisplay',
      'sizeInput',
      'sizeUnitDisplay',
      'consumeUnitDisplay',
      'unitId',
    ],
  });
  const { fieldState: unitState } = useController({ control, name: 'unitId' });
  const { fieldState: sizeUnitState } = useController({
    control,
    name: 'sizeUnitId',
  });
  const { fieldState: consumeUnitState } = useController({
    control,
    name: 'consumeUnitId',
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
  const stated = size
    ? t('barcode.amount.eachPackage', { amount, size })
    : amount;
  // A held product joins its stack: the summary says so ("Adds 1 can to your 2 cans").
  const summary =
    joins && joins.unitId === packageUnitId
      ? t('barcode.amount.joinsHeld', { amount: stated, held: joins.amount })
      : stated;
  const usedIn =
    createsStack && consumeUnitDisplay.trim()
      ? t('barcode.amount.usedInSummary', { unit: consumeUnitDisplay.trim() })
      : null;

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
            {usedIn ? (
              <Text role="body" tone="secondary">
                {usedIn}
              </Text>
            ) : null}
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
              testID={barcodeTestIDs.scanAmountUnit}
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
                onChangeText={text => {
                  field.onChange(text);
                  // Only a size asks for its unit, so clearing it clears that
                  // error; re-checked only once shown, never mid-typing.
                  if (sizeUnitState.error) void trigger('sizeUnitId');
                }}
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

      {createsStack ? (
        <View style={styles.usedIn}>
          <Controller
            control={control}
            name="consumeUnitDisplay"
            render={({ field }) => (
              <UnitAutocompleteField
                variant="modal"
                label={t('labels.usedIn')}
                value={field.value}
                onChangeText={text => {
                  field.onChange(text);
                  // Clearing it clears the unpicked-unit error.
                  if (!text.trim() && consumeUnitState.error) {
                    void trigger('consumeUnitId');
                  }
                }}
                onUnitSelected={(unitId, unitName, _unitType, unitSymbol) => {
                  setValue('consumeUnitId', unitId, {
                    shouldDirty: true,
                    shouldValidate: unitId !== null,
                  });
                  const shown = unitSymbol ?? unitName;
                  if (shown) setValue('consumeUnitDisplay', shown);
                }}
                error={consumeUnitState.error?.message}
                placeholder={t('labels.tbspCup')}
                testID={barcodeTestIDs.scanAmountUsedIn}
              />
            )}
          />
          <Text role="caption" tone="secondary">
            {t('labels.usedInHint')}
          </Text>
        </View>
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
  usedIn: {
    gap: theme.spacing.xs,
  },
}));
