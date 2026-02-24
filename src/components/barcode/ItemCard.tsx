import React from 'react';
import {View, Text} from 'react-native';
import {StyleSheet} from 'react-native-unistyles';
import {CachedImage} from '#components/atoms/CachedImage';

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
}

const formatWeight = (value: number): string => {
  const rounded = Math.round(value * 100) / 100;
  return parseFloat(rounded.toFixed(2)).toString();
};

export const ItemCard: React.FC<ItemCardProps> = ({item, format}) => {
  return (
    <View style={styles.itemCard}>
      {item.imageUrl ? (
        <CachedImage
          uri={item.imageUrl}
          style={styles.itemImage}
        />
      ) : (
        <View style={styles.placeholderImage}>
          <Text style={styles.placeholderText}>📦</Text>
        </View>
      )}

      <View style={styles.itemDetails}>
        <Text style={styles.itemName}>{item.name}</Text>
        {!!item.brandName && <Text style={styles.itemBrand}>{item.brandName}</Text>}
        {item.netWeight != null && (
          <Text style={styles.itemWeight}>
            {formatWeight(item.netWeight)}
            {item.displayUnit?.name ? ` ${item.displayUnit.name}` : ''}
          </Text>
        )}
        {!!item?.price && <Text style={styles.itemPrice}>${item?.price.toFixed(2)}</Text>}
        <Text style={styles.itemBarcode}>Barcode: {item.upc}</Text>
        {format ? <Text style={styles.itemFormat}>Format: {format}</Text> : null}
      </View>
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
}));
