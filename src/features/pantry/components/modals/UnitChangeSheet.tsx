import React, { useState } from 'react';
import { View } from 'react-native';
import { Controller, useForm, useWatch, type Resolver } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { StyleSheet } from 'react-native-unistyles';
import { isTranslationKey, useTranslation } from '#/i18n';
import { Sheet } from '#components/templates/Sheet';
import { PantryUnitChangeMethod } from '#/graphql/generated/schemaTypes';
import { SheetHeader } from '#components/templates/SheetHeader';
import { AlertBanner } from '#components/molecules/AlertBanner';
import { FractionInput } from '#components/molecules/FractionInput';
import { FormInput } from '#components/atoms/FormInput';
import { AppPressable } from '#components/atoms/AppPressable';
import { Text } from '#components/atoms/Text';
import { Icon } from '#utils/iconUtils';
import { UnitAutocompleteField } from '#features/catalog/ui/autocomplete/UnitAutocompleteField';
import { errorService } from '#/services/errorService';
import {
  formatQuantityForDisplay,
  formatQuantityForInput,
  resolveQuantityNotation,
} from '#/utils/formatQuantity';
import { localizeNumericHint } from '#/utils/formatters/number';
import { logValidationErrors } from '#/utils/validation/common';
import {
  usePantryUnitChange,
  type UnitChangePreview,
  type UnitChangeRequest,
} from '#features/pantry/hooks/usePantryUnitChange';
import { pantryTestIDs } from '#features/pantry/testIDs';
import {
  AMOUNT_CHOICES,
  changeChoice,
  packageSizeOf,
  unitChangeDefaults,
  unitChangeMode,
  unitChangeSchema,
  type AmountChoice,
  type UnitChangeFormValues,
} from './unitChangeFormConfig';

interface UnitChangeSheetProps {
  pantryItemId: string;
  unitId: string;
  /** The amount the form holds in the new unit; previewed as the recount. */
  typedQuantity: number | null;
  /** The preview the form already ran, so the sheet opens with an answer. */
  initialPreview: UnitChangePreview;
  onClose: () => void;
  onChanged: () => void;
}

type PreviewUnit = UnitChangePreview['toUnit'];

const amountText = (quantity: number | null | undefined, unit: PreviewUnit) =>
  `${formatQuantityForDisplay(quantity, {
    notation: resolveQuantityNotation(null, unit.displayAsFraction),
  })} ${unit.symbol}`;

