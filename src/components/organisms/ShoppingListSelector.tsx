import {useEffect} from 'react';
import {View} from 'react-native';
import {PickerSelect} from '../../components/atoms/Picker';
import {useStore} from '../../store';
import {createStyleSheet, useStyles} from 'react-native-unistyles';

export const ShoppingListSelector = () => {
  const {listById, listIds, fetchLists, getDefaultShoppingList, selectList} =
    useStore();
  const shoppingLists = listIds.map(id => listById[id]);
  const defaultShoppingList = getDefaultShoppingList();
  // Fetch shopping lists when the component mounts
  // This ensures that the shopping lists are available when the component is rendered
  useEffect(() => {
    fetchLists();
  }, []);

  // Trigger fetching items when the default shopping list changes
  useEffect(() => {
    if (defaultShoppingList) {
      fetchLists();
    }
  }, [defaultShoppingList, fetchLists]);
  const {styles} = useStyles(stylesheet);

  return (
    <View style={styles.container}>
      <PickerSelect
        items={shoppingLists?.map((list: any) => ({
          id: list.id,
          name: list.name,
        }))}
        initialValue={defaultShoppingList?.id || ''}
        onValueChange={id => {
          const selectedList = shoppingLists?.find(list => list.id === id);
          if (selectedList) {
            selectList(selectedList.id);
          } else {
            // Optionally handle the error, e.g. show an error message or fallback logic
            console.error('No shopping list found for id:', id);
          }
        }}
      />
    </View>
  );
};

const stylesheet = createStyleSheet(theme => ({
  container: {
    width: 44,
    height: 44,
    borderRadius: 12,
    marginLeft: theme.spacing.margin.sm,
    // backgroundColor: theme.colors.primary,
  },
}));

export default ShoppingListSelector;
