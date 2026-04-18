import React from 'react';
import { View } from 'react-native';
import { Pressable } from 'react-native-gesture-handler';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { Icon } from '#utils/iconUtils';
import { formatDistanceToNow } from 'date-fns/formatDistanceToNow';
import { useRenderTime } from '#hooks/performance/useRenderTime';
import { CachedImage } from '#components/atoms/CachedImage';
import { Text } from '#components/atoms/Text';

/**
 * Generic interface for recently deleted items
 * Works with both RecentPantryItem and RecentShoppingListItem
 */
export interface RecentItem {
  id: string;
  itemName?: string | null;
  createdAt?: string | null;
  item?: {
    imageUrl?: string | null;
  } | null;
}

interface ItemRecentCardProps<T extends RecentItem> {
  item: T;
  onQuickAdd: (item: T) => void;
  disabled?: boolean;
  /** Icon to show in placeholder when no image (default: 'cube-outline') */
  placeholderIcon?: 'cube-outline' | 'cart-outline';
}

export function ItemRecentCard<T extends RecentItem>({
  item,
  onQuickAdd,
  disabled,
  placeholderIcon = 'cube-outline',
}: ItemRecentCardProps<T>) {
  useRenderTime('ItemRecentCard');
  const { theme } = useUnistyles();

  // Format the time since the item was added
  const timeAgo = item.createdAt
    ? `Added ${formatDistanceToNow(new Date(item.createdAt), {
        addSuffix: false,
      })} ago`
    : '';

  // Get item image URL
  const imageUrl = item.item?.imageUrl;

  return (
    <View style={styles.container}>
      {/* Item Image or Placeholder */}
      <View style={styles.imageContainer}>
        {imageUrl ? (
          <CachedImage uri={imageUrl} style={styles.image} displaySize={48} />
        ) : (
          <View style={styles.imagePlaceholder}>
            <Icon
              name={placeholderIcon}
              size={24}
              color={theme.colors.primary}
            />
          </View>
        )}
      </View>

      {/* Item Info */}
      <View style={styles.info}>
        <Text
          size="base"
          weight="semibold"
          style={styles.itemName}
          numberOfLines={1}
        >
          {item.itemName ?? 'Unknown Item'}
        </Text>
        <Text size="sm" tone="secondary" numberOfLines={1}>
          {timeAgo}
        </Text>
      </View>

      {/* Quick Add Button */}
      <Pressable
        style={({ pressed }) => [
          styles.addButton,
          disabled && styles.addButtonDisabled,
          pressed && styles.pressed,
        ]}
        onPress={() => onQuickAdd(item)}
        disabled={disabled}
      >
        <Icon name="add" size={20} color={theme.colors.primary} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create(theme => ({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.md,
  },
  imageContainer: {
    width: 48,
    height: 48,
    borderRadius: theme.radii.md,
    overflow: 'hidden',
    marginRight: theme.spacing.md,
  },
  image: {
    width: 48,
    height: 48,
  },
  imagePlaceholder: {
    width: 48,
    height: 48,
    backgroundColor: theme.colors.surfaceVariant,
    borderRadius: theme.radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: {
    flex: 1,
    marginRight: theme.spacing.md,
  },
  itemName: {
    marginBottom: theme.spacing.xs,
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: theme.radii.full,
    backgroundColor: theme.colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonDisabled: {
    opacity: theme.opacity.disabled,
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));
