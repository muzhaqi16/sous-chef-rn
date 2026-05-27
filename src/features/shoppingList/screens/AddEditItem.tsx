import React, { useEffect, useRef, useState } from 'react';
import { alertService } from '#/services/alertService';
import { useFragment, useMutation, useQuery } from '@apollo/client/react';
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
import { addNewItemToShoppingListCache } from '#/apollo/utils/shoppingListCacheUpdaters';
import { useShoppingListItemForm } from '#features/shoppingList/hooks/useShoppingListItemForm';
import {
  handleMutationError,
  versionConflictCheck,
} from '#/utils/errorHandlers';
import { errorService } from '#/services/errorService';
import { executeWithLoadingState } from '#/utils/compilerSafeWrappers';

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
    // Update cache immediately for optimistic UI
    update: (cache, { data: mutationData }) => {
      const payload = mutationData?.addItemToShoppingList;
      if (payload?.__typename !== 'AddItemToShoppingListPayload') return;
      const newItem = payload.shoppingListItem;

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

        let result;
        if (isEdit) {
          // Only send changed fields - sends raw quantityInput string
          const input = buildDirtyInput();
          result = await updateItem({
            variables: {
              input: {
                ...input,
                id: itemId,
                // Include version for strict version checking (optimistic concurrency control)
                version: itemVersionRef.current,
              },
            },
          });
        } else {
          result = await addItem({
            variables: {
              input: {
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
          });
        }

        // Only navigate back if mutation succeeded
        if (result.data) {
          const updatePayload =
            'updateShoppingListItem' in result.data
              ? result.data.updateShoppingListItem
              : null;
          const addPayload =
            'addItemToShoppingList' in result.data
              ? result.data.addItemToShoppingList
              : null;
          const mutationData = isEdit
            ? updatePayload?.__typename === 'UpdateShoppingListItemPayload'
              ? updatePayload.shoppingListItem
              : null
            : addPayload?.__typename === 'AddItemToShoppingListPayload'
            ? addPayload.shoppingListItem
            : null;

          if (mutationData) {
            navigation.goBack();
          } else {
            // PERFORMANCE: Specific error message - server returned success but no data
            alertService.alert(
              t('labels.error'),
              t('shoppingListScreens.serverNotUpdated', {
                action: isEdit
                  ? t('shoppingListScreens.updated')
                  : t('shoppingListScreens.added'),
              }),
            );
          }
        } else {
          // PERFORMANCE: Specific error message - mutation failed without data
          alertService.alert(
            t('labels.error'),
            t('shoppingListScreens.failedToUpdateAdd', {
              action: isEdit
                ? t('shoppingListScreens.actionUpdate')
                : t('shoppingListScreens.actionAdd'),
            }),
          );
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
