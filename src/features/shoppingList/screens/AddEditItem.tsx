import React, { useEffect, useRef, useState } from 'react';
import { alertService } from '#/services/alertService';
import { useTranslation } from '#/i18n';
import { useShoppingListItemWrites } from '#features/shoppingList/hooks/useShoppingListItemWrites';
import type { ItemSuggestion } from '#/graphql/generated/schemaTypes';
import { CategoryType } from '#/graphql/generated/schemaTypes';
import { FormScreen } from '#components/templates/FormScreen';
import { FormInput } from '#components/atoms/FormInput';
import { ItemAutocompleteField } from '#features/catalog/ui/autocomplete/ItemAutocompleteField';
import { UnitAutocompleteField } from '#features/catalog/ui/autocomplete/UnitAutocompleteField';
import { CategoryAutocompleteField } from '#features/catalog/ui/autocomplete/CategoryAutocompleteField';
import { BrandAutocompleteField } from '#features/catalog/ui/autocomplete/BrandAutocompleteField';
import { StoreAutocompleteField } from '#features/catalog/ui/autocomplete/StoreAutocompleteField';
import { EditableCounter } from '#components/molecules/EditableCounter';
import { FieldRow } from '#components/atoms/FieldRow';
import { SegmentedControl } from '#components/molecules/SegmentedControl';
import { useAppNavigation } from '#hooks/navigation/useAppNavigation';
import {
  PRIORITY_OPTIONS,
  priorityValueOf,
  priorityOptionOf,
  priorityLabelKey,
} from '#features/shoppingList/utils/priority';
import type { StaticScreenProps } from '@react-navigation/native';
import { Controller } from 'react-hook-form';
import { logValidationErrors } from '#/utils/validation/common';
import { useShoppingListItemForm } from '#features/shoppingList/hooks/useShoppingListItemForm';
import { executeWithLoadingState } from '#/utils/finallyHelpers';
import { parseDecimalInput } from '#/utils/parseDecimalInput';
import { localizeNumericHint } from '#/utils/formatters/number';
import { shoppingListTestIDs } from '#features/shoppingList/testIDs';

type RouteParams = {
  listId: string;
  itemId?: string;
  initialItemName?: string;
};

