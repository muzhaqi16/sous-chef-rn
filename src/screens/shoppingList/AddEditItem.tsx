import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert } from 'react-native';
import {
  useAddItemToShoppingListMutation,
  useUpdateShoppingListItemMutation,
  useGetShoppingListItemQuery,
  ItemSuggestion,
  ShoppingListItemDisplayFragmentDoc,
  CategoryType,
} from '#generated';
import { FormModal } from '#components/organisms/FormModal';
import { BaseInput } from '#components/atoms/BaseInput/BaseInput';
import { ItemAutocompleteField } from '#components/molecules/AutocompleteField/ItemAutocompleteField';
import { UnitAutocompleteField } from '#components/molecules/AutocompleteField/UnitAutocompleteField';
import { CategoryAutocompleteField } from '#components/molecules/AutocompleteField/CategoryAutocompleteField';
import { EditableCounter } from '#components/molecules/EditableCounter';
import { FieldRow } from '#components/molecules/FieldRow';
import { useAppNavigation } from '#hooks/navigation/useAppNavigation';
import type { StaticScreenProps } from '@react-navigation/native';
import { createAddToParentConnectionUpdater } from '#/apollo/utils/cacheUpdaters';
import { useShoppingListItemForm } from '#/hooks/shoppingList/useShoppingListItemForm';
import {
  handleVersionConflict,
  getVersionConflictMessage,
} from '#/utils/errors/versionConflict';
import { errorService } from '#/services/errorService';

type RouteParams = {
  listId: string;
  itemId?: string;
  initialItemName?: string;
};

