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
import {
  useShoppingListUpdatedSubscription,
  useShoppingListsQuery,
  useShoppingListItemsQuery,
} from '../graphql/generated';

const ShoppingListScreen = () => {
  const {styles} = useStyles(stylesheet);
  const [showBottomSheet, setShowBottomSheet] = useState(false);
  const selectedListId = useStore(s => s.selectedShoppingListId);
  const {data: shoppingListsData, refetch: refetchShoppingLists} =
    useShoppingListsQuery({
      fetchPolicy: 'cache-and-network',
      skip: false,
    });

  const {data: shoppingListItemsData} = useShoppingListItemsQuery({
    variables: {shoppingListId: selectedListId ?? ''},
    fetchPolicy: 'cache-and-network',
    skip: !selectedListId,
  });
  const shoppingLists = useMemo(
    () => shoppingListsData?.shoppingLists || [],
    [shoppingListsData],
  );

  const shoppingListItems = useMemo(
    () => shoppingListItemsData?.shoppingListItems || [],
    [shoppingListItemsData],
  );

  const {error} = useShoppingListUpdatedSubscription({
    variables: {listId: selectedListId ?? ''},
    skip: false,
  });

  console.log('ShoppingListScreen', error);
  // Ensure a selected list is set after lists are loaded

  // Fetch items for the selected list
  useEffect(() => {
    if (selectedListId) {
      refetchShoppingLists();
    }
  }, [selectedListId, refetchShoppingLists]);

  const {query, setQuery, filtered} = useSearchableList(
    shoppingListItems,
    (item, q) =>
      !!item.itemName && item.itemName.toLowerCase().includes(q.toLowerCase()),
  );

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
