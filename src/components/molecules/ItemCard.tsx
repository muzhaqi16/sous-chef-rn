import React from 'react';
import {View, Text, Image} from 'react-native';
import {createStyleSheet, useStyles} from 'react-native-unistyles';
import QuantitySelector from './QuantitySelector';
import IconButton from '../atoms/IconButton';

type ItemCardProps = {
  item: {
    name: string;
    barcode?: string;
    category?: string;
    imageUrl?: string;
  };
  quantity: number;
  weight: number | undefined;
  notes: string | undefined;
  onIncrement: () => void;
  onDecrement: () => void;
  onMoreOptions?: () => void; // For ellipsis menu
  onRemove?: () => void; // For remove button
};

const stylesheet = createStyleSheet(theme => ({
  container: {
    width: '100%',
    borderRadius: 12,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  leftSection: {
    flex: 1,
  },
  name: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.colors.typography,
    marginBottom: 4,
  },
  category: {
    fontSize: 14,
    color: theme.colors.placeholder,
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  moreIcon: {
    marginLeft: theme.spacing.sm,
  },
}));

const ItemCard: React.FC<ItemCardProps> = ({
  item: {name, barcode, category, imageUrl},
  quantity,
  weight,
  notes,
  onIncrement,
  onDecrement,
  onMoreOptions,
}) => {
  const {styles} = useStyles(stylesheet);
  return (
    <View style={styles.container}>
      <Image
        source={{uri: imageUrl}}
        style={{width: 50, height: 50, resizeMode: 'cover'}}
      />
      <View style={styles.leftSection}>
        <Text style={styles.name}>{name}</Text>
        <Text style={styles.category}>{weight}</Text>
      </View>
      <View style={styles.rightSection}>
        <QuantitySelector
          quantity={quantity}
          onIncrement={onIncrement}
          onDecrement={onDecrement}
        />
        {onMoreOptions && (
          <IconButton
            iconName="ellipsis-horizontal-circle-outline"
            onPress={onMoreOptions}
            style={styles.moreIcon}
          />
        )}
      </View>
    </View>
  );
};

export default ItemCard;
