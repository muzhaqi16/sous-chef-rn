import React from 'react';
import {View, Text, Image, TouchableOpacity} from 'react-native';
import {createStyleSheet, useStyles} from 'react-native-unistyles';
import {Counter} from './Counter';

type ItemCardProps = {
  shoppingListItem: {
    id: string;
    weight?: number;
    notes?: string;
    expirationDate: string;
    item: {
      id: string;
      name: string;
      barcode?: string;
      category?: {
        name: string;
      };
      price: number;
      type?: string;
      unit?: string;
      shelfLife?: string;
      description?: string;
      imageUrl?: string;
      quantity: number;
      weight: number | undefined;
      notes: string | undefined;
    };
    quantity: number;
  };

  onIncrement: () => void;
  onDecrement: () => void;
  onMoreOptions?: () => void; // For ellipsis menu
  onRemove?: () => void; // For remove button
};

const ItemCard: React.FC<ItemCardProps> = ({
  shoppingListItem,
  onIncrement,
  onDecrement,
  onMoreOptions,
}) => {
  // console.log('ItemCard shoppingListItem:', shoppingListItem);
  const {styles} = useStyles(stylesheet);
  const {item} = shoppingListItem;
  return (
    <TouchableOpacity
      key={shoppingListItem.id}
      onPress={() => {
        // handle onPress
      }}
      style={styles.card}>
      <Image
        alt={item.name}
        resizeMode="cover"
        source={{uri: item.imageUrl}}
        style={styles.cardImg}
      />
      <View style={styles.cardBody}>
        <Text style={styles.cardTitle}>{item.name}</Text>

        <Text style={styles.cardDescription}>{item.description}</Text>

        <Text style={styles.cardPrice}>
          ${item?.price?.toLocaleString('en-US')}
        </Text>
      </View>
      <Counter
        count={shoppingListItem.quantity}
        onIncrement={onIncrement}
        onDecrement={onDecrement}
      />
      {/* show unit */}
      {item.unit && (
        <Text style={styles.cardDescription}>
          {item.quantity} {item.unit}
        </Text>
      )}
      {/* show weight if available */}
      {item.weight && (
        <Text style={styles.cardDescription}>
          {item.weight} {item.unit || 'kg'}
        </Text>
      )}
    </TouchableOpacity>
  );
};
const stylesheet = createStyleSheet(theme => ({
  card: {
    position: 'relative',
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#EFEFEF',
    borderStyle: 'solid',
    borderRadius: 12,
    marginBottom: 12,
  },
  cardBody: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
    flexDirection: 'column',
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  cardTitle: {
    fontWeight: '600',
    fontSize: 17,
    lineHeight: 24,
    color: '#1d1d1d',
    marginBottom: 4,
  },
  cardDescription: {
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 16,
    marginBottom: 6,
    color: '#706f7b',
  },
  cardPrice: {
    fontWeight: '700',
    fontSize: 14,
  },
  cardImg: {
    width: 120,
    height: '100%',
    borderRadius: 12,
  },
}));
export default ItemCard;
