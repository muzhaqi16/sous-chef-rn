import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useMoney } from '#/domain/money';
import { useTranslation, type TranslationKey } from '#/i18n';
import { DropdownStack } from '#components/atoms/DropdownStack';
import { StyleSheet } from 'react-native-unistyles';
import { BaseSwitch } from '#components/atoms/BaseSwitch';
import { FractionInput } from '#components/molecules/FractionInput';
import { FormInput } from '#components/atoms/FormInput';
import { DatePickerField } from '#components/molecules/DatePickerField';
import { SheetHeader } from '#components/templates/SheetHeader';
import { SheetHeaderSlot } from '#components/templates/SheetHeaderSlot';
import { useOpening } from '#hooks/ui/useOpening';
import { UnitAutocompleteField } from '#features/catalog/ui/autocomplete/UnitAutocompleteField';
import { PackageContentsFields } from '#features/pantry/ui/PackageContentsFields';
import { parseFractionalInput } from '#/utils/fractionUtils';
import {
  formatQuantityForDisplay,
  formatQuantityForInput,
  unitLabel,
} from '#/utils/formatQuantity';
import { Text } from '#components/atoms/Text';
import { StorageState, type UnitType } from '#/graphql/generated/schemaTypes';
import { contentsOf } from '#domain/stockAmount';
import { resolveIntakeDraft, type IntakeField } from '#domain/intakeDraft';
import type { MoveToPantryInput } from '#features/shoppingList/hooks/useMoveToPantry';
import { useMoveToPantryItem } from '#features/shoppingList/components/moveToPantry/useMoveToPantryItem';
import { useResolveUnit } from '#features/catalog/hooks/useResolveUnit';
import { PantrySelector } from './PantrySelector';
import { StorageStateControl } from './StorageStateControl';
import { parseDecimalInput } from '#/utils/parseDecimalInput';
import {
  formatNumberForInput,
  localizeNumericHint,
} from '#/utils/formatters/number';
import {
  shownUnitPrice,
  totalFromUnitPrice,
} from '#features/shoppingList/utils/purchasePrice';
import { PerUnitHint } from '#features/shoppingList/components/PerUnitHint';
import { Sheet } from '#components/templates/Sheet';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import {
  reportValidationErrors,
  parseMoneyInput,
} from '#/utils/validation/common';
import { isOwnKey } from '#utils/isOwnKey';
import {
  moveToPantryDefaults,
  moveToPantrySchema,
  statesPackagesAsSize,
  type MoveToPantryFormValues,
} from './moveToPantryFormConfig';
import { toDateKey } from '#/utils/dateUtils';
import type { MoveTarget } from '#features/shoppingList/utils/moveTargets';
import { shoppingListTestIDs } from '#features/shoppingList/testIDs';

interface MoveToPantryModalProps {
  visible: boolean;
  shoppingListItemId: string | null;
  pantries: readonly MoveTarget[];
  /** Stands in for the pantry choice when the read behind it failed. */
  pantriesUnavailable?: React.ReactNode;
  selectedPantryId: string | null;
  onClose: () => void;
  /** Resolves true once the move is applied or queued; a refusal keeps the sheet open. */
  onConfirm: (input: MoveToPantryInput) => Promise<boolean>;
  /** Server unreachable (offline / API down) — disables the confirm action. */
  confirmDisabled?: boolean;
  /** False leaves out the amount paid, and the move records no price. */
  askPrice?: boolean;
}

/** The field stating a fact the amount still lacks, and what it says. */
function missingFactField(
  missing: IntakeField,
  statedTheOtherWay: boolean,
): {
  field: 'unitValue' | 'quantityInput' | 'packageSizeInput';
  key: TranslationKey;
} {
  switch (missing) {
    case 'unit':
      return { field: 'unitValue', key: 'moveToPantry.selectUnitError' };
    case 'quantity':
      // Stated the other way round, the package count is in the size's field.
      return {
        field: statedTheOtherWay ? 'packageSizeInput' : 'quantityInput',
        key: 'errors.invalidQuantity',
      };
    case 'packageSize':
      return {
        field: statedTheOtherWay ? 'quantityInput' : 'packageSizeInput',
        key: 'errors.field.netWeight',
      };
  }
}

