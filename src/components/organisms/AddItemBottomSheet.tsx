import React, {useState} from 'react';
import {Text, View, TouchableOpacity} from 'react-native';
import {BottomSheetTextInput} from '@gorhom/bottom-sheet';
import {createStyleSheet, useStyles} from 'react-native-unistyles';
import Button from '../atoms/Button';
import Autocomplete from '../molecules/AutoComplete';
import {useStore} from '../../store';
import {
  useAddItemToShoppingListMutation,
  ItemSuggestion,
} from '../../graphql/generated';
import {type ShoppingListItemDetail} from '../../types';

interface AddItemProps {
  onGoToDetails: (item: ShoppingListItemDetail) => void;
  onAddItem: (item: ItemSuggestion) => void;
}

export const AddItemBottomSheet: React.FC<AddItemProps> = ({onGoToDetails}) => {
  const {styles} = useStyles(stylesheet);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<ItemSuggestion | null>(null);
  const shoppingListId = useStore(state => state.selectedShoppingListId);

  const [addItem] = useAddItemToShoppingListMutation({
    onCompleted: () => setSelected(null),
    onError: e => console.error('Add item error:', e),
  });

  // Only set selection; do NOT auto-add on select
  const handleSelect = (item: ItemSuggestion) => {
    setSelected(item);
    setQuery('');
  };

  // Determines if user has typed but not selected yet
  const typedReady = !selected && query.trim().length > 0;

  // Called when user presses Add button for typed input
  const handleTypedAdd = () => {
    addItem({
      variables: {
        data: {
          shoppingListId: shoppingListId || '',
          itemId: '',
          itemName: selected?.name || query.trim(),
          quantity: 1,
        },
      },
    });
  };

  // Called when user presses Add button for selected suggestion
  const handleAddSelected = () => {
    if (!selected) return;
    addItem({
      variables: {
        data: {
          shoppingListId: shoppingListId || '',
          itemId: selected.id || '',
          itemName: selected.name,
          quantity: 1,
        },
      },
    });
  };

  const openDetails = () => {
    if (!selected) return;
    onGoToDetails({
      id: selected.id || '',
      itemName: selected.name,
      quantity: 1,
      unit: selected?.units?.[0].unit.symbol || 'pcs',
      checked: false,
    });
    setSelected(null);
    setQuery('');
  };

  return (
    <>
      <BottomSheetTextInput
        placeholder="Type or choose item..."
        value={selected?.name || query}
        onChangeText={text => {
          setQuery(text);
          setSelected(null);
        }}
        style={styles.input}
      />

      <Autocomplete searchTerm={query} onSelectItem={handleSelect} />

      {(selected || typedReady) && (
        <View style={styles.row}>
          <Text style={styles.itemText}>{selected?.name || query.trim()}</Text>
          <View style={styles.rowActions}>
            <Button
              title="Add"
              onPress={selected ? handleAddSelected : handleTypedAdd}
            />
            <TouchableOpacity onPress={openDetails} style={styles.chevron}>
              <Text style={styles.chevronText}>{'>'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </>
  );
};

const stylesheet = createStyleSheet(theme => ({
  input: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderColor: '#eee',
  },
  itemText: {fontSize: 16, flex: 1},
  rowActions: {flexDirection: 'row', alignItems: 'center'},
  chevron: {marginLeft: 12, padding: 4},
  chevronText: {fontSize: 18, fontWeight: '600'},
}));

export default AddItemBottomSheet;
