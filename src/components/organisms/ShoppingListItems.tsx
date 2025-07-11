import React from 'react';
import {FlatList, View} from 'react-native';
import {useStore} from '../../store';
import {SwipeableShoppingListItem} from './SwipeableShoppingListItem';
import {useShoppingListItemsQuery} from '../../graphql/generated';
import {createStyleSheet, useStyles} from 'react-native-unistyles';

export const ShoppingListItems = ({data}: any) => {
  const {styles} = useStyles(stylesheet);
  const selectedListId = useStore(s => s.selectedShoppingListId);
  const {refetch, loading: isLoading} = useShoppingListItemsQuery({
    variables: {shoppingListId: selectedListId ?? ''},
    fetchPolicy: 'cache-and-network',
    skip: !selectedListId,
  });

  return (
    <View style={styles.container}>
      <FlatList
        data={data || []}
        onEndReachedThreshold={0.5}
        keyExtractor={item => item.id}
        onRefresh={() => {
          if (selectedListId) {
            refetch({
              shoppingListId: selectedListId,
            });
          }
        }}
        showsVerticalScrollIndicator={false}
        refreshing={isLoading}
        renderItem={({item}) => (
          <SwipeableShoppingListItem
            item={item}
            onIncrement={() => {}}
            onDecrement={() => {}}
            onRemove={() => {}}
            onMoveToPantry={() => {}}
          />
        )}
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
};

const stylesheet = createStyleSheet(theme => ({
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
}));

export default ShoppingListItems;