export const AddEditItem: React.FC<StaticScreenProps<RouteParams>> = ({ route }) => {
  const navigation = useAppNavigation();
  const { listId, itemId } = route.params;
  // Extract initialItemName (only present when navigating from AddItem route)
  const initialItemName = 'initialItemName' in route.params ? route.params.initialItemName : undefined;
  const isEdit = !!itemId;

  const {
    formState: { itemName, quantityInput, unit, notes, category, estimatedPrice },
    updateField,
    setFromItem,
    buildUnitInput,
    buildDirtyInput,
    hasDirtyFields,
  } = useShoppingListItemForm();
  const [saving, setSaving] = useState(false);

  // Store version for optimistic concurrency control (strict version checking)
  const itemVersionRef = useRef<number | undefined>(undefined);

  const addToShoppingListCache = useMemo(
    () =>
      createAddToParentConnectionUpdater(
        'ShoppingList',
        'itemsConnection',
        'ShoppingListItem',
      ),
    [],
  );

  // GraphQL hooks
  const { data } = useGetShoppingListItemQuery({
    variables: { id: itemId || '' },
    skip: !isEdit,
  });

  const [addItem] = useAddItemToShoppingListMutation({
    // Update cache immediately for optimistic UI
    update: (cache, { data: mutationData }) => {
      const newItem = mutationData?.addItemToShoppingList?.shoppingListItem;
      if (!newItem) return;

      addToShoppingListCache(cache, listId, newItem);
    },
    onError: error => {
      errorService.reportError(error, { operation: 'ShoppingListItem.addItem' });
    },
  });

  const [updateItem] = useUpdateShoppingListItemMutation({
    errorPolicy: 'all',
    // Update cache to ensure UI reflects changes immediately
    update(cache, { data }) {
      const updatedItem = data?.updateShoppingListItem?.shoppingListItem;
      if (updatedItem) {
        cache.writeFragment({
          id: cache.identify({ __typename: 'ShoppingListItem', id: updatedItem.id }),
          fragment: ShoppingListItemDisplayFragmentDoc,
          fragmentName: 'ShoppingListItemDisplayFragment',
          data: updatedItem,
        });
      }
    },
    onError: error => {
      errorService.reportError(error, { operation: 'ShoppingListItem.updateItem' });
    },
  });

  // Populate form when editing existing item
  useEffect(() => {
    if (data?.shoppingListItem) {
      setFromItem(data.shoppingListItem);
      // Store version for optimistic concurrency control
      itemVersionRef.current = data.shoppingListItem.version;
    }
  }, [data, setFromItem]);

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
  const handleSave = async () => {
    if (!itemName.trim()) {
      Alert.alert('Error', 'Please enter an item name');
      return;
    }

    if (!quantityInput.trim()) {
      Alert.alert('Error', 'Please enter a quantity');
      return;
    }

    setSaving(true);
    try {
      const unitData = buildUnitInput();

      let result;
      if (isEdit) {
        // Skip mutation if no fields changed
        if (!hasDirtyFields) {
          navigation.goBack();
          return;
        }

        // Only send changed fields - sends raw quantityInput string
        const input = buildDirtyInput();
        result = await updateItem({
          variables: {
            id: itemId,
            input: {
              ...input,
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
              ...(estimatedPrice && { estimatedPrice: parseFloat(estimatedPrice) }),
            },
          },
        });
      }

      // Only navigate back if mutation succeeded
      if (result.data) {
        const mutationData = isEdit
          ? 'updateShoppingListItem' in result.data
            ? result.data.updateShoppingListItem?.shoppingListItem
            : null
          : 'addItemToShoppingList' in result.data
          ? result.data.addItemToShoppingList?.shoppingListItem
          : null;

        if (mutationData) {
          navigation.goBack();
        } else {
          // PERFORMANCE: Specific error message - server returned success but no data
          Alert.alert(
            'Error',
            `Server error: Item was not ${
              isEdit ? 'updated' : 'added'
            }. The server may be experiencing issues. Please try again.`,
          );
        }
      } else {
        // PERFORMANCE: Specific error message - mutation failed without data
        Alert.alert(
          'Error',
          `Failed to ${
            isEdit ? 'update' : 'add'
          } item. Check your internet connection and try again.`,
        );
      }
    } catch (error: any) {
      errorService.reportError(error, { operation: 'ShoppingListItem.save' });

      // Handle version conflict errors with user-friendly message
      if (handleVersionConflict(error)) {
        Alert.alert(
          'Item Updated',
          getVersionConflictMessage(error),
          [
            {
              text: 'Refresh',
              onPress: () => {
                // Navigate back - the query will automatically refetch
                // when returning to the list view
                navigation.goBack();
              },
            },
            { text: 'Cancel', style: 'cancel' },
          ],
        );
        return; // Don't show generic error alert
      }

      // PERFORMANCE: Specific error messages based on error type
      let errorMessage = `Failed to ${isEdit ? 'update' : 'add'} item. `;

      if (error.networkError) {
        errorMessage += 'Network error - check your internet connection.';
      } else if (error.graphQLErrors?.length) {
        const graphQLError = error.graphQLErrors[0];
        if (graphQLError.extensions?.code === 'VALIDATION_ERROR') {
          errorMessage += 'Invalid input - please check your item details.';
        } else if (graphQLError.extensions?.code === 'UNAUTHENTICATED') {
          errorMessage += 'Session expired - please log in again.';
        } else {
          errorMessage += graphQLError.message || 'Please try again.';
        }
      } else {
        errorMessage += 'Please try again.';
      }

      Alert.alert('Error', errorMessage);
    } finally {
      setSaving(false);
    }
  };

  const modalTestID = isEdit
    ? 'edit-item-modal'
    : 'add-item-modal';

  return (
    <FormModal
      title={isEdit ? 'Edit Item' : 'Add Item'}
      onClose={() => navigation.goBack()}
      onSave={handleSave}
      loading={saving}
      testID={modalTestID}
      submitButtonTestID={isEdit ? 'edit-item-submit-button' : 'add-item-submit-button'}
    >
      {/* Item Name Field - Use autocomplete for new items only */}
      {isEdit ? (
        <BaseInput
          label="Item Name *"
          value={itemName}
          onChangeText={text => updateField('itemName', text)}
          placeholder="e.g., Milk, Bread"
          autoFocus
          testID="edit-item-name-input"
        />
      ) : (
        <ItemAutocompleteField
          variant="modal"
          label="Item Name"
          value={itemName}
          onChangeText={text => updateField('itemName', text)}
          onSelectItem={handleItemSelect}
          placeholder="e.g., Milk, Bread"
          required
          autoFocus
          testID="add-item-name-input"
        />
      )}

      {/* Quantity + Unit (inline) */}
      <FieldRow>
        <EditableCounter
          label="Quantity"
          required
          value={quantityInput}
          onChangeText={text => updateField('quantityInput', text)}
          placeholder="1"
          testID={isEdit ? 'edit-item-quantity-input' : 'add-item-quantity-input'}
        />
        <UnitAutocompleteField
          variant="modal"
          label="Unit"
          value={unit}
          onChangeText={text => updateField('unit', text)}
          onUnitSelected={handleUnitSelect}
          placeholder="pcs, kg, etc."
          testID={isEdit ? 'edit-item-unit-picker' : 'add-item-unit-picker'}
        />
      </FieldRow>

      {/* Category Field */}
      <CategoryAutocompleteField
        variant="modal"
        label="Category"
        value={category}
        onChangeText={text => updateField('category', text)}
        placeholder="e.g., Dairy, Produce"
        categoryType={CategoryType.General}
      />

      {/* Estimated Price Field */}
      <BaseInput
        label="Estimated Price"
        value={estimatedPrice}
        onChangeText={text => updateField('estimatedPrice', text)}
        placeholder="e.g., 4.99"
        keyboardType="numeric"
      />

      {/* Notes Field */}
      <BaseInput
        label="Notes"
        value={notes}
        onChangeText={text => updateField('notes', text)}
        placeholder="Any special notes..."
        multiline
        numberOfLines={3}
      />
    </FormModal>
  );
};
