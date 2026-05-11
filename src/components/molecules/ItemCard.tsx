import React from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { Counter } from './Counter';
import { useRenderTime } from '#hooks/performance/useRenderTime';
import { CachedImage } from '#components/atoms/CachedImage';
import { Pressable } from '#components/atoms/themedComponents';
import { RIPPLE } from '#constants/ripple';
import { Text } from '#components/atoms/Text';

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
      android_ripple={RIPPLE.SUBTLE}
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
        <Text
          size="md"
          weight="semibold"
          lineHeight="normal"
          style={styles.cardTitle}
        >
          {item?.itemName}
        </Text>

        <Text size="sm" tone="secondary">
          {item?.description}
        </Text>
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
          <Text size="sm" tone="secondary">
            {item?.unitName}
          </Text>
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
    marginBottom: theme.spacing.xs,
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
