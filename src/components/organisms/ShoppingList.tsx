import React from 'react';
import {View, FlatList, Text} from 'react-native';
import ProductCard from '../molecules/ProductCard';
import {useStore} from '../../store';
import {createStyleSheet, useStyles} from 'react-native-unistyles';
import {useShoppingListItemsQuery} from '../../graphql/generated';

const ShoppingList = () => {
  const {styles} = useStyles(stylesheet);

  const {selectedShoppingListId} = useStore();
  const {data, loading, error} = useShoppingListItemsQuery({
    variables: {shoppingListId: selectedShoppingListId || ''},
  });

  const items = data?.shoppingListItems || [];
  console.log('src/organisms/ShoppingList.tsx:', items);
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Shopping List</Text>
      <FlatList
        data={items}
        keyExtractor={item => item.id}
        renderItem={({item}) => (
          <ProductCard
            name={item?.item?.name || 'Unknown Item'}
            price={0}
            onAddToCart={() => {}}
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