type MoveItem = ReturnType<typeof useMoveToPantryItem>;

type MoveToPantryFormProps = Omit<
  MoveToPantryModalProps,
  'visible' | 'shoppingListItemId'
> & {
  moveItem: MoveItem & {
    shoppingListItem: NonNullable<MoveItem['shoppingListItem']>;
  };
};

/**
 * One opening, seeded from the line and what was bought; amounts that land
 * after it opens are seeded then, never over something typed.
 */
const MoveToPantryForm: React.FC<MoveToPantryFormProps> = ({
  moveItem,
  pantries,
  pantriesUnavailable,
  selectedPantryId,
  onClose,
  onConfirm,
  confirmDisabled = false,
  askPrice = true,
}) => {
  const { t } = useTranslation();
  const money = useMoney();

  const {
    shoppingListItem,
    purchasedQuantity,
    purchasedUnitPrice,
    purchasedUnit,
  } = moveItem;

  // What the amounts are seeded from: what was BOUGHT, falling back to what was
  // requested. Prefilling the request is how a line asked for as 1 piece and
  // bought as 5 reached the pantry as 1.
  const seedQuantity = purchasedQuantity ?? shoppingListItem.quantity;

  // ONE source decides both halves. Separate fallback chains let a line with
  // free-text `unitName` show "bag" while submitting the purchase's unit id.
  const resolvedUnit = shoppingListItem.unit
    ? {
        label: unitLabel(shoppingListItem.unit),
        id: shoppingListItem.unit.id,
        type: shoppingListItem.unit.type,
      }
    : shoppingListItem.unitName
    ? { label: shoppingListItem.unitName, id: null, type: null }
    : purchasedUnit
    ? {
        label: purchasedUnit.unitSymbol,
        id: purchasedUnit.unit.id,
        type: purchasedUnit.unit.type,
      }
    : { label: '', id: null, type: null };

  const {
    control,
    handleSubmit,
    setValue,
    getValues,
    trigger,
    getFieldState,
    setError,
    formState: { errors },
  } = useForm<MoveToPantryFormValues>({
    resolver: yupResolver(moveToPantrySchema),
    defaultValues: {
      ...moveToPantryDefaults(StorageState.Ambient),
      quantityInput: formatQuantityForInput(seedQuantity) || '1',
      unitValue: resolvedUnit.label,
      unitId: resolvedUnit.id,
      unitType: resolvedUnit.type,
      pantryId: selectedPantryId,
      actualPriceInput: formatNumberForInput(
        totalFromUnitPrice(purchasedUnitPrice, seedQuantity ?? 1),
      ),
    },
    mode: 'onTouched',
  });

  // `useWatch` rather than `watch`: the latter returns a function the React
  // Compiler cannot memoize safely, which is a lint error here.
  const quantityInput = useWatch({ control, name: 'quantityInput' });
  const actualPriceInput = useWatch({ control, name: 'actualPriceInput' });
  const unitValue = useWatch({ control, name: 'unitValue' });
  const unitId = useWatch({ control, name: 'unitId' });
  const pantryId = useWatch({ control, name: 'pantryId' });
  const expirationDate = useWatch({ control, name: 'expirationDate' });

  // Interaction state, not fields: the per-unit price the total was seeded
  // from, and whether the shopper has typed over either amount, decide which
  // survives an edit (`handleQuantityChange`).
  const [seededUnitPrice, setSeededUnitPrice] = useState(purchasedUnitPrice);
  // The unit that price is per: the line's, else the purchase's.
  const [seededUnit, setSeededUnit] = useState<{
    id: string | null;
    label: string;
  } | null>({ id: resolvedUnit.id, label: resolvedUnit.label });
  const [amountsTouched, setAmountsTouched] = useState(false);
  const [priceTouched, setPriceTouched] = useState(false);

  // `setValue` notifies mounted `Controller` children synchronously, so the
  // seed is accumulated here and applied from an effect — writing it during
  // render updates components that are not rendering.
  const [pendingSeed, setPendingSeed] =
    useState<Partial<MoveToPantryFormValues> | null>(null);
  let seedThisPass: Partial<MoveToPantryFormValues> | null = null;

  // A cold start has no cached purchase, so the amounts can land a beat after
  // the sheet opens. Seed them then too — but never over something typed.
  const seedKey = `${purchasedQuantity ?? ''}|${purchasedUnitPrice ?? ''}|${
    purchasedUnit?.unit.id ?? ''
  }`;
  // The amounts the form opened on are already in its defaults.
  const [prevSeed, setPrevSeed] = useState(seedKey);
  if (seedKey !== prevSeed) {
    setPrevSeed(seedKey);
    // A line with no unit of its own takes the purchase's, which arrives with
    // the amounts rather than with the fragment.
    if (!unitId && purchasedUnit) {
      seedThisPass = {
        unitValue: purchasedUnit.unitSymbol,
        unitId: purchasedUnit.unit.id,
        unitType: purchasedUnit.unit.type,
      };
      setSeededUnit({
        id: purchasedUnit.unit.id,
        label: purchasedUnit.unitSymbol,
      });
    }
    if (!amountsTouched && purchasedQuantity != null) {
      seedThisPass = {
        ...seedThisPass,
        quantityInput: formatQuantityForInput(purchasedQuantity) || '1',
        actualPriceInput: formatNumberForInput(
          totalFromUnitPrice(purchasedUnitPrice, purchasedQuantity),
        ),
      };
      setSeededUnitPrice(purchasedUnitPrice);
    }
  }

  if (seedThisPass) setPendingSeed(seedThisPass);

  useEffect(() => {
    if (!pendingSeed) return;
    for (const field of Object.keys(pendingSeed)) {
      if (isOwnKey(pendingSeed, field)) setValue(field, pendingSeed[field]);
    }
  }, [pendingSeed, setValue]);

  const paidInSeededUnit = (id: string | null, text: string) => {
    if (seededUnit === null) return false;
    if (id !== null) return id === seededUnit.id;
    return seededUnit.id === null && text.trim() === seededUnit.label;
  };

  // A quantity edit holds the PER-UNIT price and re-derives the total (3 of 5
  // at $0.59 records $1.77), but only in the unit it was paid in; in another,
  // the purchase cost what it cost. A total the shopper typed wins.
  const reprice = (quantity: string, id: string | null, unitText: string) => {
    if (priceTouched || seededUnitPrice == null) return;
    if (!paidInSeededUnit(id, unitText)) {
      setValue(
        'actualPriceInput',
        formatNumberForInput(
          totalFromUnitPrice(seededUnitPrice, seedQuantity ?? 1),
        ),
      );
      return;
    }
    const parsed = parseFractionalInput(quantity);
    const usable = parsed !== null && !isNaN(parsed) && parsed > 0;
    setValue(
      'actualPriceInput',
      usable
        ? formatNumberForInput(totalFromUnitPrice(seededUnitPrice, parsed))
        : '',
    );
  };

  const handleQuantityChange = (value: string) => {
    setValue('quantityInput', value);
    // The size's count rule reads the quantity. Re-run only a refusal already
    // shown, so a fix clears it without a half-typed count raising a new one.
    if (getFieldState('packageSizeInput').invalid) {
      void trigger('packageSizeInput');
    }
    setAmountsTouched(true);
    reprice(value, getValues('unitId'), getValues('unitValue'));
  };

  // A unit typed and not picked goes as the unit it names, from the units the
  // device holds as it is typed (`cartoon` names carton), else from the API on
  // confirm. Its text then reads as that unit.
  const { heldUnitFor, resolveUnit } = useResolveUnit();
  // A keystroke drops the pick: the text then names a unit the device holds,
  // or none.
  const pickedOrHeld = (
    picked: string | null,
    pickedType: UnitType | null | undefined,
    text: string,
  ) => {
    const held = picked ? null : heldUnitFor(text);
    return {
      id: picked ?? held?.id ?? null,
      type: pickedType ?? held?.type ?? null,
    };
  };
  const unitNamed = async (text: string, id: string | null) => {
    if (!text.trim()) return null;
    if (!id) return resolveUnit(text);
    const held = heldUnitFor(text);
    return held?.id === id ? held : null;
  };
  const resolveTypedUnits = async () => {
    const values = getValues();
    const unit = await unitNamed(values.unitValue, values.unitId);
    if (unit) {
      setValue('unitId', unit.id);
      setValue('unitType', unit.type);
      setValue('unitValue', unit.label);
      reprice(values.quantityInput, unit.id, unit.label);
    }
    const size = await unitNamed(
      values.packageSizeUnitValue,
      values.packageSizeUnitId,
    );
    if (size) {
      setValue('packageSizeUnitId', size.id);
      setValue('packageSizeUnitType', size.type);
      setValue('packageSizeUnitValue', size.label);
    }
  };

  const handlePriceChange = (value: string) => {
    // Re-run only a refusal already shown, so a fix clears it.
    setValue('actualPriceInput', value, {
      shouldValidate: getFieldState('actualPriceInput').invalid,
    });
    setAmountsTouched(true);
    setPriceTouched(true);
  };

  // The same resolution the fields use, so this cannot render an empty unit.
  const lineUnitLabel = resolvedUnit.label;

  const perUnitPrice = shownUnitPrice(
    parseMoneyInput(actualPriceInput),
    parseFractionalInput(quantityInput),
  );

  // Reaching here means the schema passed, so every field rule has already
  // reported itself ON its own field; what the resolver still finds missing is
  // reported on its field too.
  const [isMoving, setIsMoving] = useState(false);
  const onValid = async (values: MoveToPantryFormValues) => {
    const {
      pantryId: confirmedPantryId,
      quantityInput: confirmedQuantity,
      unitId: confirmedUnitId,
      storageState,
      expirationDate: confirmedExpiry,
      removeFromList,
      actualPriceInput: confirmedPrice,
      notes,
      packageSizeInput,
      packageSizeUnitId,
      packageSizeUnitType,
    } = values;
    const quantityValue = parseFractionalInput(confirmedQuantity);
    if (quantityValue === null) {
      setError('quantityInput', { message: t('errors.invalidQuantity') });
      return;
    }

    // The schema passed, so a stated size carries its unit and goes with a
    // whole count in a counted unit: that many packages of the picked unit,
    // which the server records. Without one, the amount as typed.
    const contents =
      packageSizeInput.trim() && packageSizeUnitId
        ? {
            amount: parseDecimalInput(packageSizeInput),
            unitId: packageSizeUnitId,
            unitType: packageSizeUnitType,
          }
        : null;
    const statedTheOtherWay =
      contents !== null && !!confirmedUnitId && statesPackagesAsSize(values);
    const { packageSize, measurementProfile } = contentsOf(
      statedTheOtherWay ? null : contents,
    );
    const { amount, unresolved } = statedTheOtherWay
      ? resolveIntakeDraft({
          purchased: {
            quantity: contents.amount,
            intent: 'packages',
            packageSize: {
              netWeight: quantityValue,
              netWeightUnitId: confirmedUnitId,
            },
            unitId: contents.unitId,
          },
        })
      : resolveIntakeDraft({
          purchased: {
            quantity: quantityValue,
            intent: contents === null ? 'measured' : 'packages',
            packageSize,
            unitId: confirmedUnitId,
          },
          // A unit typed and not resolved goes as the list line's.
          unitFromRoute: true,
        });
    if (!amount) {
      const [missing = 'quantity'] = unresolved;
      const { field, key } = missingFactField(missing, statedTheOtherWay);
      setError(field, { message: t(key) });
      return;
    }

    // The field asks for the TOTAL paid, as Mark Purchased does; the server
    // records it exactly and derives the unit price.
    const totalPaid = askPrice
      ? parseMoneyInput(confirmedPrice) ?? undefined
      : undefined;

    setIsMoving(true);
    const moved = await onConfirm({
      pantryId: confirmedPantryId ?? '',
      amount,
      measurementProfile,
      storageState,
      expiresOn: confirmedExpiry ? toDateKey(confirmedExpiry) : undefined,
      removeFromList,
      totalCost: totalPaid,
      notes: notes || undefined,
    });
    setIsMoving(false);
    if (moved) onClose();
  };

  return (
    <>
      <SheetHeaderSlot>
        <SheetHeader
          title={t('moveToPantry.title')}
          onClose={onClose}
          confirm={{
            accessibilityLabel: t('moveToPantry.title'),
            onPress: () => {
              void resolveTypedUnits().then(() =>
                handleSubmit(onValid, reportValidationErrors)(),
              );
            },
            disabled: confirmDisabled,
            loading: isMoving,
            testID: shoppingListTestIDs.moveToPantryConfirm,
          }}
        />
      </SheetHeaderSlot>
      {/* Item Info */}
      <View style={styles.itemInfo}>
        <Text role="heading" style={styles.itemName}>
          {shoppingListItem.itemName}
        </Text>
        <Text role="body" tone="secondary">
          {purchasedQuantity != null
            ? t('moveToPantry.purchasedAmount', {
                amount: formatQuantityForDisplay(purchasedQuantity),
                unit: lineUnitLabel,
              })
            : t('moveToPantry.requestedAmount', {
                // A missing or zero requested quantity reads as one.
                amount: formatQuantityForDisplay(
                  (shoppingListItem.quantity ?? 0) || 1,
                ),
                unit: lineUnitLabel,
              })}
        </Text>
      </View>

      {/* Pantry Selector */}
      {pantriesUnavailable}
      <PantrySelector
        pantries={pantries}
        selectedPantryId={pantryId}
        onSelect={id => setValue('pantryId', id, { shouldValidate: true })}
        error={errors.pantryId?.message}
      />

      {/* Quantity and Unit Input */}
      <DropdownStack>
        <View style={styles.section}>
          <View style={styles.quantityUnitRow}>
            <View style={styles.quantityField}>
              <FractionInput
                label={t('labels.quantity')}
                value={quantityInput}
                onChangeText={handleQuantityChange}
                placeholder={t('labels.eG1114')}
                required
                error={errors.quantityInput?.message}
              />
            </View>
            <View style={styles.unitField}>
              <UnitAutocompleteField
                variant="inline"
                label={t('labels.unit')}
                value={unitValue}
                onChangeText={value =>
                  setValue('unitValue', value, { shouldValidate: true })
                }
                placeholder={t('moveToPantry.unitPlaceholder')}
                required
                error={errors.unitValue?.message}
                onUnitSelected={(picked, _name, pickedType) => {
                  const unit = pickedOrHeld(
                    picked,
                    pickedType,
                    getValues('unitValue'),
                  );
                  setValue('unitId', unit.id);
                  setValue('unitType', unit.type);
                  reprice(
                    getValues('quantityInput'),
                    unit.id,
                    getValues('unitValue'),
                  );
                  void trigger('packageSizeInput');
                  // The rule reports on the TEXT while reading the id, and
                  // the field clears the id after writing the text — so
                  // without this the emptied field carries no message.
                  void trigger('unitValue');
                }}
              />
            </View>
          </View>
        </View>

        {/* Package size (Optional) */}
        <View style={styles.section}>
          <Controller
            control={control}
            name="packageSizeInput"
            render={({ field: size, fieldState: sizeState }) => (
              <Controller
                control={control}
                name="packageSizeUnitValue"
                render={({ field: unit, fieldState: unitState }) => (
                  <PackageContentsFields
                    variant="inline"
                    size={size.value}
                    onSizeChange={text => {
                      size.onChange(text);
                      void trigger('packageSizeUnitValue');
                    }}
                    sizeError={sizeState.error?.message}
                    unit={unit.value}
                    onUnitChange={unit.onChange}
                    unitError={unitState.error?.message}
                    unitTestID={shoppingListTestIDs.moveToPantryPackageSizeUnit}
                    onUnitSelected={(picked, _name, pickedType) => {
                      const held = pickedOrHeld(
                        picked,
                        pickedType,
                        getValues('packageSizeUnitValue'),
                      );
                      setValue('packageSizeUnitId', held.id);
                      setValue('packageSizeUnitType', held.type);
                      void trigger('packageSizeUnitValue');
                      // The size's count rule reads the size's unit too.
                      if (getFieldState('packageSizeInput').invalid) {
                        void trigger('packageSizeInput');
                      }
                    }}
                  />
                )}
              />
            )}
          />
          <Text role="caption" tone="secondary" style={styles.perUnitHint}>
            {t('moveToPantry.packageSizeHint')}
          </Text>
        </View>

        {/* Storage State */}
        <Controller
          control={control}
          name="storageState"
          render={({ field }) => (
            <StorageStateControl
              value={field.value}
              onChange={field.onChange}
            />
          )}
        />

        <DatePickerField
          label={t('labels.expirationDate')}
          value={expirationDate ?? null}
          onChange={date => setValue('expirationDate', date ?? undefined)}
          placeholder={t('instructions.expiryOptional')}
          minimumDate={new Date()}
          clearable
        />

        {/* Total paid (Optional) */}
        {askPrice ? (
          <View style={styles.section}>
            <FormInput
              label={t('labels.totalPaid')}
              value={actualPriceInput}
              onChangeText={handlePriceChange}
              placeholder={localizeNumericHint('0.00')}
              keyboardType="decimal-pad"
              error={errors.actualPriceInput?.message}
            />
            {perUnitPrice != null ? (
              <PerUnitHint
                price={money(perUnitPrice)}
                unit={lineUnitLabel}
                style={styles.perUnitHint}
              />
            ) : null}
          </View>
        ) : null}

        {/* Notes (Optional) */}
        <View style={styles.section}>
          <Controller
            control={control}
            name="notes"
            render={({ field }) => (
              <FormInput
                label={t('labels.notesOptional')}
                value={field.value}
                onChangeText={field.onChange}
                placeholder={t('moveToPantry.notesPlaceholder')}
                multiline
                numberOfLines={2}
              />
            )}
          />
        </View>

        {/* Remove from List Toggle */}
        <View style={styles.toggleSection}>
          <View style={styles.toggleInfo}>
            <Text role="bodyStrong">
              {t('moveToPantry.removeFromShopping')}
            </Text>
            <Text
              role="caption"
              tone="secondary"
              style={styles.toggleDescription}
            >
              {t('moveToPantry.removeFromShoppingDesc')}
            </Text>
          </View>
          <Controller
            control={control}
            name="removeFromList"
            render={({ field }) => (
              <BaseSwitch
                accessibilityLabel={t('moveToPantry.removeFromShopping')}
                value={field.value}
                onValueChange={field.onChange}
              />
            )}
          />
        </View>
      </DropdownStack>
    </>
  );
};

