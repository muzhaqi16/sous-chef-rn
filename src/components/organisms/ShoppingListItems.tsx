import React from 'react';
import {FlatList, View} from 'react-native';
import {createStyleSheet, useStyles} from 'react-native-unistyles';
import {useStore} from '../../store';
import {SwipeableShoppingListItem} from './SwipeableShoppingListItem';
import {useShoppingListItemsQuery} from '../../graphql/generated';
import {type ShoppingListItemDetail} from '../../types';

export interface ShoppingListItemsProps {
  data: any[];
  onItemPress: (item: ShoppingListItemDetail) => void;
}

export const ShoppingListItems: React.FC<ShoppingListItemsProps> = ({
  data,
  onItemPress,
}) => {
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
        data={data}
        keyExtractor={item => item.id}
        onRefresh={() => {
          if (selectedListId) {
            refetch({shoppingListId: selectedListId});
          }
        }}
        refreshing={isLoading}
        showsVerticalScrollIndicator={false}
        renderItem={({item}) => (
          <SwipeableShoppingListItem
            item={item}
            onPress={() => onItemPress(item)}
          />
        )}
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
};

const stylesheet = createStyleSheet(theme => ({
  container: {flex: 1},
  listContent: {},
}));

export default ShoppingListItems;
