import React, {useState, useEffect} from 'react';
import {Alert} from 'react-native';
import {useNavigation, useRoute} from '@react-navigation/native';
import {
  useAddItemToShoppingListMutation,
  useUpdateShoppingListItemMutation,
  useGetShoppingListItemQuery,
  ItemSuggestion,
} from '#generated';
import {FormModal} from '#components/organisms/FormModal';
import {Input} from '#components/base/Input';
import {FormGroup} from '#components/molecules/FormGroup';
import {AutocompleteInput} from '#components/molecules/AutoCompleteInput';

interface RouteParams {
  listId: string;
  itemId?: string;
}

export const AddEditItem: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const {listId, itemId} = route.params as RouteParams;
  const isEdit = !!itemId;

  // Form state
  const [itemName, setItemName] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [unit, setUnit] = useState('');
  const [notes, setNotes] = useState('');
  const [category, setCategory] = useState('');
  const [saving, setSaving] = useState(false);

  // GraphQL hooks
  const {data} = useGetShoppingListItemQuery({
    variables: {id: itemId || ''},
    skip: !isEdit,
  });

  const [addItem] = useAddItemToShoppingListMutation();
  const [updateItem] = useUpdateShoppingListItemMutation();

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

  // Handle form submission
  const handleSave = async () => {
    if (!itemName.trim()) {
      Alert.alert('Error', 'Please enter an item name');
      return;
    }

    setSaving(true);
    try {
      if (isEdit) {
        await updateItem({
          variables: {
            id: itemId,
            input: {
              itemName,
              quantity: parseFloat(quantity) || 1,
              unitName: unit,
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
              unitName: unit,
              notes,
              category,
            },
          },
        });
      }
      navigation.goBack();
    } catch (error) {
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
        <Input
          label="Unit"
          value={unit}
          onChangeText={setUnit}
          placeholder="e.g., kg, lbs"
        />
      </FormGroup>

      {/* Category Field */}
      <Input
        label="Category"
        value={category}
        onChangeText={setCategory}
        placeholder="e.g., Dairy, Produce"
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
