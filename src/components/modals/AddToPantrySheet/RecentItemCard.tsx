import React from 'react';
import { View, Text, TouchableOpacity, Image } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { Icon } from '#utils';
import { GetRecentlyDeletedPantryItemsQuery } from '#generated';
import { formatDistanceToNow } from 'date-fns';

type RecentPantryItem = NonNullable<
  GetRecentlyDeletedPantryItemsQuery['recentlyDeletedPantryItems']
>[0];

interface RecentItemCardProps {
  item: RecentPantryItem;
  onQuickAdd: (item: RecentPantryItem) => void;
  disabled?: boolean;
}

export const RecentItemCard: React.FC<RecentItemCardProps> = ({
  item,
  onQuickAdd,
  disabled,
}) => {
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
          <Image source={{ uri: imageUrl }} style={styles.image} />
        ) : (
          <View style={styles.imagePlaceholder}>
            <Icon
              name="inventory-2"
              size={24}
              color={theme.colors.primary}
              library="MaterialIcons"
            />
          </View>
        )}
      </View>

      {/* Item Info */}
      <View style={styles.info}>
        <Text style={styles.itemName} numberOfLines={1}>
          {item.itemName}
        </Text>
        <Text style={styles.timeAgo} numberOfLines={1}>
          {timeAgo}
        </Text>
      </View>

      {/* Quick Add Button */}
      <TouchableOpacity
        style={[styles.addButton, disabled && styles.addButtonDisabled]}
        onPress={() => onQuickAdd(item)}
        disabled={disabled}
        activeOpacity={0.7}
      >
        <Icon
          name="add"
          size={20}
          color={theme.colors.primary}
          library="MaterialIcons"
        />
      </TouchableOpacity>
    </View>
  );
};

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
    resizeMode: 'cover',
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
    fontSize: theme.fonts.size.base,
    fontWeight: theme.fonts.weight.semibold,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.xs,
  },
  timeAgo: {
    fontSize: theme.fonts.size.sm,
    color: theme.colors.textSecondary,
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
    opacity: 0.5,
  },
}));
