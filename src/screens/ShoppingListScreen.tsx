import React, {useEffect, useMemo} from 'react';
import {View} from 'react-native';
import {createStyleSheet, useStyles} from 'react-native-unistyles';
import SearchBar from '../components/molecules/SearchBar';
import {
  AddItemBottomSheet,
  ShoppingListSelector,
  ShoppingListItems,
} from '../components';
import {useSearchableList} from '../hooks';
import {useStore} from '../store';
import {
  useShoppingListUpdatedSubscription,
  useShoppingListsQuery,
  useShoppingListItemsQuery,
} from '../graphql/generated';

const ShoppingListScreen = () => {
  const {styles} = useStyles(stylesheet);
  const selectedListId = useStore(s => s.selectedShoppingListId);
  const {refetch: refetchShoppingLists} = useShoppingListsQuery({
    fetchPolicy: 'cache-and-network',
    skip: false,
  });

  const {data: shoppingListItemsData, refetch: refetchShoppingListItems} =
    useShoppingListItemsQuery({
      variables: {shoppingListId: selectedListId ?? ''},
      fetchPolicy: 'cache-and-network',
      skip: !selectedListId,
    });

  const shoppingListItems = useMemo(
    () => shoppingListItemsData?.shoppingListItems || [],
    [shoppingListItemsData],
  );

  const {data: updated, error: subError} = useShoppingListUpdatedSubscription({
    variables: {listId: selectedListId!},
    skip: !selectedListId, // ← don’t subscribe until you have an ID
    onData: ({data}) => {
      // this callback fires whenever a new payload arrives
      if (data) {
        // trigger a refetch of ITEMS (or merge manually, see next section)
        refetchShoppingListItems();
      }
    },
    onError: error => {
      console.error('ShoppingListUpdatedSubscription error:', error);
    },
  });

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

  return (
    <View style={styles.container}>
      <SearchBar
        value={query}
        onChangeText={setQuery}
        placeholder="Search items…"
        leftComponent={<ShoppingListSelector />}
        containerStyle={styles.searchBar}
        rightComponent={<AddItemBottomSheet />}
      />

      <ShoppingListItems data={filtered} />
    </View>
  );
};

const stylesheet = createStyleSheet(theme => ({
  container: {flex: 1},
  searchBar: {},
}));

export default ShoppingListScreen;