/** Shows what a unit change does to the stock, and asks what it needs. */
export const UnitChangeSheet: React.FC<UnitChangeSheetProps> = ({
  pantryItemId,
  unitId,
  typedQuantity,
  initialPreview,
  onClose,
  onChanged,
}) => {
  const { t } = useTranslation();
  const { preview: requestPreview, change } = usePantryUnitChange();
  const [preview, setPreview] = useState(initialPreview);
  const [packageSize, setPackageSize] =
    useState<UnitChangeRequest['packageSize']>(undefined);
  const [notice, setNotice] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const mode = unitChangeMode(preview);
  const { fromUnit, toUnit } = preview;

  const { control, handleSubmit, setValue } = useForm<UnitChangeFormValues>({
    resolver: yupResolver(unitChangeSchema) as Resolver<UnitChangeFormValues>,
    defaultValues: unitChangeDefaults(formatQuantityForInput(typedQuantity)),
    context: { mode },
  });
  const choice = useWatch({ control, name: 'choice' });

  const rePreview = async (
    nextPackageSize: UnitChangeRequest['packageSize'],
  ) => {
    setIsBusy(true);
    const outcome = await requestPreview({
      pantryItemId,
      unitId,
      quantity: typedQuantity ?? undefined,
      packageSize: nextPackageSize,
    });
    setIsBusy(false);
    if (outcome.status === 'ready') {
      setPreview(outcome.preview);
      setPackageSize(nextPackageSize);
      return;
    }
    setFailure(
      t(
        outcome.status === 'offline'
          ? 'unitChange.needsConnection'
          : 'unitChange.previewFailed',
      ),
    );
  };

  const onValid = async (values: UnitChangeFormValues) => {
    setFailure(null);
    setNotice(null);
    if (mode === 'packageSize') {
      await rePreview(packageSizeOf(values));
      return;
    }
    setIsBusy(true);
    const outcome = await change({
      pantryItemId,
      unitId,
      version: preview.version,
      packageSize,
      ...changeChoice(mode, preview, values, typedQuantity),
    });
    setIsBusy(false);
    if (outcome.status === 'changed') {
      onChanged();
      return;
    }
    if (outcome.status === 'conflict') {
      setNotice(t('unitChange.changedMeanwhile'));
      await rePreview(packageSize);
      return;
    }
    setFailure(outcome.message);
  };
  const submit = () => {
    void handleSubmit(onValid, logValidationErrors)();
  };

  const refusalText = () => {
    if (preview.conflictingPantryItemId) {
      return t('unitChange.conflicting', { unit: toUnit.symbol });
    }
    const field = preview.refusal?.field;
    const fieldKey = `errors.field.${field ?? ''}`;
    if (field && isTranslationKey(fieldKey)) return t(fieldKey);
    return errorService.getUserFriendlyMessage(
      preview.refusal?.code ?? '',
      t('unitChange.failed'),
    );
  };

  const choose = (next: AmountChoice) => {
    setValue('choice', next);
  };

  const amountInput = (
    <Controller
      control={control}
      name="amount"
      render={({ field, fieldState }) => (
        <FractionInput
          label={t('unitChange.amountLabel', { unit: toUnit.symbol })}
          value={field.value}
          onChangeText={field.onChange}
          error={fieldState.error?.message}
          useBottomSheetInput
          testID={pantryTestIDs.unitChangeAmount}
        />
      )}
    />
  );

  return (
    <Sheet mode="form" visible onDismiss={onClose} snapPoints={['70%', '92%']}>
      <SheetHeader
        title={t('unitChange.title')}
        onClose={onClose}
        confirm={
          mode === 'refused'
            ? undefined
            : {
                onPress: submit,
                accessibilityLabel: t(
                  mode === 'packageSize'
                    ? 'unitChange.check'
                    : 'unitChange.title',
                ),
                loading: isBusy,
                testID: pantryTestIDs.unitChangeConfirm,
              }
        }
      />
      <View style={styles.content}>
        {!!notice && <AlertBanner variant="info" title={notice} />}

        {mode === 'refused' && (
          <AlertBanner variant="error" title={refusalText()} />
        )}

        {mode === 'packageSize' && (
          <>
            <Text role="bodyStrong">
              {t('unitChange.packageSizeTitle', { unit: toUnit.symbol })}
            </Text>
            <Controller
              control={control}
              name="packageAmount"
              render={({ field, fieldState }) => (
                <FormInput
                  label={t('unitChange.packageSizeLabel', {
                    unit: toUnit.symbol,
                  })}
                  value={field.value}
                  onChangeText={field.onChange}
                  error={fieldState.error?.message}
                  placeholder={localizeNumericHint(t('labels.eG145'))}
                  keyboardType="decimal-pad"
                  useBottomSheetInput
                />
              )}
            />
            <Controller
              control={control}
              name="packageUnitText"
              render={({ field }) => (
                <UnitAutocompleteField
                  variant="modal"
                  label={t('storageLocationForm.unit')}
                  value={field.value}
                  onChangeText={field.onChange}
                  onUnitSelected={id => {
                    setValue('packageUnitId', id, { shouldValidate: true });
                  }}
                  placeholder={t('labels.ozGMl')}
                />
              )}
            />
          </>
        )}

        {mode === 'recount' && (
          <>
            <Text role="body">
              {t('unitChange.noRoute', {
                from: fromUnit.symbol,
                to: toUnit.symbol,
              })}
            </Text>
            {amountInput}
          </>
        )}

        {mode === 'estimate' && (
          <>
            <Text role="body">
              {t('unitChange.estimateChoice', {
                from: fromUnit.symbol,
                to: toUnit.symbol,
              })}
            </Text>
            {AMOUNT_CHOICES.map(option => (
              <AppPressable
                key={option}
                onPress={() => choose(option)}
                style={styles.option}
                accessibilityRole="radio"
                accessibilityState={{ selected: choice === option }}
              >
                <Icon
                  name={
                    choice === option
                      ? 'radio-button-on'
                      : 'radio-button-off-outline'
                  }
                  size={20}
                  tone={choice === option ? 'primary' : 'textSecondary'}
                />
                <Text role="body" style={styles.optionText}>
                  {option === 'estimate'
                    ? t('unitChange.useEstimate', {
                        amount: amountText(preview.quantityAfter, toUnit),
                      })
                    : t('unitChange.useMyAmount')}
                </Text>
              </AppPressable>
            ))}
            {choice === 'mine' && amountInput}
          </>
        )}

        {mode === 'summary' && (
          <>
            <Text role="heading" testID={pantryTestIDs.unitChangeSummary}>
              {t('unitChange.beforeAfter', {
                before: amountText(preview.quantityBefore, fromUnit),
                after: amountText(preview.quantityAfter, toUnit),
              })}
            </Text>
            {preview.exact !== null && (
              <Text role="caption" tone="secondary">
                {t(preview.exact ? 'unitChange.exact' : 'unitChange.estimate')}
              </Text>
            )}
            {preview.method === PantryUnitChangeMethod.Recount && (
              <Text role="caption" tone="secondary">
                {t('unitChange.recountNote')}
              </Text>
            )}
            {!!preview.quantityIgnored && (
              <AlertBanner
                variant="info"
                title={t('unitChange.quantityIgnored')}
              />
            )}
          </>
        )}

        {mode !== 'refused' && preview.batches.length > 1 && (
          <View style={styles.batches}>
            <Text role="label" tone="secondary">
              {t('unitChange.batches')}
            </Text>
            {preview.batches.map((batch, index) => (
              <Text key={batch.batchId ?? `loose-${index}`} role="body">
                {t('unitChange.beforeAfter', {
                  before: amountText(batch.quantityBefore, fromUnit),
                  after: amountText(batch.quantityAfter, toUnit),
                })}
              </Text>
            ))}
          </View>
        )}

        {mode !== 'refused' && (
          <>
            {!!preview.dropsNetWeight && (
              <AlertBanner
                variant="warning"
                title={t('unitChange.dropsNetWeight')}
              />
            )}
            {!!preview.dropsPortions && (
              <AlertBanner
                variant="warning"
                title={t('unitChange.dropsPortions')}
              />
            )}
            {!!preview.dropsThresholds && (
              <AlertBanner
                variant="warning"
                title={t('unitChange.dropsThresholds')}
              />
            )}
            {!preview.dropsThresholds && preview.minQuantityAfter != null && (
              <Text role="caption" tone="secondary">
                {t('unitChange.alertBelowAfter', {
                  amount: amountText(preview.minQuantityAfter, toUnit),
                })}
              </Text>
            )}
          </>
        )}

        {!!failure && (
          <Text
            role="error"
            tone="error"
            testID={pantryTestIDs.unitChangeError}
          >
            {failure}
          </Text>
        )}
      </View>
    </Sheet>
  );
};

const styles = StyleSheet.create(theme => ({
  content: {
    gap: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.xl,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.sm,
  },
  optionText: {
    flex: 1,
  },
  batches: {
    gap: theme.spacing.xs,
  },
}));
