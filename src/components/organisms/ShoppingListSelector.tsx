import {useEffect} from 'react';
import {View} from 'react-native';
import {PickerSelect} from '../../components/atoms/Picker';
import {useStore} from '../../store/useStore';
import {createStyleSheet, useStyles} from 'react-native-unistyles';

export const ShoppingListSelector = () => {
  const {
    defaultShoppingList,
    setDefaultShoppingList,
    shoppingLists,
    fetchShoppingLists,
    getShoppingListItems,
  } = useStore();

  // Fetch shopping lists when the component mounts
  // This ensures that the shopping lists are available when the component is rendered
  useEffect(() => {
    fetchShoppingLists();
  }, []);

  // Trigger fetching items when the default shopping list changes
  useEffect(() => {
    if (defaultShoppingList) {
      getShoppingListItems();
    }
  }, [defaultShoppingList, getShoppingListItems]);
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
            setDefaultShoppingList(selectedList);
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
    backgroundColor: theme.colors.primary,
  },
}));

export default ShoppingListSelector;
