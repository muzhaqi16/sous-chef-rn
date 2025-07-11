import React, {useEffect} from 'react';
import {View} from 'react-native';
import {PickerSelect} from '../../components/atoms/Picker';
import {createStyleSheet, useStyles} from 'react-native-unistyles';
import {useShoppingListsQuery} from '../../graphql/generated';
import {useStore} from '../../store';

export const ShoppingListSelector = () => {
  const {styles} = useStyles(stylesheet);

  // 1) Get the global selectedListId and the setter
  const selectedListId = useStore(s => s.selectedShoppingListId);
  const setSelectedListId = useStore(s => s.setSelectedShoppingListId);

  // 2) Fetch all lists
  const {data, loading, error, refetch} = useShoppingListsQuery({
    fetchPolicy: 'cache-and-network',
  });
  const shoppingLists = data?.shoppingLists ?? [];

  // 3) On mount, if no selectedListId, pick the default or first
  useEffect(() => {
    if (shoppingLists.length === 0) return;
    // If nothing selected or the id no longer exists, pick a new one
    if (!selectedListId || !shoppingLists.some(l => l.id === selectedListId)) {
      const def = shoppingLists.find(l => l.isDefault);
      setSelectedListId(def?.id ?? shoppingLists[0].id);
    }
  }, [shoppingLists, selectedListId, setSelectedListId]);

  // 4) Render the picker
  return (
    <View style={styles.container}>
      <PickerSelect
        items={shoppingLists.map(list => ({
          id: list.id,
          name: list.name,
        }))}
        initialValue={selectedListId || ''}
        onValueChange={id => setSelectedListId(id)}
      />
    </View>
  );
};

const stylesheet = createStyleSheet(theme => ({
  container: {
    width: 44,
    height: 44,
    borderRadius: 12,
    marginLeft: theme.spacing.sm,
  },
}));

export default ShoppingListSelector;
