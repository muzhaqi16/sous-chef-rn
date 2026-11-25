import React, { useState } from 'react';
import { View } from 'react-native';
import {
  Controller,
  useController,
  useForm,
  type Control,
} from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { date, object, string, type ObjectSchema } from 'yup';
import { useTranslation } from '#i18n';
import { StyleSheet } from 'react-native-unistyles';
import { FractionInput } from '#components/molecules/FractionInput';
import { FormInput } from '#components/atoms/FormInput';
import { Link } from '#components/atoms/Link';
import { DatePickerField } from '#components/molecules/DatePickerField';
import { ConversionPreview } from '#features/pantry/components/ConversionPreview';
import { FractionQuickSelect } from '#features/pantry/components/FractionQuickSelect';
import { PackageContentsFields } from '#features/pantry/ui/PackageContentsFields';
import {
  isPickedWhenSized,
  isWholeWhenSized,
  packageContentsFields,
} from '#features/pantry/ui/packageContentsRules';
import { pantryTestIDs } from '#features/pantry/testIDs';
import { parseFractionalInput } from '#utils/fractionUtils';
import {
  formatQuantityForInput,
  formatQuantityWithUnit,
} from '#utils/formatQuantity';
import { useConversionPreview } from '#features/pantry/hooks/useConversionPreview';
import { actionConversionOptions } from '#features/pantry/hooks/useQuantityFeedback';
import { inCountedUnit } from '#entities/pantryItem/stockDisplay';
import {
  restockContentsOf,
  statedContents,
  type PackageContentsValues,
  type RestockContents,
} from '#domain/stockAmount';
import { UnitType } from '#graphql/generated/schemaTypes';
import { commonStyles } from '#styles/commonStyles';
import { PantryOperation } from '#features/pantry/hooks/useOperationUnits';
import {
  PantryActionHeader,
  PantryActionModal,
} from '#features/pantry/components/modals/PantryActionModal';
import { Text } from '#components/atoms/Text';
import { localizeNumericHint } from '#utils/formatters/number';
import {
  lazyMessage,
  optionalMoneyRule,
  parseMoneyInput,
  quantityRule,
  reportValidationErrors,
} from '#utils/validation/common';
import { useBudgetAndPricesEnabled } from '#hooks/settings/useBudgetAndPricesEnabled';
import type {
  PantryActionSharedState,
  ShownQuantity,
} from '#features/pantry/types';
import { useSheetUnsavedInput } from '#components/templates/SheetCloseGuard';

interface RestockPantryItemModalProps {
  visible: boolean;
  pantryItemId: string | null;
  /** Why the amount is asked, shown on its field until it is edited. */
  reason?: string;
  onClose: () => void;
  onConfirm: (
    quantity: number,
    quantityInput: string,
    notes: string,
    unitId?: string,
    costPerUnit?: number,
    totalCost?: number,
    expiresAt?: Date | null,
    contents?: RestockContents | null,
  ) => Promise<string | null>;
}

interface RestockFormValues extends Omit<PackageContentsValues, 'unitType'> {
  quantityInput: string;
  costPerUnitInput: string;
  totalCostInput: string;
  expiresAt: Date | null;
  notes: string;
}

/** What the schema reads beyond the form (`useForm`'s `context`). */
interface RestockFormContext {
  /** The restock counts the stack's own packages, so it may state their size. */
  countsPackages: boolean;
}

const restockDefaults: RestockFormValues = {
  quantityInput: '1',
  costPerUnitInput: '',
  totalCostInput: '',
  expiresAt: null,
  notes: '',
  sizeInput: '',
  sizeUnitDisplay: '',
  sizeUnitId: null,
  sizeUnitType: null,
};

