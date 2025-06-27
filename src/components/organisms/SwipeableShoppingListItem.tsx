import React from 'react';
import {TouchableOpacity, Text} from 'react-native';
import {createStyleSheet, useStyles} from 'react-native-unistyles';
import {SwipeableRow} from '../molecules/SwippeableRow';
import ItemCard from '../molecules/ItemCard';
import {ShoppingListItem} from '../../api/graphql/generated';

export interface SwipeableShoppingListItemProps {
  item: ShoppingListItem;
  onIncrement: (id: string) => void;
  onDecrement: (id: string) => void;
  onRemove: (id: string) => void;
  onMoveToPantry?: (id: string) => void;
}

export const SwipeableShoppingListItem: React.FC<
  SwipeableShoppingListItemProps
> = ({item, onIncrement, onDecrement, onRemove}) => {
  const {styles} = useStyles(stylesheet);

  const renderLeftActions = () => (
    <TouchableOpacity
      style={styles.leftAction}
      onPress={() => onDecrement(item.id)}>
      <Text style={styles.leftActionText}>－</Text>
    </TouchableOpacity>
  );

  const renderRightActions = () => (
    <TouchableOpacity
      style={styles.rightAction}
      onPress={() => onRemove(item.id)}>
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
        onIncrement={() => onIncrement(item.id)}
        onDecrement={() => onDecrement(item.id)}
        onRemove={() => onRemove(item.id)}
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
    flex: 1,
    justifyContent: 'center',
    backgroundColor: theme.colors.success,
    paddingHorizontal: 20,
  },
  rightAction: {
    flex: 1,
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
