import React from 'react';
import {TouchableOpacity, Text, FlatList} from 'react-native';
import {ShoppingList, useShoppingListsQuery} from '../../graphql/generated';
import {useStore} from '../../store';
import {createStyleSheet, useStyles} from 'react-native-unistyles';
import {BottomSheetAction} from '../templates/BottomSheetAction';
import {ActionButton} from '../molecules';

export const ShoppingListSelector = () => {
  const {styles, theme} = useStyles(stylesheet);
  const ref =
    React.useRef<import('@gorhom/bottom-sheet').BottomSheetModal>(null);
  // Zustand store hooks
  const {selectedShoppingListId, setSelectedShoppingListId} = useStore();

  // Query your shopping lists
  const {data} = useShoppingListsQuery({fetchPolicy: 'cache-and-network'});
  const shoppingLists = data?.shoppingLists ?? [];

  // Select a shopping list
  const selectList = (id: string) => {
    setSelectedShoppingListId(id);
  };

  // Render list item
  const renderItem = ({item}: {item: ShoppingList}) => (
    <TouchableOpacity style={[styles.item]} onPress={() => selectList(item.id)}>
      <Text
        style={[
          styles.itemText,
          item.id === selectedShoppingListId && styles.selectedItemText,
        ]}>
        {item.name}
      </Text>
    </TouchableOpacity>
  );

  return (
    <>
      <ActionButton
        name={'list'}
        onPress={() => ref.current?.present()}
        style={styles.button}
        color={theme.colors.white}
      />
      <BottomSheetAction
        snapPoints={['35%', '50%', '75%']}
        sheetRef={ref}
        sheetTitle="Select Shopping List">
        <FlatList
          data={shoppingLists}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          keyboardShouldPersistTaps="handled"
        />
      </BottomSheetAction>
    </>
  );
};

const stylesheet = createStyleSheet(theme => ({
  button: {
    backgroundColor: theme.colors.primary,
  },
  item: {
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 8,
    marginBottom: 6,
    backgroundColor: '#f2f2f2',
  },
  itemText: {
    fontSize: 16,
  },
  selectedItemText: {
    fontWeight: 'bold',
    color: theme.colors.primary ?? 'red',
  },
}));

export default ShoppingListSelector;
