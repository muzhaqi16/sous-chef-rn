import React, { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from '#/i18n';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { StyleSheet } from 'react-native-unistyles';
import { FormInput } from '#components/molecules/FormInput';
import { SheetFormHeader } from '#components/molecules/SheetFormHeader';
import { ItemAutocompleteField } from '#components/molecules/AutocompleteField/ItemAutocompleteField';
import { UnitAutocompleteField } from '#components/molecules/AutocompleteField/UnitAutocompleteField';
import { CategoryAutocompleteField } from '#components/molecules/AutocompleteField/CategoryAutocompleteField';
import { BrandAutocompleteField } from '#components/molecules/AutocompleteField/BrandAutocompleteField';
import { StoreAutocompleteField } from '#components/molecules/AutocompleteField/StoreAutocompleteField';
import { EditableCounter } from '#components/molecules/EditableCounter';
import { FieldRow } from '#components/molecules/FieldRow';
import { SegmentedControl } from '#components/molecules/SegmentedControl';
import { ItemSuggestion, CategoryType } from '#/graphql/generated/schemaTypes';
import {
  PRIORITY_OPTIONS,
  PRIORITY_VALUES,
  PRIORITY_OPTION_BY_VALUE,
  priorityLabelKey,
} from '#features/shoppingList/utils/priority';
import { useShoppingListItemForm } from '#features/shoppingList/hooks/useShoppingListItemForm';
import { useAddShoppingItem } from '#features/shoppingList/hooks/mutations/useAddShoppingItem';
import { alertService } from '#/services/alertService';
import { executeWithLoadingState } from '#/utils/finallyHelpers';
import { handleMutationError } from '#/utils/errorHandlers';
import { makeIdNameHandler } from '../makeIdNameHandler';
import { parseDecimalInput } from '#/utils/parseDecimalInput';
import { localizeNumericHint } from '#/utils/formatters/number';

interface ShoppingListDetailsStepProps {
  shoppingListId: string | undefined;
  prefilledItemName?: string;
  /** Refetch used by the add hook's cache-update fallback (suggestions list). */
  refetch: () => Promise<unknown>;
  /** Return to the search step of the parent sheet. */
  onClose: () => void;
  /** Item was created — the parent closes the whole sheet. */
  onSuccess: () => void;
}

/**
 * In-place "details" step for the Add to Shopping List sheet.
 *
 * Rendered as content INSIDE the shared AddItemSheet (not its own modal) when
 * the user taps "Add manually", so the search → form transition is a single
 * morphing sheet — the same pattern the pantry flow uses. Reuses the shared
 * `useShoppingListItemForm` state and the bottom-sheet-aware autocomplete
 * fields; the offline-first create goes through the shared `useAddShoppingItem`.
 */
export const ShoppingListDetailsStep: React.FC<
  ShoppingListDetailsStepProps
> = ({
  shoppingListId,
  prefilledItemName = '',
  refetch,
  onClose,
  onSuccess,
}) => {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  // Mounted fresh each time the user enters the details step, so the form
  // initializes straight from props.
  const {
    formState: {
      itemName,
      quantityInput,
      unit,
      notes,
      category,
      estimatedPrice,
    },
    updateField,
    buildUnitInput,
  } = useShoppingListItemForm({ itemName: prefilledItemName });

  const { addItem } = useAddShoppingItem({ listId: shoppingListId, refetch });
  const [saving, setSaving] = useState(false);

  // Manual-add extras the API supports (all optional).
  const [brand, setBrand] = useState('');
  const [brandId, setBrandId] = useState<string | null>(null);
  const [netWeight, setNetWeight] = useState('');
  const [netWeightUnit, setNetWeightUnit] = useState('');
  const [netWeightUnitId, setNetWeightUnitId] = useState<string | null>(null);
  const [priority, setPriority] = useState(0);
  const [storeName, setStoreName] = useState('');
  const [storeId, setStoreId] = useState<string | null>(null);

  // Autocomplete selection mirrors the AddEditItem screen.
  const handleItemSelect = (item: ItemSuggestion) => {
    updateField('itemName', item.name);
    if (item.defaultUnit?.symbol) updateField('unit', item.defaultUnit.symbol);
    if (item.defaultUnit?.id)
      updateField('selectedUnitId', item.defaultUnit.id);
    if (item.category?.name) updateField('category', item.category.name);
  };

  const handleUnitSelect = (unitId: string | null) => {
    updateField('selectedUnitId', unitId);
  };

  const handleBrandSelected = makeIdNameHandler(setBrandId, setBrand);
  const handleNetWeightUnitSelected = makeIdNameHandler(
    setNetWeightUnitId,
    setNetWeightUnit,
  );
  const handleStoreSelected = makeIdNameHandler(setStoreId, setStoreName);

  const formatPriorityLabel = (option: string) => t(priorityLabelKey(option));

  const handleSave = () => {
    if (!itemName.trim()) {
      alertService.alert(
        t('labels.error'),
        t('shoppingListScreens.pleaseEnterItemName'),
      );
      return;
    }
    if (!quantityInput.trim()) {
      alertService.alert(
        t('labels.error'),
        t('shoppingListScreens.pleaseEnterQuantity'),
      );
      return;
    }
    // Net weight is all-or-nothing — a value without a unit is rejected by the
    // API, so prompt for a unit instead of silently dropping it.
    if (netWeight.trim() && !netWeightUnitId) {
      alertService.alert(
        t('labels.error'),
        t('shoppingListScreens.netWeightUnitRequired'),
      );
      return;
    }

    const unitData = buildUnitInput();
    const netWeightValue = netWeight.trim()
      ? parseDecimalInput(netWeight)
      : undefined;
    executeWithLoadingState(
      async () => {
        await addItem({
          itemName,
          quantityInput,
          unitName: unit || undefined,
          unitId:
            'unit' in unitData ? unitData.unit.unitId ?? undefined : undefined,
          notes: notes || undefined,
          category: category || undefined,
          estimatedPrice: estimatedPrice || undefined,
          brandName: brand.trim() || undefined,
          brandId: brandId ?? undefined,
          netWeight:
            netWeightValue !== undefined &&
            !isNaN(netWeightValue) &&
            netWeightUnitId
              ? netWeightValue
              : undefined,
          netWeightUnitId:
            netWeightValue !== undefined && !isNaN(netWeightValue)
              ? netWeightUnitId ?? undefined
              : undefined,
          priority,
          preferredStoreId: storeId ?? undefined,
        });
        onSuccess();
      },
      setSaving,
      (error: unknown) =>
        handleMutationError(error, { operation: 'ShoppingListItem.add' }),
    );
  };

  return (
    <View style={styles.container} testID="add-shopping-item-details">
      <SheetFormHeader
        title={t('shoppingListScreens.addItem')}
        cancelLabel={t('labels.cancel')}
        saveLabel={t('labels.add')}
        onCancel={onClose}
        onSave={handleSave}
        saving={saving}
        submitTestID="add-shopping-item-submit-button"
      />

      <BottomSheetScrollView
        // Named so a test can scroll a field into view. The unit picker sits in
        // the second `FieldRow`, below the fold once the keyboard is up, and
        // Detox refuses to type into a view that is not hittable.
        testID="add-shopping-item-scroll"
        style={styles.body}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + 16 },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <ItemAutocompleteField
          variant="modal"
          label={t('shoppingListScreens.itemName')}
          value={itemName}
          onChangeText={text => updateField('itemName', text)}
          onSelectItem={handleItemSelect}
          placeholder={t('shoppingListScreens.itemNamePlaceholder')}
          required
          testID="add-shopping-item-name-input"
        />

        <BrandAutocompleteField
          variant="modal"
          label={t('shoppingListScreens.brand')}
          value={brand}
          onChangeText={setBrand}
          onBrandSelected={handleBrandSelected}
          placeholder={t('shoppingListScreens.brandPlaceholder')}
        />

        <CategoryAutocompleteField
          variant="modal"
          label={t('shoppingListScreens.category')}
          value={category}
          onChangeText={text => updateField('category', text)}
          placeholder={t('shoppingListScreens.categoryPlaceholder')}
          categoryType={CategoryType.General}
        />

        <FieldRow>
          <EditableCounter
            label={t('shoppingListScreens.quantity')}
            required
            value={quantityInput}
            onChangeText={text => updateField('quantityInput', text)}
            placeholder="1"
            testID="add-shopping-item-quantity-input"
          />
          <UnitAutocompleteField
            variant="modal"
            label={t('shoppingListScreens.unit')}
            value={unit}
            onChangeText={text => updateField('unit', text)}
            onUnitSelected={handleUnitSelect}
            placeholder={t('shoppingListScreens.unitPlaceholder')}
            testID="add-shopping-item-unit-picker"
          />
        </FieldRow>

        <FieldRow>
          <FormInput
            label={t('shoppingListScreens.netWeight')}
            value={netWeight}
            onChangeText={setNetWeight}
            placeholder={t('shoppingListScreens.netWeightPlaceholder')}
            keyboardType="decimal-pad"
            useBottomSheetInput
          />
          <UnitAutocompleteField
            variant="modal"
            label={t('shoppingListScreens.netWeightUnit')}
            value={netWeightUnit}
            onChangeText={setNetWeightUnit}
            onUnitSelected={handleNetWeightUnitSelected}
            placeholder={t('shoppingListScreens.unitPlaceholder')}
          />
        </FieldRow>

        <FormInput
          label={t('shoppingListScreens.estimatedPrice')}
          value={estimatedPrice}
          onChangeText={text => updateField('estimatedPrice', text)}
          placeholder={localizeNumericHint(
            t('shoppingListScreens.estimatedPricePlaceholder'),
          )}
          keyboardType="numeric"
          useBottomSheetInput
        />

        <SegmentedControl
          label={t('shoppingListScreens.priority')}
          options={PRIORITY_OPTIONS}
          value={PRIORITY_OPTION_BY_VALUE[priority] ?? 'low'}
          onChange={option => setPriority(PRIORITY_VALUES[option] ?? 0)}
          formatLabel={formatPriorityLabel}
        />

        <StoreAutocompleteField
          variant="modal"
          label={t('shoppingListScreens.store')}
          value={storeName}
          onChangeText={setStoreName}
          onStoreSelected={handleStoreSelected}
          placeholder={t('shoppingListScreens.storePlaceholder')}
          helperText={t('labels.storeSelectHint')}
        />

        <FormInput
          label={t('shoppingListScreens.notes')}
          value={notes}
          onChangeText={text => updateField('notes', text)}
          placeholder={t('shoppingListScreens.notesPlaceholder')}
          multiline
          numberOfLines={3}
          useBottomSheetInput
        />
      </BottomSheetScrollView>
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  container: {
    flex: 1,
  },
  body: {
    flex: 1,
  },
  content: {
    padding: theme.spacing.md,
  },
}));
