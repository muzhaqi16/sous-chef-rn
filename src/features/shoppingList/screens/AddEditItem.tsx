import React, { useEffect, useRef, useState } from 'react';
import { alertService } from '#/services/alertService';
import {
  useApolloClient,
  useFragment,
  useMutation,
  useQuery,
} from '@apollo/client/react';
import { useTranslation } from '#/i18n';
import {
  AddItemToShoppingListDocument,
  UpdateShoppingListItemDocument,
  GetShoppingListItemDocument,
} from '#features/shoppingList/graphql/shoppingList.generated';
import { ItemSuggestion, CategoryType } from '#/graphql/generated/schemaTypes';
import { UseShoppingListItemForm_ItemFragmentDoc } from '#features/shoppingList/hooks/useShoppingListItemForm.generated';
import { FormModal } from '#components/organisms/FormModal';
import { FormInput } from '#components/molecules/FormInput';
import { ItemAutocompleteField } from '#components/molecules/AutocompleteField/ItemAutocompleteField';
import { UnitAutocompleteField } from '#components/molecules/AutocompleteField/UnitAutocompleteField';
import { CategoryAutocompleteField } from '#components/molecules/AutocompleteField/CategoryAutocompleteField';
import { BrandAutocompleteField } from '#components/molecules/AutocompleteField/BrandAutocompleteField';
import { StoreAutocompleteField } from '#components/molecules/AutocompleteField/StoreAutocompleteField';
import { EditableCounter } from '#components/molecules/EditableCounter';
import { FieldRow } from '#components/molecules/FieldRow';
import { SegmentedControl } from '#components/molecules/SegmentedControl';
import { useAppNavigation } from '#hooks/navigation/useAppNavigation';
import {
  PRIORITY_OPTIONS,
  PRIORITY_VALUES,
  PRIORITY_OPTION_BY_VALUE,
  priorityLabelKey,
} from '#features/shoppingList/utils/priority';
import type { StaticScreenProps } from '@react-navigation/native';
import {
  addOptimisticShoppingListItem,
  createOptimisticShoppingListItem,
  reconcileShoppingCreate,
  buildAddItemsReconcileUpdate,
} from '#/apollo/utils/shoppingListCacheUpdaters';
import { useShoppingListItemForm } from '#features/shoppingList/hooks/useShoppingListItemForm';
import {
  handleMutationError,
  versionConflictCheck,
} from '#/utils/errorHandlers';
import { errorService } from '#/services/errorService';
import { validationFieldName } from '#/utils/errors/mutationPayload';
import { executeWithLoadingState } from '#/utils/finallyHelpers';
import { generateEntityId } from '#/utils/generateEntityId';
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
  const client = useApolloClient();
  const { listId, itemId } = route.params;
  // Extract initialItemName (only present when navigating from AddItem route)
  const initialItemName =
    'initialItemName' in route.params
      ? route.params.initialItemName
      : undefined;
  const isEdit = !!itemId;

  const {
    formState: {
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
      netWeightUnit,
      netWeightUnitId,
    },
    updateField,
    setFromItem,
    buildUnitInput,
    buildDirtyInput,
    parseNetWeightInput,
    netWeightNeedsUnit,
    hasDirtyFields,
  } = useShoppingListItemForm();
  const [saving, setSaving] = useState(false);

  // Store version for optimistic concurrency control (strict version checking)
  const itemVersionRef = useRef<number | undefined>(undefined);

  // GraphQL hooks
  const { data } = useQuery(GetShoppingListItemDocument, {
    variables: { id: itemId || '' },
    skip: !isEdit,
  });

  // The form hook owns its own narrow fragment (`useShoppingListItemForm_item`).
  // useFragment subscribes this screen to the entity's cache record so edits
  // made elsewhere flow back in without a refetch.
  const itemFragmentRef = data?.shoppingListItem ?? null;
  const itemFragmentResult = useFragment({
    fragment: UseShoppingListItemForm_ItemFragmentDoc,
    fragmentName: 'useShoppingListItemForm_item',
    from: itemFragmentRef,
  });
  const itemData =
    itemFragmentRef && itemFragmentResult.complete
      ? itemFragmentResult.data
      : null;

  const [addItem] = useMutation(AddItemToShoppingListDocument, {
    // Reconcile the server response with the item written into the cache before
    // the create fired.
    update: buildAddItemsReconcileUpdate({ listId }),
    onError: error => {
      errorService.reportError(error, {
        operation: 'ShoppingListItem.addItem',
      });
    },
  });

  const [updateItem] = useMutation(UpdateShoppingListItemDocument, {
    onError: error => {
      errorService.reportError(error, {
        operation: 'ShoppingListItem.updateItem',
      });
    },
  });

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
      updateField('itemName', initialItemName);
    }
  }, [isEdit, initialItemName, updateField]);

  // Handle autocomplete item selection
  const handleItemSelect = (item: ItemSuggestion) => {
    updateField('itemName', item.name);
    if (item.defaultUnit?.symbol) {
      updateField('unit', item.defaultUnit.symbol);
    }
    if (item.defaultUnit?.id) {
      updateField('selectedUnitId', item.defaultUnit.id);
    }
    if (item.category?.name) {
      updateField('category', item.category.name);
    }
  };

  // Handle unit selection from autocomplete
  const handleUnitSelect = (unitId: string | null) => {
    updateField('selectedUnitId', unitId);
  };

  // The brand field hands back (id, name); the name is kept only when a
  // suggestion was actually picked, so free typing keeps the text as typed.
  const handleBrandSelect = (id: string | null, name: string | null) => {
    updateField('brandId', id);
    if (name) updateField('brand', name);
  };

  // Only the id. `UnitAutocompleteField` writes the SYMBOL through
  // `onChangeText` before it calls this, so writing the unit's `name` back here
  // would replace "g" with "gram" — which is neither what `setFromItem`
  // repopulates the field with nor what the item detail renders. Same shape as
  // `handleUnitSelect` above.
  const handleNetWeightUnitSelect = (id: string | null) => {
    updateField('netWeightUnitId', id);
  };

  const formatPriorityLabel = (option: string) => t(priorityLabelKey(option));

  // Handle form submission
  const handleSave = () => {
    if (!itemName.trim()) {
      alertService.alert(t('labels.error'), t('errors.itemNameRequired'));
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
    // API on create, so prompt for a unit instead of silently dropping it.
    if (netWeightNeedsUnit) {
      alertService.alert(
        t('labels.error'),
        t('labels.pleaseSelectAUnitForTheNetWeight'),
      );
      return;
    }

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
          const result = await updateItem({
            variables: {
              input: {
                ...input,
                id: itemId,
                // Include version for strict version checking (optimistic concurrency control)
                version: itemVersion,
              },
            },
          });

          // Only navigate back if the update succeeded.
          const updatePayload =
            result.data?.updateShoppingListItem?.__typename ===
            'UpdateShoppingListItemPayload'
              ? result.data.updateShoppingListItem.shoppingListItem
              : null;
          if (updatePayload) {
            navigation.goBack();
          } else if (result.data) {
            // A refusal that names a field gets copy for that field — this
            // mutation carries `brand`, `netWeight`, `unit` and `storage` in
            // one call, so "couldn't update" alone does not say which was
            // refused. Localized, keyed off `field`; the server's own message
            // is English and is not shown (see `validationFieldName`).
            const refusedField = validationFieldName(result.data);
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

        // Generate the item's id and write it into the cache before firing, so it
        // shows immediately and stays if the create is queued offline (the queue
        // replays it later, keyed by this id).
        const id = generateEntityId();
        const netWeightValue = parseNetWeightInput();
        const brandName = brand.trim();
        const optimisticItem = createOptimisticShoppingListItem(id, {
          itemName,
          quantity: parseDecimalInput(quantityInput) || 1,
          quantityInput,
          unitName: unit || null,
          category: category || null,
          unitId: 'unit' in unitData ? unitData.unit.unitId : undefined,
        });
        try {
          addOptimisticShoppingListItem(client.cache, listId, optimisticItem);
        } catch (cacheError) {
          errorService.reportError(cacheError, {
            operation: 'Add Shopping List Item (optimistic)',
          });
        }

        const result = await addItem({
          variables: {
            input: {
              shoppingListId: listId,
              items: [
                {
                  id,
                  item: { itemName },
                  // Send raw string - server accepts FlexibleQuantity ("1/3", "1 1/4", "0.5", etc.)
                  quantity: quantityInput,
                  ...unitData,
                  notes,
                  category,
                  ...(estimatedPrice && {
                    pricing: {
                      estimatedPrice: parseDecimalInput(estimatedPrice),
                    },
                  }),
                  // Always send priority (0/1/2) so "low" (0) persists — matches
                  // the in-sheet add path and lets an edit lower priority back to
                  // low.
                  priority,
                  ...(storeId && {
                    storePrefs: { preferredStoreId: storeId },
                  }),
                  ...((brandId || brandName) && {
                    brand: {
                      ...(brandId && { brandId }),
                      ...(brandName && { brandName }),
                    },
                  }),
                  // Both or neither — `netWeightNeedsUnit` was checked above.
                  ...(netWeightValue !== undefined &&
                    netWeightUnitId && {
                      netWeight: {
                        netWeight: netWeightValue,
                        netWeightUnitId,
                      },
                    }),
                },
              ],
            },
          },
          context: { localFirst: true },
        });

        if (
          reconcileShoppingCreate(client.cache, listId, id, result) ===
          'reverted'
        ) {
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
    <FormModal
      title={isEdit ? t('labels.editItem') : t('labels.addItem')}
      onClose={() => navigation.goBack()}
      onSave={handleSave}
      loading={saving}
      testID={modalTestID}
      submitButtonTestID={
        isEdit ? 'edit-item-submit-button' : 'add-item-submit-button'
      }
    >
      {/* Item Name Field - Use autocomplete for new items only */}
      {isEdit ? (
        <FormInput
          label={t('labels.itemName')}
          required
          value={itemName}
          onChangeText={text => updateField('itemName', text)}
          placeholder={t('shoppingListScreens.itemNamePlaceholder')}
          autoFocus
          testID="edit-item-name-input"
        />
      ) : (
        <ItemAutocompleteField
          variant="modal"
          label={t('labels.itemName')}
          value={itemName}
          onChangeText={text => updateField('itemName', text)}
          onSelectItem={handleItemSelect}
          placeholder={t('shoppingListScreens.itemNamePlaceholder')}
          required
          autoFocus
          testID="add-item-name-input"
        />
      )}

      {/* Brand */}
      <BrandAutocompleteField
        variant="modal"
        label={t('labels.brand')}
        value={brand}
        onChangeText={text => updateField('brand', text)}
        onBrandSelected={handleBrandSelect}
        placeholder={t('shoppingListScreens.brandPlaceholder')}
        testID={isEdit ? 'edit-item-brand-input' : 'add-item-brand-input'}
      />

      {/* Category Field */}
      <CategoryAutocompleteField
        variant="modal"
        label={t('labels.category')}
        value={category}
        onChangeText={text => updateField('category', text)}
        placeholder={t('labels.eGDairyProduce')}
        categoryType={CategoryType.General}
      />

      {/* Quantity + Unit (inline) */}
      <FieldRow>
        <EditableCounter
          label={t('labels.quantity')}
          required
          value={quantityInput}
          onChangeText={text => updateField('quantityInput', text)}
          placeholder="1"
          testID={
            isEdit ? 'edit-item-quantity-input' : 'add-item-quantity-input'
          }
        />
        <UnitAutocompleteField
          variant="modal"
          label={t('storageLocationForm.unit')}
          value={unit}
          onChangeText={text => updateField('unit', text)}
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
          onChangeText={text => updateField('netWeight', text)}
          placeholder={t('shoppingListScreens.netWeightPlaceholder')}
          keyboardType="decimal-pad"
          testID={
            isEdit ? 'edit-item-net-weight-input' : 'add-item-net-weight-input'
          }
        />
        <UnitAutocompleteField
          variant="modal"
          label={t('labels.weightUnit')}
          value={netWeightUnit}
          onChangeText={text => updateField('netWeightUnit', text)}
          onUnitSelected={handleNetWeightUnitSelect}
          placeholder={t('labels.pcsKgEtc')}
          testID={
            isEdit
              ? 'edit-item-net-weight-unit-picker'
              : 'add-item-net-weight-unit-picker'
          }
        />
      </FieldRow>

      {/* Estimated Price Field */}
      <FormInput
        testID={isEdit ? 'edit-item-price-input' : 'add-item-price-input'}
        label={t('shoppingListScreens.estimatedPrice')}
        value={estimatedPrice}
        onChangeText={text => updateField('estimatedPrice', text)}
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
          updateField('priority', PRIORITY_VALUES[option] ?? 0)
        }
        formatLabel={formatPriorityLabel}
      />

      {/* Preferred Store */}
      <StoreAutocompleteField
        variant="modal"
        label={t('shoppingListScreens.store')}
        value={storeName}
        onChangeText={text => updateField('storeName', text)}
        onStoreSelected={(id, name) => {
          updateField('storeId', id);
          if (name) updateField('storeName', name);
        }}
        placeholder={t('shoppingListScreens.storePlaceholder')}
        helperText={t('labels.storeSelectHint')}
      />

      {/* Notes Field */}
      <FormInput
        label={t('shoppingListScreens.notes')}
        value={notes}
        onChangeText={text => updateField('notes', text)}
        placeholder={t('shoppingListScreens.notesPlaceholder')}
        multiline
        numberOfLines={3}
      />
    </FormModal>
  );
};
