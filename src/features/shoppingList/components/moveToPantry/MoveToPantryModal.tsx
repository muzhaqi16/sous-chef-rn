import React, { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from '#/i18n';
import { useFragment, useQuery } from '@apollo/client/react';
import { BottomSheetModal } from '#hooks/useStandardBottomSheet';
import { alertService } from '#/services/alertService';
import { BottomSheetFormScrollView } from '#components/atoms/BottomSheetFormScrollView';
import { DropdownStack } from '#components/atoms/DropdownStack';
import { StyleSheet } from 'react-native-unistyles';
import { BaseSwitch } from '#components/atoms/BaseSwitch';
import { useStandardBottomSheet } from '#hooks/useStandardBottomSheet';
import { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { FractionInput } from '#components/molecules/FractionInput';
import { FormInput } from '#components/molecules/FormInput';
import { Header } from '#components/molecules/Header';
import { UnitAutocompleteField } from '#features/catalog/ui/autocomplete/UnitAutocompleteField';
import { parseFractionalInput } from '#/utils/fractionUtils';
import { Text } from '#components/atoms/Text';
import { StorageState } from '#/graphql/generated/schemaTypes';
import {
  MoveToPantryModal_ShoppingListItemFragmentDoc,
  MoveToPantryPurchaseInfoDocument,
} from './MoveToPantryModal.generated';
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
import { totalFromUnitPrice, unitPriceFromTotal } from '#/utils/purchasePrice';

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

  const { data, complete } = useFragment({
    fragment: MoveToPantryModal_ShoppingListItemFragmentDoc,
    fragmentName: 'MoveToPantryModal_shoppingListItem',
    from: shoppingListItemId
      ? { __typename: 'ShoppingListItem', id: shoppingListItemId }
      : null,
  });
  const shoppingListItem = shoppingListItemId && complete ? data : null;

  // What was actually bought, which the amounts below are seeded from. A query
  // rather than a field on the fragment above: that one gates the whole sheet on
  // `complete`, and the list query caches only `{ isPurchased movedToPantryAt }`
  // — so on a cold start the missing amounts would blank the sheet instead of
  // just the prefill. `cache-first` means no network leg once they are cached.
  const { data: purchaseData } = useQuery(MoveToPantryPurchaseInfoDocument, {
    variables: { id: shoppingListItemId ?? '' },
    skip: !visible || !shoppingListItemId,
    fetchPolicy: 'cache-first',
    // NOT the app-wide `'all'`: a field error nulls the non-null `purchaseInfo`
    // and so `shoppingListItem`, and `'all'` WRITES that null onto
    // `ROOT_QUERY.shoppingListItem({id})` — the field ItemDetail reads — where
    // it sticks and persists to MMKV. Losing the prefill costs far less.
    errorPolicy: 'none',
  });
  const purchaseInfo = purchaseData?.shoppingListItem?.purchaseInfo ?? null;
  const purchasedQuantity = purchaseInfo?.isPurchased
    ? purchaseInfo.purchasedQuantity ?? null
    : null;
  // PER UNIT, as the API stores it; the field below shows the total.
  const purchasedUnitPrice = purchaseInfo?.isPurchased
    ? purchaseInfo.purchasedPrice ?? null
    : null;

  const { ref, modalProps, contentContainerStyle } = useStandardBottomSheet({
    visible: visible && !!shoppingListItem,
    onDismiss: onClose,
    snapPoints: ['75%', '95%'],
  });

  // Form state
  const [quantityInput, setQuantityInput] = useState('');
  const [unitValue, setUnitValue] = useState('');
  const [unitId, setUnitId] = useState<string | null>(null);
  const [pantryId, setPantryId] = useState<string | null>(null);
  const [storageState, setStorageState] = useState<StorageState>(
    StorageState.Ambient,
  );
  const [expirationDate, setExpirationDate] = useState<Date | undefined>(
    undefined,
  );
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [removeFromList, setRemoveFromList] = useState(true);
  const [actualPriceInput, setActualPriceInput] = useState('');
  const [notes, setNotes] = useState('');
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

  // Reset form when modal opens with new item (render-time state update).
  // Key on the item id (not the materialized object) so cache updates to the
  // same item don't clobber input.
  const [prevVisible, setPrevVisible] = useState(visible);
  const [prevShoppingListItemId, setPrevShoppingListItemId] = useState(
    shoppingListItem?.id,
  );
  const [prevSelectedPantryId, setPrevSelectedPantryId] =
    useState(selectedPantryId);
  if (
    visible !== prevVisible ||
    shoppingListItem?.id !== prevShoppingListItemId ||
    selectedPantryId !== prevSelectedPantryId
  ) {
    setPrevVisible(visible);
    setPrevShoppingListItemId(shoppingListItem?.id);
    setPrevSelectedPantryId(selectedPantryId);
    if (visible && shoppingListItem) {
      setQuantityInput(formatNumberForInput(seedQuantity) || '1');
      setUnitValue(
        shoppingListItem.unit?.symbol || shoppingListItem.unitName || '',
      );
      setUnitId(shoppingListItem.unit?.id || null);
      setPantryId(selectedPantryId);
      setStorageState(StorageState.Ambient);
      setExpirationDate(undefined);
      setShowDatePicker(false);
      setRemoveFromList(true);
      setActualPriceInput(
        formatNumberForInput(
          totalFromUnitPrice(purchasedUnitPrice, seedQuantity ?? 1),
        ),
      );
      setSeededUnitPrice(purchasedUnitPrice);
      setAmountsTouched(false);
      setPriceTouched(false);
      setNotes('');
    }
  }

  // A cold start has no cached purchase, so the amounts can land a beat after
  // the sheet opens. Seed them then too — but never over something typed.
  const [prevSeed, setPrevSeed] = useState<string | null>(null);
  const seedKey = `${purchasedQuantity ?? ''}|${purchasedUnitPrice ?? ''}`;
  if (visible && seedKey !== prevSeed) {
    setPrevSeed(seedKey);
    if (!amountsTouched && purchasedQuantity != null) {
      setQuantityInput(formatNumberForInput(purchasedQuantity) || '1');
      setActualPriceInput(
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
    setQuantityInput(value);
    setAmountsTouched(true);
    if (priceTouched || seededUnitPrice == null) return;
    const parsed = parseFractionalInput(value);
    const usable = parsed !== null && !isNaN(parsed) && parsed > 0;
    setActualPriceInput(
      usable
        ? formatNumberForInput(totalFromUnitPrice(seededUnitPrice, parsed))
        : '',
    );
  };

  const handlePriceChange = (value: string) => {
    setActualPriceInput(value);
    setAmountsTouched(true);
    setPriceTouched(true);
  };

  const lineUnitLabel =
    shoppingListItem?.unit?.symbol || shoppingListItem?.unitName || '';

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

  const handleConfirm = () => {
    if (!shoppingListItem) return;

    if (!pantryId) {
      alertService.alert(
        t('labels.error'),
        t('moveToPantry.selectPantryError'),
      );
      return;
    }

    const quantityValue = parseFractionalInput(quantityInput);

    if (quantityValue === null || isNaN(quantityValue) || quantityValue <= 0) {
      alertService.alert(t('labels.error'), t('errors.invalidQuantity'));
      return;
    }

    // Validate unit is selected
    if (!unitId && !unitValue.trim()) {
      alertService.alert(t('labels.error'), t('moveToPantry.selectUnitError'));
      return;
    }

    // The field asks for the TOTAL paid, as Mark Purchased does; `actualPrice`
    // is per unit. Unrounded on purpose — the server rounds the product back.
    const totalPaid = actualPriceInput
      ? parseDecimalInput(actualPriceInput)
      : undefined;
    const actualPrice =
      totalPaid === undefined || isNaN(totalPaid)
        ? undefined
        : unitPriceFromTotal(totalPaid, quantityValue) ?? undefined;

    onConfirm({
      pantryId,
      actualQuantity: quantityValue,
      actualUnitId: unitId || undefined,
      storageState,
      expiresAt: expirationDate?.toISOString(),
      removeFromList,
      actualPrice,
      notes: notes || undefined,
    });
    onClose();
  };

  const handleDateChange = (_event: DateTimePickerEvent, date?: Date) => {
    setShowDatePicker(false);
    if (date) {
      setExpirationDate(date);
    }
  };

  const clearExpirationDate = () => {
    setExpirationDate(undefined);
  };

  return (
    <BottomSheetModal ref={ref} {...modalProps}>
      <BottomSheetFormScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.contentContainer, contentContainerStyle]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <Header
          title={t('moveToPantry.title')}
          centerTitle
          leftActions={[
            {
              icon: 'close',
              onPress: onClose,
            },
          ]}
          rightActions={[
            {
              icon: 'checkmark',
              onPress: handleConfirm,
              disabled: confirmDisabled,
            },
          ]}
        />

        {!!shoppingListItem && (
          <>
            {/* Item Info */}
            <View style={styles.itemInfo}>
              <Text size="lg" weight="semibold" style={styles.itemName}>
                {shoppingListItem.itemName}
              </Text>
              <Text size="base" tone="secondary">
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
              onSelect={setPantryId}
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
                      onChangeText={setUnitValue}
                      placeholder={t('moveToPantry.unitPlaceholder')}
                      required
                      onUnitSelected={id => {
                        setUnitId(id);
                      }}
                    />
                  </View>
                </View>
              </View>

              {/* Storage State */}
              <StorageStateControl
                value={storageState}
                onChange={setStorageState}
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
                  <Text size="xs" tone="secondary" style={styles.perUnitHint}>
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
                <FormInput
                  label={t('labels.notesOptional')}
                  value={notes}
                  onChangeText={setNotes}
                  placeholder={t('moveToPantry.notesPlaceholder')}
                  multiline
                  numberOfLines={2}
                />
              </View>

              {/* Remove from List Toggle */}
              <View style={styles.toggleSection}>
                <View style={styles.toggleInfo}>
                  <Text size="base" weight="medium">
                    {t('moveToPantry.removeFromShopping')}
                  </Text>
                  <Text
                    size="sm"
                    tone="secondary"
                    style={styles.toggleDescription}
                  >
                    {t('moveToPantry.removeFromShoppingDesc')}
                  </Text>
                </View>
                <BaseSwitch
                  value={removeFromList}
                  onValueChange={setRemoveFromList}
                />
              </View>
            </DropdownStack>
          </>
        )}
      </BottomSheetFormScrollView>
    </BottomSheetModal>
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
