import React, {useEffect} from 'react';
import {
  FlatList,
  StyleSheet,
  View,
  ActivityIndicator,
  Text,
} from 'react-native';
import {useLazyQuery} from '@apollo/client';
import {useStore} from '../../store/useStore';
import {GET_SHOPPING_LIST_ITEMS} from '../../api/graphql/queries/shoppingListItems';
import {SwipeableShoppingListItem} from './SwipeableShoppingListItem';

export interface ListItems {
  id: string;
  item: {id: string; name: string};
  quantity: number;
  weight?: number;
  notes?: string;
}

const ShoppingListItems: React.FC = () => {
  const {
    defaultShoppingList,
    addQuantity,
    removeQuantity,
    deleteFromList,
    moveToPantry,
  } = useStore();

  const [getItems, {data, loading, error, refetch}] = useLazyQuery(
    GET_SHOPPING_LIST_ITEMS,
  );

  useEffect(() => {
    if (defaultShoppingList) {
      getItems({variables: {shoppingListId: defaultShoppingList.id}});
    }
  }, [defaultShoppingList, getItems]);

  if (loading) return <ActivityIndicator style={{marginTop: 24}} />;
  if (error) return <Text style={styles.error}>Error loading items</Text>;

  return (
    <View style={styles.container}>
      <FlatList
        data={data?.shoppingListItems || []}
        keyExtractor={item => item.id}
        onRefresh={refetch}
        refreshing={loading}
        renderItem={({item}) => (
          <SwipeableShoppingListItem
            item={item}
            onIncrement={addQuantity}
            onDecrement={removeQuantity}
            onRemove={deleteFromList}
            onMoveToPantry={moveToPantry}
          />
        )}
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: 24,
    flex: 1,
  },
  listContent: {},
  error: {
    textAlign: 'center',
    color: 'red',
    marginTop: 24,
  },
});

export default ShoppingListItems;