// A size is read only while the stack's own packages are counted: another
// unit hides its fields, and what they hold is neither checked nor sent.
const restockSchema: ObjectSchema<RestockFormValues> = object({
  quantityInput: quantityRule('errors.invalidQuantity').when(
    '$countsPackages',
    ([countsPackages], schema) =>
      countsPackages === true
        ? schema.test(
            'whole-packages',
            lazyMessage('packageSize.wholePackages'),
            (value, context: { parent: RestockFormValues }) =>
              isWholeWhenSized(value, UnitType.Count, context.parent.sizeInput),
          )
        : schema,
  ),
  // Hidden with budget & prices off, so left blank: they never block.
  costPerUnitInput: optionalMoneyRule('errors.invalidAmountPaid'),
  totalCostInput: optionalMoneyRule('errors.invalidAmountPaid'),
  expiresAt: date().nullable().defined(),
  notes: string().defined(),
  ...packageContentsFields,
  sizeInput: string()
    .defined()
    .when('$countsPackages', ([countsPackages], schema) =>
      countsPackages === true ? packageContentsFields.sizeInput : schema,
    ),
  sizeUnitId: string()
    .nullable()
    .defined()
    .when('$countsPackages', ([countsPackages], schema) =>
      countsPackages === true
        ? schema.test(
            'size-unit-picked',
            lazyMessage('packageSize.unitRequired'),
            (value, context: { parent: RestockFormValues }) =>
              isPickedWhenSized(
                value,
                UnitType.Count,
                context.parent.sizeInput,
              ),
          )
        : schema,
    ),
});

/** The server sizes only packages counted in the stack's own unit. */
const countedInOwnUnit = ({ selectedUnitInfo }: PantryActionSharedState) =>
  selectedUnitInfo?.isTrackingUnit === true &&
  selectedUnitInfo.unitType === UnitType.Count;

export const RestockPantryItemModal: React.FC<RestockPantryItemModalProps> = ({
  visible,
  pantryItemId,
  reason,
  onClose,
  onConfirm,
}) => {
  const { t } = useTranslation();
  return (
    <PantryActionModal
      visible={visible}
      pantryItemId={pantryItemId}
      onClose={onClose}
      snapPoints={['80%', '95%']}
      unitToggleLabel={t('restockItem.restockBy')}
      currentQuantityLabel={t('restockItem.currentLabel')}
      operation={PantryOperation.Restock}
      renderForm={(shared, pantryItem) => (
        <RestockForm
          shared={shared}
          ready={!!pantryItem}
          reason={reason}
          onClose={onClose}
          onConfirm={onConfirm}
        />
      )}
    />
  );
};

interface RestockFormProps {
  shared: PantryActionSharedState;
  /** The stack is read, so there is something to restock. */
  ready: boolean;
  reason: string | undefined;
  onClose: () => void;
  onConfirm: RestockPantryItemModalProps['onConfirm'];
}

const RestockForm: React.FC<RestockFormProps> = ({
  shared,
  ready,
  reason,
  onClose,
  onConfirm,
}) => {
  const { t } = useTranslation();
  const asksCost = useBudgetAndPricesEnabled();
  const [askingSize, setAskingSize] = useState(false);
  const countsPackages = countedInOwnUnit(shared);
  const {
    control,
    handleSubmit,
    setError,
    formState: { isDirty },
  } = useForm<RestockFormValues, RestockFormContext>({
    resolver: yupResolver(restockSchema),
    defaultValues: restockDefaults,
    context: { countsPackages },
  });
  useSheetUnsavedInput(isDirty);

  const submit = handleSubmit(async values => {
    const quantity = parseFractionalInput(values.quantityInput);
    if (quantity === null) return;
    const { sizeInput, sizeUnitDisplay, sizeUnitId, sizeUnitType } = values;
    const contents = countsPackages
      ? statedContents({
          sizeInput,
          sizeUnitDisplay,
          sizeUnitId,
          sizeUnitType,
          unitType: UnitType.Count,
        })
      : null;
    // Off, the cost fields are hidden: they send nothing.
    const paid = (input: string) =>
      asksCost ? parseMoneyInput(input) ?? undefined : undefined;
    // Pass the quantity and unit directly — the backend handles conversion
    const answer = onConfirm(
      quantity,
      values.quantityInput,
      values.notes,
      shared.activeUnitId,
      paid(values.costPerUnitInput),
      paid(values.totalCostInput),
      values.expiresAt,
      contents && restockContentsOf(contents, shared.portionUnitId),
    );
    if (!contents) {
      onClose();
      await answer;
      return;
    }
    // The sheet closes on success; a refusal stays to say why on the field.
    const refusal = await answer;
    if (refusal !== null) {
      setError('sizeInput', { type: 'server', message: refusal });
    }
  }, reportValidationErrors);

  return (
    <>
      <PantryActionHeader
        title={t('restockItem.title')}
        confirmLabel={t('labels.restock')}
        onClose={onClose}
        onConfirm={ready ? () => submit() : null}
      />
      {ready ? (
        <RestockFields
          control={control}
          shared={shared}
          reason={reason}
          asksCost={asksCost}
          askingSize={askingSize}
          onAskSize={() => setAskingSize(true)}
        />
      ) : null}
    </>
  );
};

