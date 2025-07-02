import React, {useEffect, useState, useMemo} from 'react';
import {GestureHandlerRootView} from 'react-native-gesture-handler';
import {createStyleSheet, useStyles} from 'react-native-unistyles';
import {ShoppingListItems} from '../components';
import SearchBar from '../components/molecules/SearchBar';
import {ShoppingListSelector} from '../components/organisms/ShoppingListSelector';
import AddButton from '../components/molecules/AddButton';
import {AddItemBottomSheet} from '../components';
import {useSearchableList} from '../hooks';
import {useStore} from '../store';

const ShoppingListScreen = () => {
  const {styles} = useStyles(stylesheet);
  const [showBottomSheet, setShowBottomSheet] = useState(false);

  const listIds = useStore(s => s.listIds);
  const selectedListId = useStore(s => s.selectedListId);
  const defaultList = useStore(s => s.getDefaultShoppingList());
  const fetchItemsForList = useStore(s => s.fetchItemsForList);

  // Ensure a selected list is set after lists are loaded
  useEffect(() => {
    if (!selectedListId && defaultList) {
      useStore.getState().selectList(defaultList.id);
    }
  }, [selectedListId, defaultList]);

  // Fetch items for the selected list
  useEffect(() => {
    console.log('ShoppingListScreen useEffect', {selectedListId});
    if (selectedListId) {
      fetchItemsForList(selectedListId);
    }
  }, [selectedListId, fetchItemsForList]);

  const allItemsByList = useStore(s => s.itemsByList);

  const itemsByList = useMemo(
    () =>
      selectedListId && allItemsByList[selectedListId]
        ? allItemsByList[selectedListId]
        : {byId: {}, allIds: []},
    [allItemsByList, selectedListId],
  );

  const shoppingListItems = useMemo(
    () => itemsByList.allIds.map(id => itemsByList.byId[id]),
    [itemsByList],
  );

  const {query, setQuery, filtered} = useSearchableList(
    shoppingListItems,
    (item, q) =>
      !!item.itemName && item.itemName.toLowerCase().includes(q.toLowerCase()),
  );

  useEffect(() => {
    if (selectedListId) fetchItemsForList(selectedListId);
  }, [selectedListId, fetchItemsForList]);

  const handleAdd = () => setShowBottomSheet(true);

  return (
    <GestureHandlerRootView style={styles.container}>
      <SearchBar
        value={query}
        onChangeText={setQuery}
        placeholder="Search items…"
        leftComponent={<ShoppingListSelector />}
        containerStyle={styles.searchBar}
        rightComponent={<AddButton onPress={handleAdd} />}
      />

      <ShoppingListItems data={filtered} />

      <AddItemBottomSheet
        isVisible={showBottomSheet}
        onClose={() => setShowBottomSheet(false)}
      />
    </GestureHandlerRootView>
  );
};

const stylesheet = createStyleSheet(theme => ({
  container: {flex: 1},
  searchBar: {},
}));

export default ShoppingListScreen;
