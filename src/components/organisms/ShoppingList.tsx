import React from 'react';
import {View, FlatList, Text} from 'react-native';
import ProductCard from '../molecules/ProductCard';
import {useStore} from '../../store';
import {StyleSheet} from 'react-native-unistyles';
import {useGetShoppingListItemsQuery} from '../../graphql/generated';

const ShoppingList = () => {
  const {selectedShoppingListId} = useStore();
  const {data, loading, error} = useGetShoppingListItemsQuery({
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

const styles = StyleSheet.create(theme => ({
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
