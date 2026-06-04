import React, { useEffect, useRef, useState } from 'react';
import { alertService } from '#/services/alertService';
import {
  useApolloClient,
  useFragment,
  useMutation,
  useQuery,
} from '@apollo/client/react';
import { useTranslation } from 'react-i18next';
import {
  AddItemToShoppingListDocument,
  UpdateShoppingListItemDocument,
  GetShoppingListItemDocument,
} from '#features/shoppingList/graphql/shoppingList.generated';
import { ItemSuggestion, CategoryType } from '#/graphql/generated/schemaTypes';
import { UseShoppingListItemForm_ItemFragmentDoc } from '#features/shoppingList/hooks/useShoppingListItemForm.generated';
import { FormModal } from '#components/organisms/FormModal';
import { BaseInput } from '#components/atoms/BaseInput/BaseInput';
import { ItemAutocompleteField } from '#components/molecules/AutocompleteField/ItemAutocompleteField';
import { UnitAutocompleteField } from '#components/molecules/AutocompleteField/UnitAutocompleteField';
import { CategoryAutocompleteField } from '#components/molecules/AutocompleteField/CategoryAutocompleteField';
import { EditableCounter } from '#components/molecules/EditableCounter';
import { FieldRow } from '#components/molecules/FieldRow';
import { useAppNavigation } from '#hooks/navigation/useAppNavigation';
import type { StaticScreenProps } from '@react-navigation/native';
import {
  addNewItemToShoppingListCache,
  addOptimisticShoppingListItem,
  adoptServerShoppingListItemId,
  createOptimisticShoppingListItem,
  reconcileShoppingCreate,
} from '#/apollo/utils/shoppingListCacheUpdaters';
import { useShoppingListItemForm } from '#features/shoppingList/hooks/useShoppingListItemForm';
import {
  handleMutationError,
  versionConflictCheck,
} from '#/utils/errorHandlers';
import { errorService } from '#/services/errorService';
import {
  executeCacheUpdate,
  executeWithLoadingState,
} from '#/utils/compilerSafeWrappers';
import { generateEntityId } from '#/utils/generateEntityId';

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
    },
    updateField,
    setFromItem,
    buildUnitInput,
    buildDirtyInput,
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
    update: (cache, { data: mutationData }, { variables }) => {
      const payload = mutationData?.addItemToShoppingList;
      if (
        payload?.__typename !== 'AddItemToShoppingListPayload' ||
        !variables
      ) {
        return;
      }
      const newItem = payload.shoppingListItem;

      // Catalog-merge: adopt the server id, evicting the optimistic cuid if the
      // server merged into an existing row. Reads the id off this mutation's own
      // variables (not a shared ref) so it stays correct when adds overlap.
      adoptServerShoppingListItemId(cache, newItem.id, variables.input.id);

      addNewItemToShoppingListCache(cache, listId, newItem);
    },
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

  // Handle form submission
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

    // Skip mutation if no fields changed (edit mode only)
    if (isEdit && !hasDirtyFields) {
      navigation.goBack();
      return;
    }

    executeWithLoadingState(
      async () => {
        const unitData = buildUnitInput();

        if (isEdit) {
          // Only send changed fields - sends raw quantityInput string
          const input = buildDirtyInput();
          const result = await updateItem({
            variables: {
              input: {
                ...input,
                id: itemId,
                // Include version for strict version checking (optimistic concurrency control)
                version: itemVersionRef.current,
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
            alertService.alert(
              t('labels.error'),
              t('shoppingListScreens.serverNotUpdated', {
                action: t('shoppingListScreens.updated'),
              }),
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
        const optimisticItem = createOptimisticShoppingListItem(id, {
          itemName,
          quantity: parseFloat(quantityInput) || 1,
          quantityInput,
          unitName: unit || null,
          category: category || null,
          unitId: 'unit' in unitData ? unitData.unit.unitId : undefined,
        });
        executeCacheUpdate(
          () =>
            addOptimisticShoppingListItem(client.cache, listId, optimisticItem),
          'Add Shopping List Item (optimistic)',
        );

        const result = await addItem({
          variables: {
            input: {
              id,
              shoppingListId: listId,
              itemName,
              // Send raw string - server accepts FlexibleQuantity ("1/3", "1 1/4", "0.5", etc.)
              quantity: quantityInput,
              ...unitData,
              notes,
              category,
              ...(estimatedPrice && {
                pricing: { estimatedPrice: parseFloat(estimatedPrice) },
              }),
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
      title={
        isEdit
          ? t('shoppingListScreens.editItem')
          : t('shoppingListScreens.addItem')
      }
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
        <BaseInput
          label={t('shoppingListScreens.itemNameRequired')}
          value={itemName}
          onChangeText={text => updateField('itemName', text)}
          placeholder={t('shoppingListScreens.itemNamePlaceholder')}
          autoFocus
          testID="edit-item-name-input"
        />
      ) : (
        <ItemAutocompleteField
          variant="modal"
          label={t('shoppingListScreens.itemName')}
          value={itemName}
          onChangeText={text => updateField('itemName', text)}
          onSelectItem={handleItemSelect}
          placeholder={t('shoppingListScreens.itemNamePlaceholder')}
          required
          autoFocus
          testID="add-item-name-input"
        />
      )}

      {/* Category Field */}
      <CategoryAutocompleteField
        variant="modal"
        label={t('shoppingListScreens.category')}
        value={category}
        onChangeText={text => updateField('category', text)}
        placeholder={t('shoppingListScreens.categoryPlaceholder')}
        categoryType={CategoryType.General}
      />

      {/* Quantity + Unit (inline) */}
      <FieldRow>
        <EditableCounter
          label={t('shoppingListScreens.quantity')}
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
          label={t('shoppingListScreens.unit')}
          value={unit}
          onChangeText={text => updateField('unit', text)}
          onUnitSelected={handleUnitSelect}
          placeholder={t('shoppingListScreens.unitPlaceholder')}
          testID={isEdit ? 'edit-item-unit-picker' : 'add-item-unit-picker'}
        />
      </FieldRow>

      {/* Estimated Price Field */}
      <BaseInput
        label={t('shoppingListScreens.estimatedPrice')}
        value={estimatedPrice}
        onChangeText={text => updateField('estimatedPrice', text)}
        placeholder={t('shoppingListScreens.estimatedPricePlaceholder')}
        keyboardType="numeric"
      />

      {/* Notes Field */}
      <BaseInput
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