export const AddEditItem: React.FC<StaticScreenProps<RouteParams>> = ({
  route,
}) => {
  const { t } = useTranslation();
  const navigation = useAppNavigation();
  const { listId, itemId } = route.params;
  // Extract initialItemName (only present when navigating from AddItem route)
  const initialItemName =
    'initialItemName' in route.params
      ? route.params.initialItemName
      : undefined;
  const isEdit = !!itemId;

  const {
    control,
    handleSubmit,
    errors,
    values: {
      itemName,
      quantityInput,
      unit,
      notes,
      category,
      estimatedPrice,
      priority,
      storeId,
      storeName,
      brand,
      brandId,
      netWeight,
      netWeightUnitId,
    },
    setFieldValue,
    setFromItem,
    buildUnitInput,
    buildDirtyInput,
    parseNetWeightInput,
    parseQuantityInput,
    hasDirtyFields,
  } = useShoppingListItemForm();
  const [saving, setSaving] = useState(false);

  // Store version for optimistic concurrency control (strict version checking)
  const itemVersionRef = useRef<number | undefined>(undefined);

  const { itemData, createItem, updateItem } = useShoppingListItemWrites(
    listId,
    isEdit ? itemId : undefined,
  );

  // Populate form when editing existing item
  useEffect(() => {
    if (itemData) {
      setFromItem(itemData);
      // Store version for optimistic concurrency control
      itemVersionRef.current = itemData.version;
    }
  }, [itemData, setFromItem]);

  // Pre-populate item name when adding new item with initial value
  useEffect(() => {
    if (!isEdit && initialItemName) {
      setFieldValue('itemName', initialItemName);
    }
  }, [isEdit, initialItemName, setFieldValue]);

  // Handle autocomplete item selection
  const handleItemSelect = (item: ItemSuggestion) => {
    setFieldValue('itemName', item.name);
    if (item.defaultUnit?.symbol) {
      setFieldValue('unit', item.defaultUnit.symbol);
    }
    if (item.defaultUnit?.id) {
      setFieldValue('selectedUnitId', item.defaultUnit.id);
    }
    if (item.category?.name) {
      setFieldValue('category', item.category.name);
    }
  };

  // Handle unit selection from autocomplete
  const handleUnitSelect = (unitId: string | null) => {
    setFieldValue('selectedUnitId', unitId);
  };

  // The brand field hands back (id, name); the name is kept only when a
  // suggestion was actually picked, so free typing keeps the text as typed.
  const handleBrandSelect = (id: string | null, name: string | null) => {
    setFieldValue('brandId', id);
    if (name) setFieldValue('brand', name);
  };

  // Only the id. `UnitAutocompleteField` writes the SYMBOL through
  // `onChangeText` before it calls this, so writing the unit's `name` back here
  // would replace "g" with "gram" — which is neither what `setFromItem`
  // repopulates the field with nor what the item detail renders. Same shape as
  // `handleUnitSelect` above.
  const handleNetWeightUnitSelect = (id: string | null) => {
    setFieldValue('netWeightUnitId', id);
  };

  // Wrapped in `handleSubmit` at the call site, not here: this body reads
  // `itemVersionRef.current`, and calling `handleSubmit` during render makes
  // that a render-time ref read (react-hooks/refs). Same shape as
  // `PantryItemForm`'s `handleSubmit(handleSave, logValidationErrors)`.
  const handleSave = () => {
    // Skip mutation if no fields changed (edit mode only)
    if (isEdit && !hasDirtyFields) {
      navigation.goBack();
      return;
    }

    void executeWithLoadingState(
      async () => {
        const unitData = buildUnitInput();

        if (isEdit) {
          // The server requires the version for the optimistic-concurrency
          // check, and it is only known once the item has loaded.
          const itemVersion = itemVersionRef.current;
          if (itemVersion == null) return;

          // Only send changed fields - sends raw quantityInput string
          const input = buildDirtyInput();
          // A version conflict offers Refresh: leaving lets the list refetch.
          const updated = await updateItem(
            {
              ...input,
              id: itemId,
              // Strict version checking (optimistic concurrency control).
              version: itemVersion,
            },
            () => navigation.goBack(),
          );
          if (updated) navigation.goBack();
          return;
        }

        const netWeightValue = parseNetWeightInput();
        const brandName = brand.trim();

        const created = await createItem(
          {
            shoppingListId: listId,
            itemName,
            quantity: parseQuantityInput() ?? 1,
            quantityInput,
            unitName: unit || null,
            category: category || null,
            unitId: 'unit' in unitData ? unitData.unit.unitId : undefined,
          },
          {
            item: { itemName },
            // Raw string: the server accepts FlexibleQuantity ("1/3", "1 1/4").
            quantity: quantityInput,
            ...unitData,
            notes,
            category,
            ...(estimatedPrice && {
              pricing: { estimatedPrice: parseDecimalInput(estimatedPrice) },
            }),
            // Always sent (0/1/2) so "low" persists, and so an edit can lower
            // priority back to it.
            priority,
            ...(storeId && { storePrefs: { preferredStoreId: storeId } }),
            ...((!!brandId || !!brandName) && {
              brand: {
                ...(brandId && { brandId }),
                ...(brandName && { brandName }),
              },
            }),
            // Both or neither: the schema refuses a weight without a resolved
            // unit id, so reaching here with one and not the other cannot happen.
            ...(netWeightValue !== undefined &&
              netWeightUnitId && {
                netWeight: { netWeight: netWeightValue, netWeightUnitId },
              }),
          },
        );

        // A refused create is reverted and alerted by the hook; a created or
        // queued one is in the cache, so the form can close.
        if (created) navigation.goBack();
      },
      setSaving,
      () => {
        alertService.alert(
          t('labels.error'),
          t('shoppingListScreens.failedToUpdateAdd', {
            action: isEdit
              ? t('shoppingListScreens.actionUpdate')
              : t('shoppingListScreens.actionAdd'),
          }),
        );
      },
    );
  };

  const formTestIDs = isEdit
    ? shoppingListTestIDs.editItemForm
    : shoppingListTestIDs.addItemForm;

  return (
    <FormScreen
      title={isEdit ? t('labels.editItem') : t('labels.addItem')}
      onClose={() => navigation.goBack()}
      // Wrapped in an arrow so the whole submit — including this body's read
      // of `itemVersionRef.current` — happens on press, not during render.
      onSave={() => {
        void handleSubmit(handleSave, logValidationErrors)();
      }}
      loading={saving}
      testID={formTestIDs.screen}
      submitButtonTestID={formTestIDs.submitButton}
    >
      {/* Item Name Field - Use autocomplete for new items only */}
      <Controller
        control={control}
        name="itemName"
        render={({ field: { value, onChange } }) =>
          isEdit ? (
            <FormInput
              label={t('labels.itemName')}
              required
              error={errors.itemName?.message}
              value={value}
              onChangeText={onChange}
              placeholder={t('shoppingListScreens.itemNamePlaceholder')}
              autoFocus
              testID={formTestIDs.nameInput}
            />
          ) : (
            <ItemAutocompleteField
              variant="modal"
              label={t('labels.itemName')}
              error={errors.itemName?.message}
              value={value}
              onChangeText={onChange}
              onSelectItem={handleItemSelect}
              placeholder={t('shoppingListScreens.itemNamePlaceholder')}
              required
              autoFocus
              testID={formTestIDs.nameInput}
            />
          )
        }
      />

      {/* Brand */}
      <BrandAutocompleteField
        variant="modal"
        label={t('labels.brand')}
        value={brand}
        onChangeText={text => setFieldValue('brand', text)}
        onBrandSelected={handleBrandSelect}
        placeholder={t('shoppingListScreens.brandPlaceholder')}
        testID={formTestIDs.brandInput}
      />

      {/* Category Field */}
      <CategoryAutocompleteField
        variant="modal"
        label={t('labels.category')}
        value={category}
        onChangeText={text => setFieldValue('category', text)}
        placeholder={t('labels.eGDairyProduce')}
        categoryType={CategoryType.General}
      />

      {/* Quantity + Unit (inline) */}
      <FieldRow>
        <Controller
          control={control}
          name="quantityInput"
          render={({ field: { value, onChange } }) => (
            <EditableCounter
              label={t('labels.quantity')}
              required
              error={errors.quantityInput?.message}
              value={value}
              onChangeText={onChange}
              placeholder="1"
              testID={formTestIDs.quantityInput}
            />
          )}
        />
        <UnitAutocompleteField
          variant="modal"
          label={t('storageLocationForm.unit')}
          value={unit}
          onChangeText={text => setFieldValue('unit', text)}
          onUnitSelected={handleUnitSelect}
          placeholder={t('labels.pcsKgEtc')}
          testID={formTestIDs.unitPicker}
        />
      </FieldRow>

      {/* Net weight + its unit (inline) */}
      <FieldRow>
        <FormInput
          label={t('labels.netWeight')}
          value={netWeight}
          onChangeText={text => setFieldValue('netWeight', text)}
          // The all-or-nothing rule reports on BOTH halves of the pair. Only
          // the unit half was rendered, so picking a unit with no weight left
          // Save refusing with nothing on screen to explain it.
          error={errors.netWeight?.message}
          placeholder={t('shoppingListScreens.netWeightPlaceholder')}
          keyboardType="decimal-pad"
          testID={formTestIDs.netWeightInput}
        />
        <Controller
          control={control}
          name="netWeightUnit"
          render={({ field: { value, onChange } }) => (
            <UnitAutocompleteField
              variant="modal"
              label={t('labels.weightUnit')}
              error={errors.netWeightUnit?.message}
              value={value}
              onChangeText={onChange}
              onUnitSelected={handleNetWeightUnitSelect}
              placeholder={t('labels.pcsKgEtc')}
              testID={formTestIDs.netWeightUnitPicker}
            />
          )}
        />
      </FieldRow>

      {/* Estimated Price Field */}
      <FormInput
        testID={formTestIDs.priceInput}
        label={t('shoppingListScreens.estimatedPrice')}
        value={estimatedPrice}
        onChangeText={text => setFieldValue('estimatedPrice', text)}
        placeholder={localizeNumericHint(
          t('shoppingListScreens.estimatedPricePlaceholder'),
        )}
        keyboardType="numeric"
      />

      {/* Priority */}
      <SegmentedControl
        label={t('shoppingListScreens.priority')}
        options={PRIORITY_OPTIONS}
        value={priorityOptionOf(priority) ?? 'low'}
        onChange={option => setFieldValue('priority', priorityValueOf(option))}
        formatLabel={option => t(priorityLabelKey(option))}
      />

      {/* Preferred Store */}
      <StoreAutocompleteField
        variant="modal"
        label={t('shoppingListScreens.store')}
        value={storeName}
        onChangeText={text => setFieldValue('storeName', text)}
        onStoreSelected={(id, name) => {
          setFieldValue('storeId', id);
          if (name) setFieldValue('storeName', name);
        }}
        placeholder={t('shoppingListScreens.storePlaceholder')}
        helperText={t('labels.storeSelectHint')}
      />

      {/* Notes Field */}
      <FormInput
        label={t('shoppingListScreens.notes')}
        value={notes}
        onChangeText={text => setFieldValue('notes', text)}
        placeholder={t('shoppingListScreens.notesPlaceholder')}
        multiline
        numberOfLines={3}
      />
    </FormScreen>
  );
};
