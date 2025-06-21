import React, {useEffect} from 'react';
import {View, FlatList, Text} from 'react-native';
import ProductCard from '../molecules/ProductCard';
import {useStore} from '../../store/useStore.ts';
import {createStyleSheet, useStyles} from 'react-native-unistyles';

const ShoppingList = () => {
  const {styles} = useStyles(stylesheet);
  const {items, fetchItems, addItem, defaultShoppingList} = useStore();
  useEffect(() => {
    if (!defaultShoppingList?.id) {
      console.log('No default shopping list found');
      return;
    }
    fetchItems({
      shoppingListId: defaultShoppingList?.id,
    });
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Shopping List</Text>
      <FlatList
        data={items}
        keyExtractor={item => item.id}
        renderItem={({item}) => (
          <ProductCard
            name={item.name}
            price={item.price}
            onAddToCart={() => addItem(item.name, 1)}
          />
        )}
      />
    </View>
  );
};

const stylesheet = createStyleSheet(theme => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    padding: 16,
  },
  title: {
    color: theme.colors.textPrimary,
    textAlign: 'center',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
  },
}));

export default ShoppingList;
