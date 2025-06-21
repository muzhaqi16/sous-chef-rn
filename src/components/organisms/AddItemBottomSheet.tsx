import React, {useState, useRef} from 'react';
import {Text, StyleSheet} from 'react-native';
import {useMutation} from '@apollo/client';
import BottomSheet, {BottomSheetRef} from '../pages/BottomSheet';
import Button from '../atoms/Button';
import {ADD_ITEM_MUTATION} from '../../api/mutations';
import Autocomplete from '../molecules/AutoComplete';
import {useStore} from '../../store/useStore';
import {BaseInput} from '../atoms';

interface Item {
  id: string;
  name: string;
}

const AddItemBottomSheet: React.FC = () => {
  const bottomSheetRef = useRef<BottomSheetRef>(null);
  const [query, setQuery] = useState('');
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [renderBottomSheet, setRenderBottomSheet] = useState(false);

  const shoppingListId = useStore(state => state.defaultShoppingList?.id);

  // Show the bottom sheet when pressing the button
  const handleShowBottomSheet = () => {
    setRenderBottomSheet(true);
    bottomSheetRef.current?.expand();
  };

  // Setup your GraphQL mutation using Apollo's useMutation hook.
  const [addItem, {loading, error}] = useMutation(ADD_ITEM_MUTATION, {
    onCompleted: () => {
      bottomSheetRef.current?.close();
      setQuery('');
      setSelectedItem(null);
    },
    onError: err => console.error(err),
  });

  const handleAddItem = async () => {
    const itemName = selectedItem?.name || query;
    if (!itemName.trim()) return;
    addItem({
      variables: {
        data: {
          shoppingListId,
          itemId: selectedItem?.id || '',
          label: itemName,
        },
      },
    });
  };

  const handleSelectItem = (item: Item) => {
    setSelectedItem(item);
    setQuery('');
  };

  return (
    <>
      {/* Button to open the bottom sheet */}
      <Button
        title="Add Item"
        onPress={handleShowBottomSheet}
        style={{margin: 16}}
      />

      {/* Bottom sheet with input, autocomplete, and submit button */}
      {renderBottomSheet && (
        <BottomSheet
          ref={bottomSheetRef}
          snapPoints={['50%', '75%']}
          enableDynamicSizing={false}>
          <BaseInput
            placeholder="Start typing item name..."
            label="Item Name"
            value={selectedItem?.name || query}
            onChangeText={text => {
              setQuery(text);
              setSelectedItem(null);
            }}
          />

          <Autocomplete searchTerm={query} onSelectItem={handleSelectItem} />

          <Button
            title={loading ? 'Adding...' : 'Submit'}
            onPress={handleAddItem}
            style={{marginTop: 20}}
          />

          {error && (
            <Text style={styles.errorText}>Error: {error.message}</Text>
          )}
        </BottomSheet>
      )}
    </>
  );
};

const styles = StyleSheet.create({
  errorText: {
    color: 'red',
    marginTop: 10,
  },
});

export default AddItemBottomSheet;
