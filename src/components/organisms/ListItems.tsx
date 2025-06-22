// src/components/organisms/ShoppingListItems.tsx
import React, {useEffect} from 'react';
import {FlatList, StyleSheet, View} from 'react-native';
import SwipeableRow from '../molecules/SwippeableRow';
import ItemCard from '../molecules/ItemCard';
import {GET_SHOPPING_LIST_ITEMS} from '../../api/graphql/queries/shoppingListItems';
import {useLazyQuery} from '@apollo/client';
import {useStore} from '../../store/useStore';

export interface ListItems {
  id: string;
  item: {
    id: string;
    name: string;
  };
  quantity: number;
  weight?: number;
  notes?: string;
}

const ShoppingListItems: React.FC = () => {
  const {defaultShoppingList} = useStore();

  // useLazyQuery for GET_SHOPPING_LIST_BY_ID; it won't run until triggered.
  const [getShoppingListItems, {data, loading, error, refetch}] = useLazyQuery(
    GET_SHOPPING_LIST_ITEMS,
  );

  useEffect(() => {
    if (defaultShoppingList) {
      getShoppingListItems({
        variables: {shoppingListId: defaultShoppingList.id},
      });
    }
  }, [defaultShoppingList, getShoppingListItems]);
  return (
    <View style={styles.container}>
      <FlatList
        data={data?.shoppingListItems}
        keyExtractor={item => item.id}
        onRefresh={refetch}
        refreshing={loading}
        renderItem={({item}) => (
          <SwipeableRow>
            <ItemCard
              item={item}
              onIncrement={() => () => {}}
              onDecrement={() => () => {}}
              onRemove={() => () => {}}
            />
          </SwipeableRow>
        )}
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: 24,
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
  },
  listContent: {
    // paddingBottom: 80,
  },
});

export default ShoppingListItems;