const RestockFields: React.FC<{
  control: Control<RestockFormValues, RestockFormContext>;
  shared: PantryActionSharedState;
  reason: string | undefined;
  asksCost: boolean;
  askingSize: boolean;
  onAskSize: () => void;
}> = ({ control, shared, reason, asksCost, askingSize, onAskSize }) => {
  const { t } = useTranslation();
  const { field: amount, fieldState: amountState } = useController({
    control,
    name: 'quantityInput',
  });
  const addAmount = parseFractionalInput(amount.value);

  // For dual-tracked items, show conversion to net weight unit (e.g. cups → grams)
  const conversion = useConversionPreview(
    actionConversionOptions(addAmount, shared),
  );

  // The new total reads as the row will, whatever unit it was typed in. With no
  // package size to count by, it stays in the unit the amount converted to.
  let newQuantity: ShownQuantity | null = null;
  if (addAmount !== null && !isNaN(addAmount)) {
    const converted = conversion.convertedValue;
    const inUnit = (quantity: number, unit: ShownQuantity['unit']) => ({
      quantity,
      unit,
      displayAsFraction: null,
    });
    if (shared.exactFactor !== null) {
      // The tracking unit or a dozen of it: no conversion.
      newQuantity = shared.leftAfter(
        -inCountedUnit(addAmount, shared.exactFactor),
      );
    } else if (!shared.isConvertedUnit) {
      newQuantity = shared.leftAfter(-addAmount);
    } else if (shared.isDualTracked) {
      const added =
        converted == null ? null : shared.packagesOfNetWeight(converted);
      if (added !== null) {
        newQuantity = shared.leftAfter(-added);
      } else if (
        converted != null &&
        shared.remainingNetWeight != null &&
        shared.netWeightUnit !== undefined
      ) {
        newQuantity = inUnit(
          shared.remainingNetWeight + converted,
          shared.netWeightUnit,
        );
      }
    } else if (shared.availableInSelectedUnit) {
      // What is available was converted from the tracking quantity.
      newQuantity = shared.leftAfter(
        -(addAmount / shared.availableInSelectedUnit) * shared.trackingQuantity,
      );
    } else if (shared.availableInSelectedUnit === 0) {
      newQuantity = inUnit(addAmount, shared.activeUnit);
    }
  }

  return (
    <>
      {/* Quantity Input */}
      <View style={commonStyles.bottomSheetSection}>
        <FractionInput
          label={t('restockItem.quantityToAdd')}
          value={amount.value}
          onChangeText={amount.onChange}
          placeholder={localizeNumericHint(t('labels.eG1114Or15'))}
          required
          error={
            amountState.error?.message ??
            (amountState.isDirty ? undefined : reason)
          }
        />
        {newQuantity !== null || shared.isConvertedUnit ? (
          <View style={commonStyles.bottomSheetInfoRow}>
            {newQuantity !== null ? (
              <Text role="label" tone="accent" style={styles.newQuantityText}>
                {t('restockItem.newQuantityPrefix')}
                {formatQuantityWithUnit(newQuantity.quantity, newQuantity.unit)}
              </Text>
            ) : null}
            {shared.isConvertedUnit ? (
              <ConversionPreview
                previewText={conversion.previewText}
                loading={conversion.previewLoading}
                confidence={conversion.confidence}
              />
            ) : null}
          </View>
        ) : null}
        {shared.commonFractions != null && shared.commonFractions.length > 0 ? (
          <FractionQuickSelect
            fractions={shared.commonFractions}
            onSelect={value => amount.onChange(formatQuantityForInput(value))}
            selectedValue={addAmount ?? undefined}
            unit={shared.activeUnit}
            displayAsFraction
          />
        ) : null}
      </View>

      {countedInOwnUnit(shared) ? (
        <View style={commonStyles.bottomSheetSection}>
          {askingSize ? (
            <SizeFields control={control} />
          ) : (
            <Link
              testID={pantryTestIDs.restockDifferentSize}
              onPress={onAskSize}
            >
              {t('restockItem.differentSize')}
            </Link>
          )}
        </View>
      ) : null}

      {/* Cost Tracking */}
      {asksCost ? (
        <View style={commonStyles.bottomSheetSection}>
          <View style={styles.costRow}>
            <View style={styles.costField}>
              <Controller
                control={control}
                name="costPerUnitInput"
                render={({ field, fieldState }) => (
                  <FormInput
                    label={t('restockItem.costPerUnit')}
                    value={field.value}
                    onChangeText={field.onChange}
                    placeholder={localizeNumericHint('0.00')}
                    keyboardType="decimal-pad"
                    error={fieldState.error?.message}
                  />
                )}
              />
            </View>
            <View style={styles.costField}>
              <Controller
                control={control}
                name="totalCostInput"
                render={({ field, fieldState }) => (
                  <FormInput
                    label={t('labels.totalPaid')}
                    value={field.value}
                    onChangeText={field.onChange}
                    placeholder={localizeNumericHint('0.00')}
                    keyboardType="decimal-pad"
                    error={fieldState.error?.message}
                  />
                )}
              />
            </View>
          </View>
        </View>
      ) : null}

      {/* Notes */}
      <View style={commonStyles.bottomSheetSection}>
        <Controller
          control={control}
          name="notes"
          render={({ field }) => (
            <FormInput
              label={t('labels.notes')}
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              placeholder={t('restockItem.notesPlaceholder')}
              multiline
              numberOfLines={3}
            />
          )}
        />
      </View>

      {/* Expiration Date */}
      <View style={commonStyles.bottomSheetSection}>
        <Controller
          control={control}
          name="expiresAt"
          render={({ field }) => (
            <DatePickerField
              label={t('labels.expirationDate')}
              value={field.value}
              onChange={field.onChange}
              placeholder={t('instructions.expiryOptional')}
              minimumDate={new Date()}
            />
          )}
        />
      </View>
    </>
  );
};

