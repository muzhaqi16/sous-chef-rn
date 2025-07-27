import React from 'react';
import {TouchableOpacity, Text} from 'react-native';
import {createStyleSheet, useStyles} from 'react-native-unistyles';
import {SwipeableRow} from '../molecules/SwipeableRow';
import ItemCard from '../molecules/ItemCard';
import {
  ShoppingListItem,
  useUpdateShoppingListItemMutation,
} from '../../graphql/generated';

export interface SwipeableShoppingListItemProps {
  onPress: () => void;
  item: ShoppingListItem;
}

export const SwipeableShoppingListItem: React.FC<
  SwipeableShoppingListItemProps
> = ({item, onPress}) => {
  const {styles} = useStyles(stylesheet);

  const [updateItem] = useUpdateShoppingListItemMutation({
    onCompleted: () => {
      // Optionally handle completion
    },
    onError: error => {
      console.error('Update error:', error);
    },
  });

  const handleUpdate = (id: string, quantity: number) => {
    updateItem({
      variables: {
        id,
        data: {
          quantity,
        },
      },
    });
  };

  const renderLeftActions = () => (
    <TouchableOpacity style={styles.leftAction} onPress={() => {}}>
      <Text style={styles.leftActionText}>－</Text>
    </TouchableOpacity>
  );

  const renderRightActions = () => (
    <TouchableOpacity style={styles.rightAction} onPress={() => {}}>
      <Text style={styles.rightActionText}>🗑️</Text>
    </TouchableOpacity>
  );

  return (
    <SwipeableRow
      renderLeftActions={renderLeftActions}
      renderRightActions={renderRightActions}
      containerStyle={styles.rowContainer}>
      <ItemCard
        item={item}
        onIncrement={() => handleUpdate(item.id, (item?.quantity ?? 0) + 1)}
        onDecrement={() =>
          handleUpdate(item.id, Math.max(1, (item?.quantity ?? 1) - 1))
        }
        onRemove={() => {}}
        onPress={onPress}
      />
    </SwipeableRow>
  );
};

const stylesheet = createStyleSheet(theme => ({
  rowContainer: {
    marginVertical: 8,
    marginHorizontal: 16,
    borderRadius: 12,
    backgroundColor: theme.colors.surface,
    // ios shadow
    shadowColor: theme.colors.black,
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
    // android
    elevation: 2,
  },
  leftAction: {
    // Add flex:1 if you want the left action to take full width
    justifyContent: 'center',
    backgroundColor: theme.colors.success,
    paddingHorizontal: 20,
  },
  rightAction: {
    justifyContent: 'center',
    alignItems: 'flex-end',
    backgroundColor: theme.colors.error,
    paddingHorizontal: 20,
  },
  leftActionText: {
    color: theme.colors.onSuccess,
    fontSize: 18,
    fontWeight: '600',
  },
  rightActionText: {
    color: theme.colors.onError,
    fontSize: 18,
    fontWeight: '600',
  },
}));
