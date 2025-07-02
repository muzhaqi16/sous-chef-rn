import React from 'react';
import {FlatList, StyleSheet, View} from 'react-native';
import {useStore} from '../../store';
import {SwipeableShoppingListItem} from './SwipeableShoppingListItem';
import {ShoppingListItem} from '../../api/graphql/generated';

type ShoppingListItemsProps = {
  data?: ShoppingListItem[];
};

const ShoppingListItems = ({data}: ShoppingListItemsProps) => {
  const {addQuantity, removeQuantity, deleteFromList, moveToPantry} =
    useStore();
  const {getShoppingListItems, isLoading} = useStore();

  return (
    <View style={styles.container}>
      <FlatList
        data={data}
        keyExtractor={item => item.id}
        onRefresh={getShoppingListItems}
        refreshing={isLoading}
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
