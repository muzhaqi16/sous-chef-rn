import React, {useState, useEffect} from 'react';
import {Alert} from 'react-native';
import {ApolloCache} from '@apollo/client';
import {
  useAddItemToShoppingListMutation,
  useUpdateShoppingListItemMutation,
  useGetShoppingListItemQuery,
  GetShoppingListItemsDocument,
  ItemSuggestion,
  ShoppingListItemFragment,
  CategoryType,
} from '#generated';
import {FormModal} from '#components/organisms/FormModal';
import {Input} from '#components/base/Input';
import {ItemAutocompleteInput} from '#components/molecules/ItemAutocompleteInput';
import {UnitsAutocompleteInput} from '#components/molecules/UnitsAutocompleteInput';
import {CategoryAutocompleteInput} from '#components/molecules/CategoryAutocompleteInput';
import {FractionInput} from '#components/molecules/FractionInput';
import {useAppNavigation} from '#hooks';
import {ShoppingListStackParamList} from '#navigation/stacks/ShoppingListStack';

type RouteParams = ShoppingListStackParamList['AddItem' | 'EditItem'] & {
  itemId?: string;
};

export const AddEditItem: React.FC<{
  route: {params: RouteParams};
}> = ({route}) => {
  const navigation = useAppNavigation();
  const {listId, itemId} = route.params;
  const isEdit = !!itemId;

  // Form state
  const [itemName, setItemName] = useState('');
  const [quantityInput, setQuantityInput] = useState<string>('1');
  const [unit, setUnit] = useState('');
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [category, setCategory] = useState('');
  const [_selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // GraphQL hooks
  const {data} = useGetShoppingListItemQuery({
    variables: {id: itemId || ''},
    skip: !isEdit,
  });

  const [addItem] = useAddItemToShoppingListMutation({
    // Update cache immediately for optimistic UI
    update: (cache: ApolloCache, {data: mutationData}: any) => {
      if (!mutationData?.addItemToShoppingList) return;

      const newItem = mutationData.addItemToShoppingList;

      try {
        // Read the current shopping list items from cache
        const existingData = cache.readQuery<{
          shoppingListItems: ShoppingListItemFragment[];
        }>({
          query: GetShoppingListItemsDocument,
          variables: {shoppingListId: listId},
        });

        if (existingData?.shoppingListItems) {
          // Add the new item to the list
          cache.writeQuery({
            query: GetShoppingListItemsDocument,
            variables: {shoppingListId: listId},
            data: {
              shoppingListItems: [newItem, ...existingData.shoppingListItems],
            },
          });
        }
      } catch (error) {
        console.warn('Cache update failed:', error);
        // Cache update failed, but mutation still succeeded
      }
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
      const item = data.shoppingListItem;
      setItemName(item.itemName || '');
      // Use quantityInput if available (preserves fractions), otherwise use quantity
      setQuantityInput(item.quantityInput || item.quantity?.toString() || '1');
      setUnit(item.unitName || '');
      setNotes(item.notes || '');
      setCategory(item.category || '');
      setSelectedUnitId(item.unit?.id || null);
    }
  }, [data]);

  // Handle autocomplete item selection
  const handleItemSelect = (item: ItemSuggestion) => {
    // When user selects from autocomplete, just set the item name
    // In the future, you could extend this to fetch more item details
    // and populate other fields like category, default unit, etc.
    setItemName(item.name);
  };

  // Handle unit selection from autocomplete
  const handleUnitSelect = (unitId: string | null) => {
    setSelectedUnitId(unitId);
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
      // Parse quantity input to number
      // Backend accepts Float for now, will support String in future
      let quantityValue: number;
      try {
        // Parse fractional input (e.g., "1 1/4" or "3/4" or "1.5")
        const trimmed = quantityInput.trim();

        // Check if it contains a fraction
        if (trimmed.includes('/')) {
          const parts = trimmed.split(/\s+/);
          if (parts.length === 2) {
            // Mixed number like "1 1/4"
            const whole = parseInt(parts[0]);
            const [num, den] = parts[1].split('/').map(Number);
            quantityValue = whole + num / den;
          } else {
            // Simple fraction like "3/4"
            const [num, den] = trimmed.split('/').map(Number);
            quantityValue = num / den;
          }
        } else {
          // Regular number
          quantityValue = parseFloat(trimmed);
        }

        if (isNaN(quantityValue) || quantityValue <= 0) {
          Alert.alert('Error', 'Please enter a valid quantity');
          return;
        }
      } catch (err) {
        Alert.alert('Error', 'Please enter a valid quantity');
        return;
      }

      // Prepare unit data - prioritize selected unit ID if available
      const unitData = {
        unitName: unit, // Always include the display name
        ...(selectedUnitId && {unitId: selectedUnitId}), // Include unit ID if selected from autocomplete
      };

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
          ? ('updateShoppingListItem' in result.data ? result.data.updateShoppingListItem : null)
          : ('addItemToShoppingList' in result.data ? result.data.addItemToShoppingList : null);

        if (mutationData) {
          navigation.goBack();
        } else {
          // PERFORMANCE: Specific error message - server returned success but no data
          Alert.alert(
            'Error',
            `Server error: Item was not ${isEdit ? 'updated' : 'added'}. The server may be experiencing issues. Please try again.`
          );
        }
      } else {
        // PERFORMANCE: Specific error message - mutation failed without data
        Alert.alert(
          'Error',
          `Failed to ${isEdit ? 'update' : 'add'} item. Check your internet connection and try again.`
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

  return (
    <FormModal
      title={isEdit ? 'Edit Item' : 'Add Item'}
      onClose={() => navigation.goBack()}
      onSave={handleSave}
      loading={saving}>
      {/* Item Name Field - Use autocomplete for new items only */}
      {isEdit ? (
        <Input
          label="Item Name"
          value={itemName}
          onChangeText={setItemName}
          placeholder="e.g., Milk, Bread"
          required
          autoFocus
        />
      ) : (
        <ItemAutocompleteInput
          label="Item Name"
          value={itemName}
          onChangeText={setItemName}
          onSelectItem={handleItemSelect}
          placeholder="e.g., Milk, Bread"
          required
          autoFocus
        />
      )}

      {/* Quantity */}
      <FractionInput
        label="Quantity"
        value={quantityInput}
        onChangeText={setQuantityInput}
        placeholder="e.g., 1 1/4, 2.5, or 3"
      />

      {/* Unit */}
      <UnitsAutocompleteInput
        label="Unit"
        value={unit}
        onChangeText={setUnit}
        onUnitSelected={handleUnitSelect}
        placeholder="kg, lbs, pcs, etc."
      />

      {/* Category Field */}
      <CategoryAutocompleteInput
        label="Category"
        value={category}
        onChangeText={setCategory}
        onCategorySelected={setSelectedCategoryId}
        placeholder="e.g., Dairy, Produce"
        categoryType={CategoryType.General}
      />

      {/* Notes Field */}
      <Input
        label="Notes"
        value={notes}
        onChangeText={setNotes}
        placeholder="Any special notes..."
        multiline
        numberOfLines={3}
      />
    </FormModal>
  );
};
