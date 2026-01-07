import React from 'react';
import { View, Text, Image, TouchableOpacity } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { Counter } from './Counter';

type ItemCardProps = {
  item: any;
  onPress: () => void; // For item press action
  onIncrement: () => void;
  onDecrement: () => void;
  onMoreOptions?: () => void; // For ellipsis menu
  onRemove?: () => void; // For remove button
};

const ItemCard: React.FC<ItemCardProps> = ({
  item,
  onPress,
  onIncrement,
  onDecrement,
}) => {
  return (
    <TouchableOpacity key={item?.id} onPress={onPress} style={styles.card}>
      <Image
        alt={item?.name}
        resizeMode="contain"
        source={{ uri: item?.item?.imageUrl || undefined }}
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
        {/* unitName from server already includes item-specific display name
            with proper singular/plural form based on quantity */}
        {item?.unitName && (
          <Text style={styles.cardDescription}>{item?.unitName}</Text>
        )}
      </View>
    </TouchableOpacity>
  );
};
const styles = StyleSheet.create(theme => ({
  card: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderStyle: 'solid',
    borderRadius: theme.radii.md,
  },
  cardBody: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.md,
  },
  cardTitle: {
    fontWeight: '600',
    fontSize: theme.fonts.size.md,
    lineHeight: theme.typography.lineHeight.normal,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.xs,
  },
  cardDescription: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: '400',
    color: theme.colors.textSecondary,
  },
  cardImg: {
    width: 64,
    height: 68,
    alignSelf: 'center',
    borderRadius: theme.radii.md,
    marginLeft: theme.spacing.sm,
  },
  cardActions: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: theme.spacing['3'],
  },
}));
export default ItemCard;
