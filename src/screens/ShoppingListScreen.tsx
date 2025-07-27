import React, {useState, useRef, useMemo, useCallback} from 'react';
import {View} from 'react-native';
import {BottomSheetModal} from '@gorhom/bottom-sheet';
import {
  ActionButton,
  SearchBar,
  ShoppingListItems,
  ShoppingListSelector,
  AddItemBottomSheet,
  ItemDetailBottomSheet,
  BottomSheetAction,
} from '../components';
import {useStore} from '../store';
import {useSearchableList} from '../hooks';
import {
  ShoppingListItem,
  useShoppingListItemsQuery,
  useShoppingListUpdatedSubscription,
} from '../graphql/generated';
import {createStyleSheet, useStyles} from 'react-native-unistyles';

export const ShoppingListScreen: React.FC = () => {
  const {styles} = useStyles(stylesheet);

  const listId = useStore(s => s.selectedShoppingListId);
  const [detailItem, setDetailItem] = useState<ShoppingListItem | null>(null);

  // fetch + subscribe
  const {data, refetch} = useShoppingListItemsQuery({
    variables: {shoppingListId: listId ?? ''},
    skip: !listId,
    fetchPolicy: 'cache-and-network',
  });
  useShoppingListUpdatedSubscription({
    variables: {listId: listId!},
    skip: !listId,
    onData: () => refetch(),
  });
  const items = data?.shoppingListItems || [];

  // search
  const {query, setQuery, filtered} = useSearchableList(
    items,
    (it, q) =>
      !!it.itemName && it.itemName.toLowerCase().includes(q.toLowerCase()),
  );

  // bottom sheet refs
  const selectRef = useRef<BottomSheetModal>(null);
  const addRef = useRef<BottomSheetModal>(null);
  const detailRef = useRef<BottomSheetModal>(null);

  // open handlers
  const openSelect = useCallback(() => selectRef.current?.present(), []);
  const openAdd = useCallback(() => addRef.current?.present(), []);
  const openDetail = useCallback((item: ShoppingListItem) => {
    setDetailItem(item);
    detailRef.current?.present();
  }, []);

  // bottom sheet content renderers
  const renderSelectContent = useCallback(
    () => (
      <ShoppingListSelector
        onSelect={id => {
          useStore.getState().setSelectedShoppingListId(id);
          selectRef.current?.dismiss();
        }}
      />
    ),
    [],
  );

  const renderAddContent = useCallback(
    () => (
      <AddItemBottomSheet
        onGoToDetails={item => {
          addRef.current?.dismiss();
          setTimeout(() => {
            setDetailItem(item);
            detailRef.current?.present();
          }, 200);
        }}
      />
    ),
    [],
  );

  const renderDetailContent = useMemo(
    () =>
      detailItem && (
        <ItemDetailBottomSheet
          item={detailItem}
          onClose={() => detailRef.current?.dismiss()}
        />
      ),
    [detailItem],
  );

  return (
    <View style={styles.container}>
      <SearchBar
        value={query}
        onChangeText={setQuery}
        placeholder="Search items…"
        leftComponent={
          <ActionButton
            name="list"
            onPress={openSelect}
            style={styles.listButton}
            color="#fff"
          />
        }
        rightComponent={
          <ActionButton
            name="add"
            onPress={openAdd}
            style={styles.addButton}
            color="#000"
          />
        }
      />

      <ShoppingListItems data={filtered} onItemPress={openDetail} />

      {/* Select List Sheet */}
      <BottomSheetAction
        sheetRef={selectRef}
        sheetTitle="Select Shopping List"
        snapPoints={['25%', '50%', '90%']}>
        {renderSelectContent()}
      </BottomSheetAction>

      {/* Add Item Sheet */}
      <BottomSheetAction
        sheetRef={addRef}
        sheetTitle="Add Item"
        snapPoints={['50%', '90%']}>
        {renderAddContent()}
      </BottomSheetAction>

      {/* Edit Item Sheet */}
      <BottomSheetAction
        sheetRef={detailRef}
        sheetTitle="Item Details"
        snapPoints={['50%', '90%']}>
        {renderDetailContent}
      </BottomSheetAction>
    </View>
  );
};

const stylesheet = createStyleSheet(theme => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  listButton: {
    backgroundColor: theme.colors.primary,
  },
  addButton: {
    backgroundColor: theme.colors.white,
  },
}));

export default ShoppingListScreen;
