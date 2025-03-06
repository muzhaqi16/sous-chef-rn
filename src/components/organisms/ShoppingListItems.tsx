// src/components/organisms/ShoppingListItems.tsx
import React, {useEffect} from 'react';
import {FlatList, StyleSheet} from 'react-native';
import SwipeableRow from '../molecules/SwippeableRow';
import ItemCard from '../molecules/ItemCard';
import {GET_SHOPPING_LIST_ITEMS} from '../../api/queries';
import {useQuery, useLazyQuery} from '@apollo/client';
import {useStore} from '../../store/useStore';

export interface ShoppingListItem {
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
      getShoppingListItems({variables: {id: defaultShoppingList.id}});
    }
  }, [defaultShoppingList, getShoppingListItems]);
  return (
    <FlatList
      data={data?.shoppingList?.shoppingListItems}
      keyExtractor={item => item.id}
      onRefresh={refetch}
      refreshing={loading}
      renderItem={({item}) => (
        <SwipeableRow>
          <ItemCard
            item={item.item}
            quantity={item.quantity}
            weight={item.weight}
            notes={item.notes}
            onIncrement={() => () => {}}
            onDecrement={() => () => {}}
            onRemove={() => () => {}}
          />
        </SwipeableRow>
      )}
      contentContainerStyle={styles.listContent}
    />
  );
};

const styles = StyleSheet.create({
  listContent: {
    paddingBottom: 80,
  },
});

export default ShoppingListItems;
