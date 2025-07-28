import React, {useState} from 'react';
import {View} from 'react-native';
import {createStyleSheet, useStyles} from 'react-native-unistyles';
import {
  SearchBar,
  ShoppingListItems,
  ShoppingListSelector,
  AddItemBottomSheet,
  ItemDetailBottomSheet,
  BottomSheetAction,
} from '../components';
import {useStore} from '../store';
import {useBottomSheetModal, useShoppingList} from '../hooks';
import {type ShoppingListItemDetail} from '../types';
import {UserHeader} from '../components/molecules/UserHeader';

export const ShoppingListScreen: React.FC = () => {
  const {styles, theme} = useStyles(stylesheet);

  const listId = useStore(s => s.selectedShoppingListId);
  const {items, query, setQuery} = useShoppingList(listId);
  const [detailItem, setDetailItem] = useState<ShoppingListItemDetail | null>(
    null,
  );

  // bottom sheet refs
  const selectSheet = useBottomSheetModal();
  const addSheet = useBottomSheetModal();
  const detailSheet = useBottomSheetModal();

  const bottomSheets = [
    {
      key: 'select',
      sheet: selectSheet,
      title: 'Select Shopping List',
      snapPoints: ['25%', '50%', '90%'],
      content: (
        <ShoppingListSelector
          onSelect={id => {
            useStore.getState().setSelectedShoppingListId(id);
            selectSheet.close();
          }}
        />
      ),
    },
    {
      key: 'add',
      sheet: addSheet,
      title: 'Add Item',
      snapPoints: ['50%', '90%'],
      content: (
        <AddItemBottomSheet
          onGoToDetails={item => {
            addSheet.close();
            setTimeout(() => {
              setDetailItem(item);
              detailSheet.open();
            }, 200);
          }}
        />
      ),
    },
  ];
  const onItemPress = (item: ShoppingListItemDetail) => {
    setDetailItem(item);
    detailSheet.open();
  };
  return (
    <View style={styles.container}>
      <UserHeader />

      <SearchBar
        value={query}
        onChangeText={setQuery}
        placeholder="Search items…"
        onPressList={() => selectSheet.open()}
        onPressAdd={() => addSheet.open()}
      />

      <ShoppingListItems data={items} onItemPress={onItemPress} />

      {bottomSheets.map(({key, sheet, title, snapPoints, content}) => (
        <BottomSheetAction
          key={key}
          sheetRef={sheet.ref}
          sheetTitle={title}
          snapPoints={snapPoints}>
          {content}
        </BottomSheetAction>
      ))}

      {detailItem && (
        <BottomSheetAction
          sheetRef={detailSheet.ref}
          sheetTitle="Item Details"
          snapPoints={['45%', '65%']}>
          <ItemDetailBottomSheet
            item={detailItem}
            onClose={detailSheet.close}
          />
        </BottomSheetAction>
      )}
    </View>
  );
};

const stylesheet = createStyleSheet(theme => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
}));

export default ShoppingListScreen;
