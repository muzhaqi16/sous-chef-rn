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
import {FormGroup} from '#components/molecules/FormGroup';
import {AutocompleteInput} from '#components/molecules/AutoCompleteInput';
import {UnitsAutocompleteInput} from '#components/molecules/UnitsAutocompleteInput';
import {CategoryAutocompleteInput} from '#components/molecules/CategoryAutocompleteInput';
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
  const [quantity, setQuantity] = useState('1');
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
    // Update cache immediately for optimistic UI
    update: (cache: ApolloCache, {data: mutationData}: any) => {
      if (!mutationData?.updateShoppingListItem) return;

      const updatedItem = mutationData.updateShoppingListItem;

      try {
        // Read the current shopping list items from cache
        const existingData = cache.readQuery<{
          shoppingListItems: ShoppingListItemFragment[];
        }>({
          query: GetShoppingListItemsDocument,
          variables: {shoppingListId: listId},
        });

        if (existingData?.shoppingListItems) {
          // Update the existing item in the list
          const updatedItems = existingData.shoppingListItems.map(
            (item: any) => (item.id === updatedItem.id ? updatedItem : item),
          );

          cache.writeQuery({
            query: GetShoppingListItemsDocument,
            variables: {shoppingListId: listId},
            data: {
              shoppingListItems: updatedItems,
            },
          });
        }
      } catch (error) {
        console.warn('Cache update failed:', error);
        // Cache update failed, but mutation still succeeded
      }
    },
    onCompleted: () => {
      console.log('Item updated successfully');
    },
    onError: error => {
      console.error('Update item error:', error);
    },
  });

  // Populate form when editing existing item
  useEffect(() => {
    if (data?.shoppingListItem) {
      const item = data.shoppingListItem;
      setItemName(item.itemName || '');
      setQuantity(item.quantity?.toString() || '1');
      setUnit(item.unitName || '');
      setNotes(item.notes || '');
      setCategory(item.category || '');
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

    setSaving(true);
    try {
      // Prepare unit data - prioritize selected unit ID if available
      const unitData = {
        unitName: unit, // Always include the display name
        ...(selectedUnitId && {unitId: selectedUnitId}), // Include unit ID if selected from autocomplete
      };

      if (isEdit) {
        await updateItem({
          variables: {
            id: itemId,
            input: {
              itemName,
              quantity: parseFloat(quantity) || 1,
              ...unitData,
              notes,
              category,
            },
          },
        });
      } else {
        await addItem({
          variables: {
            input: {
              shoppingListId: listId,
              itemName,
              quantity: parseFloat(quantity) || 1,
              ...unitData,
              notes,
              category,
            },
          },
        });
      }
      navigation.goBack();
    } catch (error) {
      console.error('Save error:', error);
      Alert.alert('Error', `Failed to ${isEdit ? 'update' : 'add'} item`);
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
        <AutocompleteInput
          label="Item Name"
          value={itemName}
          onChangeText={setItemName}
          onSelectItem={handleItemSelect}
          placeholder="e.g., Milk, Bread"
          required
          autoFocus
        />
      )}

      {/* Quantity and Unit Row */}
      <FormGroup row>
        <Input
          label="Quantity"
          value={quantity}
          onChangeText={setQuantity}
          placeholder="1"
          keyboardType="numeric"
        />
        <UnitsAutocompleteInput
          label="Unit"
          value={unit}
          onChangeText={setUnit}
          onUnitSelected={handleUnitSelect}
          placeholder="kg, lbs, pcs, etc."
        />
      </FormGroup>

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
