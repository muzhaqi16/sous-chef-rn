import React, {useState} from 'react';
import {Text} from 'react-native';
import {BottomSheetTextInput} from '@gorhom/bottom-sheet';
import Button from '../atoms/Button';
import {BottomSheetAction} from '../templates/BottomSheetAction';
import Autocomplete from '../molecules/AutoComplete';
import {useStore} from '../../store';
import {useAddItemToShoppingListMutation} from '../../graphql/generated';
import {createStyleSheet, useStyles} from 'react-native-unistyles';

interface Item {
  id: string;
  name: string;
}

export const AddItemBottomSheet: React.FC = ({}) => {
  const {styles, theme} = useStyles(stylesheet);
  const [query, setQuery] = useState('');
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);

  const shoppingListId = useStore(state => state.selectedShoppingListId);
  // Setup your GraphQL mutation using Apollo's useMutation hook.
  const [addItem, {loading, error}] = useAddItemToShoppingListMutation({
    onCompleted: () => {
      setQuery('');
      setSelectedItem(null);
    },
    onError: err => {
      console.error('Error adding item:', err);
    },
  });

  const handleAddItem = async () => {
    const itemName = selectedItem?.name || query;
    if (!itemName.trim()) return;
    addItem({
      variables: {
        data: {
          shoppingListId: shoppingListId || '',
          itemId: selectedItem?.id || '',
          itemName,
          quantity: 1, // Default quantity, adjust as needed
        },
      },
    });
  };

  const handleSelectItem = (item: Item) => {
    setSelectedItem(item);
    setQuery('');
  };

  return (
    <BottomSheetAction actionIcon="add" sheetTitle="Add Item">
      <BottomSheetTextInput
        placeholder="Start typing item name..."
        value={selectedItem?.name || query}
        onChangeText={text => {
          setQuery(text);
          setSelectedItem(null);
        }}
        autoFocus
        style={{
          backgroundColor: '#fff',
          borderRadius: 8,
          padding: 12,
          fontSize: 16,
          marginBottom: 8,
          borderWidth: 1,
          borderColor: '#ddd',
          // Add any other styling you want
        }}
      />
      <Autocomplete searchTerm={query} onSelectItem={handleSelectItem} />
      <Button
        title={loading ? 'Adding...' : 'Submit'}
        onPress={handleAddItem}
        btnStyle={{marginTop: 20}}
      />

      {error && <Text style={styles.errorText}>Error: {error.message}</Text>}
    </BottomSheetAction>
  );
};

const stylesheet = createStyleSheet(theme => ({
  errorText: {
    color: 'red',
    marginTop: 10,
  },
}));

export default AddItemBottomSheet;
