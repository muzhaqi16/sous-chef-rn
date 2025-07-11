import React from 'react';
import {View, Text, Image, TouchableOpacity} from 'react-native';
import {createStyleSheet, useStyles} from 'react-native-unistyles';
import {Counter} from './Counter';

type ItemCardProps = {
  item: any;
  onIncrement: () => void;
  onDecrement: () => void;
  onMoreOptions?: () => void; // For ellipsis menu
  onRemove?: () => void; // For remove button
};

const ItemCard: React.FC<ItemCardProps> = ({
  item,
  onIncrement,
  onDecrement,
  onMoreOptions,
}) => {
  // console.log('ItemCard shoppingListItem:', shoppingListItem);
  const {styles} = useStyles(stylesheet);
  return (
    <TouchableOpacity
      key={item?.id}
      onPress={() => {
        // handle onPress
      }}
      style={styles.card}>
      <Image
        alt={item?.name}
        resizeMode="contain"
        source={{uri: item?.item?.imageUrl || undefined}}
        style={styles.cardImg}
      />
      <View style={styles.cardBody}>
        <Text style={styles.cardTitle}>{item?.itemName}</Text>

        <Text style={styles.cardDescription}>{item?.description}</Text>
      </View>
      <View style={styles.cardActions}>
        <Counter
          count={item?.quantity}
          onIncrement={onIncrement}
          onDecrement={onDecrement}
        />
        {item?.unitSymbol &&
          // if quantity is higher than 1, show plural unit symbol
          (item?.quantity > 1 ? (
            <Text style={styles.cardDescription}>{item?.unitSymbol}s</Text>
          ) : (
            <Text style={styles.cardDescription}>{item?.unitSymbol}</Text>
          ))}
      </View>
    </TouchableOpacity>
  );
};
const stylesheet = createStyleSheet(theme => ({
  card: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#EFEFEF',
    borderStyle: 'solid',
    borderRadius: 12,
  },
  cardBody: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  cardTitle: {
    fontWeight: '600',
    fontSize: theme.fonts.size.md,
    lineHeight: 24,
    color: '#1d1d1d',
    marginBottom: 4,
  },
  cardDescription: {
    fontSize: 14,
    fontWeight: '400',
    color: '#706f7b',
  },
  cardImg: {
    width: 64,
    height: 68,
    alignSelf: 'center',
    borderRadius: 12,
    marginLeft: theme.spacing.sm,
  },
  cardActions: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: 12,
  },
}));
export default ItemCard;
