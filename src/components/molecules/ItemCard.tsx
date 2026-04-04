import React from 'react';
import { View, Text } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { Counter } from './Counter';
import { useRenderTime } from '#hooks/performance/useRenderTime';
import { CachedImage } from '#components/atoms/CachedImage';
import { Pressable } from 'react-native-gesture-handler';

interface ItemData {
  id: string;
  name?: string;
  itemName?: string;
  description?: string;
  quantity: number;
  unitName?: string;
  item?: {
    imageUrl?: string;
  };
}

type ItemCardProps = {
  item: ItemData;
  onPress: () => void;
  onIncrement: () => void;
  onDecrement: () => void;
};

const ItemCard: React.FC<ItemCardProps> = ({
  item,
  onPress,
  onIncrement,
  onDecrement,
}) => {
  useRenderTime('ItemCard');
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <CachedImage
        accessibilityLabel={item?.name}
        resizeMode="contain"
        uri={item?.item?.imageUrl || undefined}
        style={styles.cardImg}
        displaySize={68}
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
        {!!item?.unitName && (
          <Text style={styles.cardDescription}>{item?.unitName}</Text>
        )}
      </View>
    </Pressable>
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
    fontWeight: theme.fonts.weight.semibold,
    fontSize: theme.fonts.size.md,
    lineHeight: theme.typography.lineHeight.normal,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.xs,
  },
  cardDescription: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.fonts.weight.regular,
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
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));
export default ItemCard;
