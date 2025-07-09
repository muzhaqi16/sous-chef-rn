import React from 'react';
import {FlatList, StyleSheet, View} from 'react-native';
import {useStore} from '../../store';
import {SwipeableShoppingListItem} from './SwipeableShoppingListItem';
import {ShoppingListItem} from '../../api/graphql/generated';
import {createStyleSheet, useStyles} from 'react-native-unistyles';

type ShoppingListItemsProps = {
  data?: ShoppingListItem[];
};

const ShoppingListItems = ({data}: ShoppingListItemsProps) => {
  const {styles} = useStyles(stylesheet);

  const {fetchItemsForList, isLoading} = useStore();

  return (
    <View style={styles.container}>
      <FlatList
        data={data}
        keyExtractor={item => item.id}
        onRefresh={() => {
          if (data && data.length > 0) {
            fetchItemsForList(data[0].shoppingListId);
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
