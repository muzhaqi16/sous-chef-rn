import React, {useState, useRef, useEffect} from 'react';
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

type BottomSheetProps = {
  isVisible: boolean;
  onClose: () => void;
};

const AddItemBottomSheet: React.FC<BottomSheetProps> = ({
  isVisible,
  onClose,
}) => {
  const bottomSheetRef = useRef<BottomSheetRef>(null);
  const [query, setQuery] = useState('');
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [renderBottomSheet, setRenderBottomSheet] = useState(false);

  const shoppingListId = useStore(state => state.defaultShoppingList?.id);

  // Setup your GraphQL mutation using Apollo's useMutation hook.
  const [addItem, {loading, error}] = useMutation(ADD_ITEM_MUTATION, {
    onCompleted: () => {
      bottomSheetRef.current?.close();
      setQuery('');
      setSelectedItem(null);
    },
    onError: err => console.error(err),
  });

  // Open the bottom sheet when the component mounts or when isVisible changes.
  useEffect(() => {
    if (isVisible) {
      setRenderBottomSheet(true);
      bottomSheetRef.current?.expand();
    } else {
      bottomSheetRef.current?.close();
      setRenderBottomSheet(false);
    }
  }, [isVisible]);

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
      {renderBottomSheet && (
        <BottomSheet
          ref={bottomSheetRef}
          snapPoints={['50%', '75%']}
          onClose={onClose} // add this if supported!
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
