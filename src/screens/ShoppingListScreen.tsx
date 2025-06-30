import React, {useState, useEffect} from 'react';
import {GestureHandlerRootView} from 'react-native-gesture-handler';
import {createStyleSheet, useStyles} from 'react-native-unistyles';
import {ShoppingListItems} from '../components';
import SearchBar from '../components/molecules/SearchBar';
import {ShoppingListSelector} from '../components/organisms/ShoppingListSelector';
import AddButton from '../components/molecules/AddButton';
import {AddItemBottomSheet} from '../components';
import {useSearchableList} from '../hooks';
import {useStore} from '../store/useStore';

const ShoppingListScreen = () => {
  const {styles} = useStyles(stylesheet);
  const [showBottomSheet, setShowBottomSheet] = useState(false);
  const {shoppingListItems, getShoppingListItems} = useStore();
  const {query, setQuery, filtered} = useSearchableList(
    shoppingListItems,
    (item, q) =>
      !!item?.itemName && item.itemName.toLowerCase().includes(q.toLowerCase()),
  );
  // trigger a refetch on mount
  useEffect(() => {
    getShoppingListItems();
  }, [shoppingListItems]);

  const handleAdd = () => {
    setShowBottomSheet(true);
  };
  return (
    <GestureHandlerRootView style={styles.container}>
      <SearchBar
        value={query}
        onChangeText={setQuery}
        placeholder="Search pantry…"
        leftComponent={<ShoppingListSelector />}
        containerStyle={styles.searchBar}
        rightComponent={<AddButton onPress={handleAdd} />}
      />
      <ShoppingListItems data={filtered} />
      <AddItemBottomSheet
        isVisible={showBottomSheet}
        onClose={() => {
          setShowBottomSheet(false);
        }}
      />
    </GestureHandlerRootView>
  );
};
const stylesheet = createStyleSheet(theme => ({
  container: {
    flex: 1,
  },
  searchBar: {},
}));
export default ShoppingListScreen;