export const MoveToPantryModal: React.FC<MoveToPantryModalProps> = ({
  visible,
  shoppingListItemId,
  ...form
}) => {
  const moveItem = useMoveToPantryItem({ shoppingListItemId, skip: !visible });
  const { shoppingListItem } = moveItem;
  const open = visible && !!shoppingListItem;
  const opening = useOpening(open);

  return (
    <Sheet
      mode="form"
      headerFromContent
      visible={open}
      onDismiss={form.onClose}
      snapPoints={['75%', '95%']}
      contentContainerStyle={styles.contentContainer}
      style={styles.scrollView}
    >
      {opening && shoppingListItem ? (
        <MoveToPantryForm
          // A new line or pantry seeds afresh, as a new opening does.
          key={`${opening.id}:${shoppingListItem.id}:${form.selectedPantryId}`}
          moveItem={{ ...moveItem, shoppingListItem }}
          {...form}
        />
      ) : null}
    </Sheet>
  );
};

const styles = StyleSheet.create(theme => ({
  scrollView: {
    flex: 1,
  },
  perUnitHint: {
    marginTop: theme.spacing.xs,
  },
  contentContainer: {
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.md,
  },
  itemInfo: {
    marginBottom: theme.spacing.xl,
    padding: theme.spacing.md,
    backgroundColor: theme.colors.surfaceVariant,
    borderRadius: theme.radii.md,
    borderCurve: 'continuous',
  },
  itemName: {
    marginBottom: theme.spacing.xs,
  },
  section: {
    marginBottom: theme.spacing.lg,
  },
  quantityUnitRow: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  quantityField: {
    flex: 0.4,
  },
  unitField: {
    flex: 0.6,
  },
  toggleSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.xl,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.md,
    borderCurve: 'continuous',
  },
  toggleInfo: {
    flex: 1,
    marginRight: theme.spacing.md,
  },
  toggleDescription: {
    marginTop: theme.spacing.xs,
  },
}));
