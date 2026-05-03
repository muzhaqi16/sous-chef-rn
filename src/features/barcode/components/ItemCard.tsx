import React from 'react';
import { View } from 'react-native';
import { Pressable } from 'react-native-gesture-handler';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { CachedImage } from '#components/atoms/CachedImage';
import { Ionicons } from '@react-native-vector-icons/ionicons';
import { Text } from '#components/atoms/Text';

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
        <Text size="2xl" weight="bold">
          {item.name}
        </Text>
        {!!item.brandName && (
          <Text size="md" tone="secondary">
            {item.brandName}
          </Text>
        )}
        {item.netWeight != null && (
          <Text size="md" tone="secondary">
            {formatWeight(item.netWeight)}
            {item.displayUnit?.name ? ` ${item.displayUnit.name}` : ''}
          </Text>
        )}
        {!!item?.price && (
          <Text size="xl" weight="semibold" tone="success">
            ${item?.price.toFixed(2)}
          </Text>
        )}
        <Text size="sm" tone="secondary" style={styles.itemBarcode}>
          Barcode: {item.upc}
        </Text>
        {format ? (
          <Text size="xs" tone="tertiary" style={styles.itemFormat}>
            Format: {format}
          </Text>
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
              <Text size="sm" weight="medium" tone="accent">
                Suggest Edit
              </Text>
            </Pressable>
          )}
          {!!onEditItem && !!onCreateVariant && (
            <Text size="md" tone="tertiary" style={styles.actionSeparator}>
              ·
            </Text>
          )}
          {!!onCreateVariant && (
            <Pressable style={styles.actionLink} onPress={onCreateVariant}>
              <Ionicons
                name="add-circle-outline"
                size={16}
                color={theme.colors.primary}
              />
              <Text size="sm" weight="medium" tone="accent">
                New Version
              </Text>
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
  itemBarcode: {
    fontFamily: 'monospace',
  },
  itemFormat: {
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
  actionSeparator: {
    marginHorizontal: theme.spacing.xs,
  },
}));
