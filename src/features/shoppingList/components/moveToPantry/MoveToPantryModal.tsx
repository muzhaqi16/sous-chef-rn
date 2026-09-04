import React, { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from '#/i18n';
import { DropdownStack } from '#components/atoms/DropdownStack';
import { StyleSheet } from 'react-native-unistyles';
import { BaseSwitch } from '#components/atoms/BaseSwitch';
import { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { FractionInput } from '#components/molecules/FractionInput';
import { FormInput } from '#components/atoms/FormInput';
import { Header } from '#components/organisms/Header';
import { UnitAutocompleteField } from '#features/catalog/ui/autocomplete/UnitAutocompleteField';
import { parseFractionalInput } from '#/utils/fractionUtils';
import { Text } from '#components/atoms/Text';
import { StorageState } from '#/graphql/generated/schemaTypes';
import { useMoveToPantryItem } from '#features/shoppingList/hooks/useMoveToPantryItem';
import { PantrySelector } from './PantrySelector';
import { StorageStateControl } from './StorageStateControl';
import { ExpirationDateField } from './ExpirationDateField';
import { parseDecimalInput } from '#/utils/parseDecimalInput';
import {
  DEFAULT_CURRENCY,
  formatCurrency,
  formatNumberForInput,
  localizeNumericHint,
} from '#/utils/formatters/number';
import {
  totalFromUnitPrice,
  unitPriceFromTotal,
} from '#features/shoppingList/utils/purchasePrice';
import { Sheet } from '#components/templates/Sheet';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { logValidationErrors } from '#/utils/validation/common';
import {
  moveToPantryDefaults,
  moveToPantrySchema,
  type MoveToPantryFormValues,
} from './moveToPantryFormConfig';

interface MoveToPantryModalProps {
  visible: boolean;
  shoppingListItemId: string | null;
  pantries: Array<{ id: string; name: string; isDefault: boolean }>;
  selectedPantryId: string | null;
  onClose: () => void;
  onConfirm: (input: {
    pantryId: string;
    actualQuantity: number;
    actualUnitId?: string;
    storageState?: StorageState;
    expiresAt?: string;
    removeFromList: boolean;
    actualPrice?: number;
    notes?: string;
  }) => void;
  /** Server unreachable (offline / API down) — disables the confirm action. */
  confirmDisabled?: boolean;
}

export const MoveToPantryModal: React.FC<MoveToPantryModalProps> = ({
  visible,
  shoppingListItemId,
  pantries,
  selectedPantryId,
  onClose,
  onConfirm,
  confirmDisabled = false,
}) => {
  const { t } = useTranslation();

  const {
    shoppingListItem,
    purchasedQuantity,
    purchasedUnitPrice,
    purchasedUnit,
  } = useMoveToPantryItem({ shoppingListItemId, skip: !visible });

  const { control, handleSubmit, setValue } = useForm<MoveToPantryFormValues>({
    resolver: yupResolver(moveToPantrySchema),
    defaultValues: moveToPantryDefaults(StorageState.Ambient),
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

  // Interaction state, not fields: the picker's visibility and which of the two
  // amounts the shopper has typed over.
  const [showDatePicker, setShowDatePicker] = useState(false);
  // The per-unit price the total was seeded from, and whether the shopper has
  // since typed over either field. Between them they decide which of the two
  // amounts survives an edit — see `handleQuantityChange`.
  const [seededUnitPrice, setSeededUnitPrice] = useState<number | null>(null);
  const [amountsTouched, setAmountsTouched] = useState(false);
  const [priceTouched, setPriceTouched] = useState(false);

  // What the amounts are seeded from: what was BOUGHT, falling back to what was
  // requested. Prefilling the request is how a line asked for as 1 piece and
  // bought as 5 reached the pantry as 1.
  const seedQuantity = purchasedQuantity ?? shoppingListItem?.quantity ?? null;

  // ONE source decides both halves. Separate fallback chains let a line with
  // free-text `unitName` show "bag" while submitting the purchase's unit id.
  const resolvedUnit = shoppingListItem?.unit
    ? {
        symbol: shoppingListItem.unit.symbol ?? '',
        id: shoppingListItem.unit.id,
      }
    : shoppingListItem?.unitName
    ? { symbol: shoppingListItem.unitName, id: null }
    : purchasedUnit
    ? { symbol: purchasedUnit.unitSymbol, id: purchasedUnit.unitId }
    : { symbol: '', id: null };

  // Reset form when modal opens with new item (render-time state update).
  // Key on the item id (not the materialized object) so cache updates to the
  // same item don't clobber input.
  const [prevVisible, setPrevVisible] = useState(visible);
  const [prevShoppingListItemId, setPrevShoppingListItemId] = useState(
    shoppingListItem?.id,
  );
  const [prevSelectedPantryId, setPrevSelectedPantryId] =
    useState(selectedPantryId);
  // Both blocks below can run in ONE pass, where `unitId` still holds its
  // pre-update value — so the seed block would overwrite what the reset queued.
  let unitIdThisPass = unitId;
  if (
    visible !== prevVisible ||
    shoppingListItem?.id !== prevShoppingListItemId ||
    selectedPantryId !== prevSelectedPantryId
  ) {
    setPrevVisible(visible);
    setPrevShoppingListItemId(shoppingListItem?.id);
    setPrevSelectedPantryId(selectedPantryId);
    if (visible && shoppingListItem) {
      setValue('quantityInput', formatNumberForInput(seedQuantity) || '1');
      setValue('unitValue', resolvedUnit.symbol);
      setValue('unitId', resolvedUnit.id);
      unitIdThisPass = resolvedUnit.id;
      setValue('pantryId', selectedPantryId);
      setValue('storageState', StorageState.Ambient);
      setValue('expirationDate', undefined);
      setShowDatePicker(false);
      setValue('removeFromList', true);
      setValue(
        'actualPriceInput',
        formatNumberForInput(
          totalFromUnitPrice(purchasedUnitPrice, seedQuantity ?? 1),
        ),
      );
      setSeededUnitPrice(purchasedUnitPrice);
      setAmountsTouched(false);
      setPriceTouched(false);
      setValue('notes', '');
    }
  }

  // A cold start has no cached purchase, so the amounts can land a beat after
  // the sheet opens. Seed them then too — but never over something typed.
  const [prevSeed, setPrevSeed] = useState<string | null>(null);
  const seedKey = `${purchasedQuantity ?? ''}|${purchasedUnitPrice ?? ''}|${
    purchasedUnit?.unitId ?? ''
  }`;
  if (visible && seedKey !== prevSeed) {
    setPrevSeed(seedKey);
    // A line with no unit of its own takes the purchase's, which arrives with
    // the amounts rather than with the fragment.
    if (!unitIdThisPass && purchasedUnit) {
      setValue('unitValue', purchasedUnit.unitSymbol);
      setValue('unitId', purchasedUnit.unitId);
    }
    if (!amountsTouched && purchasedQuantity != null) {
      setValue('quantityInput', formatNumberForInput(purchasedQuantity) || '1');
      setValue(
        'actualPriceInput',
        formatNumberForInput(
          totalFromUnitPrice(purchasedUnitPrice, purchasedQuantity),
        ),
      );
      setSeededUnitPrice(purchasedUnitPrice);
    }
  }

  // Editing the quantity holds the PER-UNIT price and re-derives the total:
  // stocking 3 of 5 bought at $0.59 records $1.77, not the whole $2.95. Once
  // the shopper types a total of their own, that total wins instead.
  const handleQuantityChange = (value: string) => {
    setValue('quantityInput', value);
    setAmountsTouched(true);
    if (priceTouched || seededUnitPrice == null) return;
    const parsed = parseFractionalInput(value);
    const usable = parsed !== null && !isNaN(parsed) && parsed > 0;
    setValue(
      'actualPriceInput',
      usable
        ? formatNumberForInput(totalFromUnitPrice(seededUnitPrice, parsed))
        : '',
    );
  };

  const handlePriceChange = (value: string) => {
    setValue('actualPriceInput', value);
    setAmountsTouched(true);
    setPriceTouched(true);
  };

  // The same resolution the fields use, so this cannot render an empty unit.
  const lineUnitLabel = resolvedUnit.symbol;

  // Shown only when the split is not trivial — at quantity 1 the per-unit price
  // IS the total. Mirrors PurchaseAmountSheet.
  const enteredQuantity = parseFractionalInput(quantityInput);
  const enteredTotal = actualPriceInput
    ? parseDecimalInput(actualPriceInput)
    : null;
  const perUnitPrice =
    enteredQuantity !== null &&
    !isNaN(enteredQuantity) &&
    enteredQuantity > 0 &&
    enteredQuantity !== 1 &&
    enteredTotal !== null &&
    !isNaN(enteredTotal)
      ? unitPriceFromTotal(enteredTotal, enteredQuantity)
      : null;

  // Reaching here means the schema passed, so every field rule has already
  // reported itself ON its own field.
  const onValid = (values: MoveToPantryFormValues) => {
    if (!shoppingListItem) return;
    const {
      pantryId: confirmedPantryId,
      quantityInput: confirmedQuantity,
      unitId: confirmedUnitId,
      storageState,
      expirationDate: confirmedExpiry,
      removeFromList,
      actualPriceInput: confirmedPrice,
      notes,
    } = values;

    const quantityValue = parseFractionalInput(confirmedQuantity);
    if (quantityValue === null) return;

    // The field asks for the TOTAL paid, as Mark Purchased does; `actualPrice`
    // is per unit. Unrounded on purpose — the server rounds the product back.
    const totalPaid = confirmedPrice
      ? parseDecimalInput(confirmedPrice)
      : undefined;
    const actualPrice =
      totalPaid === undefined || isNaN(totalPaid)
        ? undefined
        : unitPriceFromTotal(totalPaid, quantityValue) ?? undefined;

    onConfirm({
      pantryId: confirmedPantryId ?? '',
      actualQuantity: quantityValue,
      actualUnitId: confirmedUnitId || undefined,
      storageState,
      expiresAt: confirmedExpiry?.toISOString(),
      removeFromList,
      actualPrice,
      notes: notes || undefined,
    });
    onClose();
  };

  const handleDateChange = (_event: DateTimePickerEvent, date?: Date) => {
    setShowDatePicker(false);
    if (date) {
      setValue('expirationDate', date);
    }
  };

  const clearExpirationDate = () => {
    setValue('expirationDate', undefined);
  };

  return (
    <Sheet
      mode="form"
      visible={visible ? !!shoppingListItem : false}
      onDismiss={onClose}
      snapPoints={['75%', '95%']}
      contentContainerStyle={styles.contentContainer}
      style={styles.scrollView}
    >
      {/* Header */}
      <Header
        title={t('moveToPantry.title')}
        centerTitle
        leftActions={[
          {
            icon: 'close',
            accessibilityLabel: t('labels.close'),
            onPress: onClose,
          },
        ]}
        rightActions={[
          {
            icon: 'checkmark',
            accessibilityLabel: t('moveToPantry.title'),
            onPress: handleSubmit(onValid, logValidationErrors),
            disabled: confirmDisabled,
          },
        ]}
      />

      {!!shoppingListItem && (
        <>
          {/* Item Info */}
          <View style={styles.itemInfo}>
            <Text role="heading" style={styles.itemName}>
              {shoppingListItem.itemName}
            </Text>
            <Text tone="secondary">
              {purchasedQuantity != null
                ? t('moveToPantry.purchasedAmount', {
                    amount: formatNumberForInput(purchasedQuantity),
                    unit: lineUnitLabel,
                  })
                : t('moveToPantry.requestedAmount', {
                    amount: formatNumberForInput(
                      shoppingListItem.quantity || 1,
                    ),
                    unit: lineUnitLabel,
                  })}
            </Text>
          </View>

          {/* Pantry Selector */}
          <PantrySelector
            pantries={pantries}
            selectedPantryId={pantryId}
            onSelect={id => setValue('pantryId', id, { shouldValidate: true })}
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
                    keyboardType="numeric"
                    required
                  />
                </View>
                <View style={styles.unitField}>
                  <UnitAutocompleteField
                    variant="inline"
                    label={t('storageLocationForm.unit')}
                    value={unitValue}
                    onChangeText={value =>
                      setValue('unitValue', value, { shouldValidate: true })
                    }
                    placeholder={t('moveToPantry.unitPlaceholder')}
                    required
                    onUnitSelected={id => {
                      setValue('unitId', id);
                    }}
                  />
                </View>
              </View>
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

            {/* Expiration Date */}
            <ExpirationDateField
              expirationDate={expirationDate}
              showPicker={showDatePicker}
              onOpenPicker={() => setShowDatePicker(true)}
              onChange={handleDateChange}
              onClear={clearExpirationDate}
            />

            {/* Total paid (Optional) */}
            <View style={styles.section}>
              <FormInput
                label={t('purchaseAmountSheet.totalPrice')}
                value={actualPriceInput}
                onChangeText={handlePriceChange}
                placeholder={localizeNumericHint('0.00')}
                keyboardType="decimal-pad"
              />
              {perUnitPrice != null ? (
                <Text
                  role="caption"
                  tone="secondary"
                  style={styles.perUnitHint}
                >
                  {t(
                    lineUnitLabel
                      ? 'purchaseAmountSheet.perUnitOfHint'
                      : 'purchaseAmountSheet.perUnitHint',
                    {
                      price: formatCurrency(perUnitPrice, DEFAULT_CURRENCY),
                      unit: lineUnitLabel,
                    },
                  )}
                </Text>
              ) : null}
            </View>

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
      )}
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
    marginTop: theme.spacing.md,
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
