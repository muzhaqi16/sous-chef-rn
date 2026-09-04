import React, { useEffect, useRef, useState } from 'react';
import { alertService } from '#/services/alertService';
import { useTranslation } from '#/i18n';
import { useShoppingListItemWrites } from '#features/shoppingList/hooks/useShoppingListItemWrites';
import { ItemSuggestion, CategoryType } from '#/graphql/generated/schemaTypes';
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
  PRIORITY_VALUES,
  PRIORITY_OPTION_BY_VALUE,
  priorityLabelKey,
} from '#features/shoppingList/utils/priority';
import type { StaticScreenProps } from '@react-navigation/native';
import { Controller } from 'react-hook-form';
import { logValidationErrors } from '#/utils/validation/common';
import { useShoppingListItemForm } from '#features/shoppingList/hooks/useShoppingListItemForm';
import {
  handleMutationError,
  versionConflictCheck,
} from '#/utils/errorHandlers';
import { validationFieldName } from '#/utils/errors/mutationPayload';
import { executeWithLoadingState } from '#/utils/finallyHelpers';
import { parseDecimalInput } from '#/utils/parseDecimalInput';
import { localizeNumericHint } from '#/utils/formatters/number';

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

  const formatPriorityLabel = (option: string) => t(priorityLabelKey(option));

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

    executeWithLoadingState(
      async () => {
        const unitData = buildUnitInput();

        if (isEdit) {
          // The server requires the version for the optimistic-concurrency
          // check, and it is only known once the item has loaded.
          const itemVersion = itemVersionRef.current;
          if (itemVersion == null) return;

          // Only send changed fields - sends raw quantityInput string
          const input = buildDirtyInput();
          const outcome = await updateItem({
            ...input,
            id: itemId,
            // Strict version checking (optimistic concurrency control).
            version: itemVersion,
          });

          if (outcome.status !== 'rejected') {
            navigation.goBack();
          } else if (outcome.data) {
            // A refusal that names a field gets copy for that field — this
            // mutation carries `brand`, `netWeight`, `unit` and `storage` in
            // one call, so "couldn't update" alone does not say which was
            // refused. Localized, keyed off `field`; the server's own message
            // is English and is not shown (see `validationFieldName`).
            const refusedField = validationFieldName(outcome.data);
            const generic = t('shoppingListScreens.serverNotUpdated', {
              action: t('shoppingListScreens.updated'),
            });
            alertService.alert(
              t('labels.error'),
              refusedField
                ? t(`errors.field.${refusedField}`, { defaultValue: generic })
                : generic,
            );
          } else {
            alertService.alert(
              t('labels.error'),
              t('shoppingListScreens.failedToUpdateAdd', {
                action: t('shoppingListScreens.actionUpdate'),
              }),
            );
          }
          return;
        }

        const netWeightValue = parseNetWeightInput();
        const brandName = brand.trim();

        const outcome = await createItem(
          {
            shoppingListId: listId,
            itemName,
            quantity: parseDecimalInput(quantityInput) || 1,
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
            ...((brandId || brandName) && {
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

        if (outcome === 'reverted') {
          // The server refused the create — the reconciler fully reverted the
          // optimistic item (entity + list-stat scalars a bare evict would leave
          // inflated); surface the failure.
          alertService.alert(
            t('labels.error'),
            t('shoppingListScreens.serverNotUpdated', {
              action: t('shoppingListScreens.added'),
            }),
          );
        } else {
          // 'created' or 'queued' — the item is in the cache (and replays if it
          // was queued offline); navigate back.
          navigation.goBack();
        }
      },
      setSaving,
      (error: unknown) => {
        handleMutationError(error, {
          operation: 'ShoppingListItem.save',
          checks: [
            versionConflictCheck({
              onRefresh: () => {
                // Navigate back - the query will automatically refetch
                // when returning to the list view
                navigation.goBack();
              },
            }),
          ],
        });
      },
    );
  };

  const modalTestID = isEdit ? 'edit-item-modal' : 'add-item-modal';

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
      testID={modalTestID}
      submitButtonTestID={
        isEdit ? 'edit-item-submit-button' : 'add-item-submit-button'
      }
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
              testID="edit-item-name-input"
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
              testID="add-item-name-input"
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
        testID={isEdit ? 'edit-item-brand-input' : 'add-item-brand-input'}
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
              testID={
                isEdit ? 'edit-item-quantity-input' : 'add-item-quantity-input'
              }
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
          testID={isEdit ? 'edit-item-unit-picker' : 'add-item-unit-picker'}
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
          testID={
            isEdit ? 'edit-item-net-weight-input' : 'add-item-net-weight-input'
          }
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
              testID={
                isEdit
                  ? 'edit-item-net-weight-unit-picker'
                  : 'add-item-net-weight-unit-picker'
              }
            />
          )}
        />
      </FieldRow>

      {/* Estimated Price Field */}
      <FormInput
        testID={isEdit ? 'edit-item-price-input' : 'add-item-price-input'}
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
        value={PRIORITY_OPTION_BY_VALUE[priority] ?? 'low'}
        onChange={option =>
          setFieldValue('priority', PRIORITY_VALUES[option] ?? 0)
        }
        formatLabel={formatPriorityLabel}
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