/** What each new package holds, for a restock in packages of another size. */
const SizeFields: React.FC<{
  control: Control<RestockFormValues, RestockFormContext>;
}> = ({ control }) => {
  // The whole-packages and unit rules read the size; a change to the size or
  // its unit also answers a refusal of it.
  const { field: size, fieldState: sizeState } = useController({
    control,
    name: 'sizeInput',
    rules: { deps: ['quantityInput', 'sizeUnitId'] },
  });
  const { field: sizeUnitDisplay } = useController({
    control,
    name: 'sizeUnitDisplay',
    rules: { deps: ['sizeInput'] },
  });
  const { field: sizeUnitId, fieldState: sizeUnitState } = useController({
    control,
    name: 'sizeUnitId',
    rules: { deps: ['sizeInput'] },
  });
  const { field: sizeUnitType } = useController({
    control,
    name: 'sizeUnitType',
  });

  return (
    <PackageContentsFields
      variant="modal"
      size={size.value}
      onSizeChange={size.onChange}
      sizeError={sizeState.error?.message}
      unit={sizeUnitDisplay.value}
      onUnitChange={sizeUnitDisplay.onChange}
      onUnitSelected={(unitId, _name, unitType = null) => {
        sizeUnitId.onChange(unitId);
        sizeUnitType.onChange(unitType);
      }}
      unitError={sizeUnitState.error?.message}
    />
  );
};

const styles = StyleSheet.create(theme => ({
  costRow: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  costField: {
    flex: 1,
  },
  // The row already spaces its children; a top margin here doubles the gap.
  newQuantityText: {
    marginTop: 0,
  },
}));
