import React, { useEffect, useMemo, useState } from 'react';
import { Alert } from 'react-native';
import {
  useAddItemToShoppingListMutation,
  useUpdateShoppingListItemMutation,
  useGetShoppingListItemQuery,
  ItemSuggestion,
  ShoppingListItemFragment,
  CategoryType,
} from '#generated';
import { FormModal } from '#components/organisms/FormModal';
import { Input } from '#components/base/Input';
import { ItemAutocompleteInput } from '#components/molecules/ItemAutocompleteInput';
import { UnitsAutocompleteInput } from '#components/molecules/UnitsAutocompleteInput';
import { CategoryAutocompleteInput } from '#components/molecules/CategoryAutocompleteInput';
import { FractionInput } from '#components/molecules/FractionInput';
import { useAppNavigation } from '#hooks';
import { ShoppingListStackParamList } from '#navigation/stacks/ShoppingListStack';
import { createAddToKeyedQueryFieldUpdater } from '#/apollo/utils';
import { useShoppingListItemForm } from '#/hooks/shoppingList/useShoppingListItemForm';

type RouteParams = ShoppingListStackParamList['AddItem' | 'EditItem'] & {
  itemId?: string;
};

export const AddEditItem: React.FC<{
  route: { params: RouteParams };
}> = ({ route }) => {
  const navigation = useAppNavigation();
  const { listId, itemId } = route.params;
  const isEdit = !!itemId;

  const {
    formState: { itemName, quantityInput, unit, notes, category },
    updateField,
    parseQuantityInput,
    setFromItem,
    buildUnitInput,
  } = useShoppingListItemForm();
  const [saving, setSaving] = useState(false);

  const addToShoppingListItems = useMemo(
    () =>
      createAddToKeyedQueryFieldUpdater<ShoppingListItemFragment>(
        'shoppingListItems',
        'shoppingListId',
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
      if (!mutationData?.addItemToShoppingList) return;

      addToShoppingListItems(cache, mutationData.addItemToShoppingList, listId);
    },
    onError: error => {
      console.error('Add item error:', error);
    },
  });

  const [updateItem] = useUpdateShoppingListItemMutation({
    errorPolicy: 'all',
    onError: error => {
      console.error('Update item error:', error);
    },
  });

  // Populate form when editing existing item
  useEffect(() => {
    if (data?.shoppingListItem) {
      setFromItem(data.shoppingListItem);
    }
  }, [data, setFromItem]);

  // Handle autocomplete item selection
  const handleItemSelect = (item: ItemSuggestion) => {
    // When user selects from autocomplete, just set the item name
    // In the future, you could extend this to fetch more item details
    // and populate other fields like category, default unit, etc.
    updateField('itemName', item.name);
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

    setSaving(true);
    try {
      const quantityValue = parseQuantityInput();

      if (!quantityValue) {
        Alert.alert('Error', 'Please enter a valid quantity');
        return;
      }

      const unitData = buildUnitInput();

      let result;
      if (isEdit) {
        result = await updateItem({
          variables: {
            id: itemId,
            input: {
              itemName,
              quantity: quantityValue,
              ...unitData,
              notes,
              category,
            },
          },
        });
      } else {
        result = await addItem({
          variables: {
            input: {
              shoppingListId: listId,
              itemName,
              quantity: quantityValue,
              ...unitData,
              notes,
              category,
            },
          },
        });
      }

      // Only navigate back if mutation succeeded
      if (result.data) {
        const mutationData = isEdit
          ? 'updateShoppingListItem' in result.data
            ? result.data.updateShoppingListItem
            : null
          : 'addItemToShoppingList' in result.data
          ? result.data.addItemToShoppingList
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
      console.error('Save error:', error);

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
        <Input
          label="Item Name"
          value={itemName}
          onChangeText={text => updateField('itemName', text)}
          placeholder="e.g., Milk, Bread"
          required
          autoFocus
        />
      ) : (
        <ItemAutocompleteInput
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

      {/* Quantity */}
      <FractionInput
        label="Quantity"
        value={quantityInput}
        onChangeText={text => updateField('quantityInput', text)}
        placeholder="e.g., 1 1/4, 2.5, or 3"
        testID={isEdit ? 'edit-item-quantity-input' : 'add-item-quantity-input'}
      />

      {/* Unit */}
      <UnitsAutocompleteInput
        label="Unit"
        value={unit}
        onChangeText={text => updateField('unit', text)}
        onUnitSelected={handleUnitSelect}
        placeholder="kg, lbs, pcs, etc."
        testID={isEdit ? 'edit-item-unit-picker' : 'add-item-unit-picker'}
      />

      {/* Category Field */}
      <CategoryAutocompleteInput
        label="Category"
        value={category}
        onChangeText={text => updateField('category', text)}
        placeholder="e.g., Dairy, Produce"
        categoryType={CategoryType.General}
      />

      {/* Notes Field */}
      <Input
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
