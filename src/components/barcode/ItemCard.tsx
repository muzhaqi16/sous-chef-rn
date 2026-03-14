import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { CachedImage } from '#components/atoms/CachedImage';
import { Ionicons } from '@react-native-vector-icons/ionicons';

interface Item {
  id: string;
  name: string;
  brandName?: string;
  netWeight?: number;
  displayUnit?: {
    name?: string;
  };
  price?: number;
  upc: string;
  imageUrl?: string;
}

interface ItemCardProps {
  item: Item;
  format?: string;
  onEditItem?: () => void;
  onCreateVariant?: () => void;
}

const formatWeight = (value: number): string => {
  const rounded = Math.round(value * 100) / 100;
  return parseFloat(rounded.toFixed(2)).toString();
};

export const ItemCard: React.FC<ItemCardProps> = ({
  item,
  format,
  onEditItem,
  onCreateVariant,
}) => {
  const showActions = !!onEditItem || !!onCreateVariant;
  const { theme } = useUnistyles();

  return (
    <View style={styles.itemCard}>
      {item.imageUrl ? (
        <CachedImage
          uri={item.imageUrl}
          style={styles.itemImage}
          displaySize={200}
        />
      ) : (
        <View style={styles.placeholderImage}>
          <Text style={styles.placeholderText}>📦</Text>
        </View>
      )}

      <View style={styles.itemDetails}>
        <Text style={styles.itemName}>{item.name}</Text>
        {!!item.brandName && (
          <Text style={styles.itemBrand}>{item.brandName}</Text>
        )}
        {item.netWeight != null && (
          <Text style={styles.itemWeight}>
            {formatWeight(item.netWeight)}
            {item.displayUnit?.name ? ` ${item.displayUnit.name}` : ''}
          </Text>
        )}
        {!!item?.price && (
          <Text style={styles.itemPrice}>${item?.price.toFixed(2)}</Text>
        )}
        <Text style={styles.itemBarcode}>Barcode: {item.upc}</Text>
        {format ? (
          <Text style={styles.itemFormat}>Format: {format}</Text>
        ) : null}
      </View>

      {showActions ? (
        <View style={styles.actionsRow}>
          {!!onEditItem && (
            <Pressable style={styles.actionLink} onPress={onEditItem}>
              <Ionicons
                name="create-outline"
                size={16}
                color={theme.colors.primary}
              />
              <Text style={styles.actionText}>Suggest Edit</Text>
            </Pressable>
          )}
          {!!onEditItem && !!onCreateVariant && (
            <Text style={styles.actionSeparator}>·</Text>
          )}
          {!!onCreateVariant && (
            <Pressable style={styles.actionLink} onPress={onCreateVariant}>
              <Ionicons
                name="add-circle-outline"
                size={16}
                color={theme.colors.primary}
              />
              <Text style={styles.actionText}>New Version</Text>
            </Pressable>
          )}
        </View>
      ) : null}
    </View>
  );
};
const styles = StyleSheet.create(theme => ({
  itemCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.lg,
    padding: theme.spacing.lg,
    ...theme.shadows.md,
  },
  itemImage: {
    width: '100%',
    height: 200,
    borderRadius: theme.radii.md,
    marginBottom: theme.spacing.md,
  },
  placeholderImage: {
    width: '100%',
    height: 200,
    backgroundColor: theme.colors.backgroundSecondary,
    borderRadius: theme.radii.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  placeholderText: {
    fontSize: theme.sizes.avatar.lg,
  },
  itemDetails: {
    gap: theme.spacing.sm,
  },
  itemName: {
    fontSize: theme.fonts.size['2xl'],
    fontWeight: theme.fonts.weight.bold,
    color: theme.colors.textPrimary,
  },
  itemBrand: {
    fontSize: theme.fonts.size.md,
    color: theme.colors.textSecondary,
  },
  itemWeight: {
    fontSize: theme.fonts.size.md,
    color: theme.colors.textSecondary,
  },
  itemPrice: {
    fontSize: theme.fonts.size.xl,
    fontWeight: theme.fonts.weight.semibold,
    color: theme.colors.success,
  },
  itemBarcode: {
    fontSize: theme.fonts.size.sm,
    color: theme.colors.textSecondary,
    fontFamily: 'monospace',
  },
  itemFormat: {
    fontSize: theme.fonts.size.xs,
    color: theme.colors.textTertiary,
    textTransform: 'uppercase',
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: theme.spacing.md,
    paddingTop: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderLight,
  },
  actionLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.sm,
  },
  actionText: {
    fontSize: theme.fonts.size.sm,
    fontWeight: theme.fonts.weight.medium,
    color: theme.colors.primary,
  },
  actionSeparator: {
    fontSize: theme.fonts.size.md,
    color: theme.colors.textTertiary,
    marginHorizontal: theme.spacing.xs,
  },
}));
