import React from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Pressable } from '#components/atoms/themedComponents';
import { StyleSheet } from 'react-native-unistyles';
import { CachedImage } from '#components/atoms/CachedImage';
import { Icon } from '#utils/iconUtils';
import { Text } from '#components/atoms/Text';
import { formatQuantity } from '#utils/formatQuantity';

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
  /** "Suggest Edit" for a public catalog item, "Edit" when this user can write
   *  through. Falls back to the suggestion wording — the safe assumption. */
  editActionLabel?: string;
}

export const ProductResultCard: React.FC<ItemCardProps> = ({
  item,
  format,
  onEditItem,
  onCreateVariant,
  editActionLabel,
}) => {
  const { t } = useTranslation();
  const showActions = !!onEditItem || !!onCreateVariant;

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
            {formatQuantity(item.netWeight)}
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
              <Icon name="create-outline" size={16} tone="primary" />
              <Text size="sm" weight="medium" tone="accent">
                {editActionLabel ?? t('suggestItemEdit.suggestAction')}
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
              <Icon name="add-circle-outline" size={16} tone="primary" />
              <Text size="sm" weight="medium" tone="accent">
                {t('barcode.newVersion')}
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
    borderCurve: 'continuous',
    padding: theme.spacing.lg,
    ...theme.shadows.md,
  },
  itemImage: {
    width: '100%',
    height: 200,
    borderRadius: theme.radii.md,
    borderCurve: 'continuous',
    marginBottom: theme.spacing.md,
  },
  placeholderImage: {
    width: '100%',
    height: 200,
    backgroundColor: theme.colors.backgroundSecondary,
    borderRadius: theme.radii.md,
    borderCurve: 'continuous',
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
