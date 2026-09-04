import React from 'react';
import { View } from 'react-native';
import { useTranslation } from '#/i18n';
import { Pressable } from '#components/atoms/themedComponents';
import { StyleSheet } from 'react-native-unistyles';
import { CachedImage } from '#components/atoms/CachedImage';
import { Icon } from '#utils/iconUtils';
import { Text } from '#components/atoms/Text';
import { formatQuantity } from '#utils/formatQuantity';
import { DEFAULT_CURRENCY, formatCurrency } from '#/utils/formatters/number';
import { Card } from '#components/atoms/Card';

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
    <Card padding="none" style={styles.itemCard}>
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
        <Text role="title">{item.name}</Text>
        {!!item.brandName && <Text tone="secondary">{item.brandName}</Text>}
        {item.netWeight != null && (
          <Text tone="secondary">
            {formatQuantity(item.netWeight)}
            {item.displayUnit?.name ? ` ${item.displayUnit.name}` : ''}
          </Text>
        )}
        {!!item?.price && (
          <Text role="subheading" tone="success">
            {formatCurrency(item.price, DEFAULT_CURRENCY)}
          </Text>
        )}
        <Text role="caption" tone="secondary" style={styles.itemBarcode}>
          {t('barcode.barcodeValue', { barcode: item.upc })}
        </Text>
        {format ? (
          <Text role="caption" tone="tertiary" style={styles.itemFormat}>
            {t('barcode.formatValue', { format })}
          </Text>
        ) : null}
      </View>

      {showActions ? (
        <View style={styles.actionsRow}>
          {!!onEditItem && (
            <Pressable style={styles.actionLink} onPress={onEditItem}>
              <Icon name="create-outline" size={16} tone="primary" />
              <Text role="label" tone="accent">
                {editActionLabel ?? t('labels.suggestEdit')}
              </Text>
            </Pressable>
          )}
          {!!onEditItem && !!onCreateVariant && (
            <Text tone="tertiary" style={styles.actionSeparator}>
              ·
            </Text>
          )}
          {!!onCreateVariant && (
            <Pressable style={styles.actionLink} onPress={onCreateVariant}>
              <Icon name="add-circle-outline" size={16} tone="primary" />
              <Text role="label" tone="accent">
                {t('barcode.newVersion')}
              </Text>
            </Pressable>
          )}
        </View>
      ) : null}
    </Card>
  );
};
const styles = StyleSheet.create(theme => ({
  itemCard: {
    padding: theme.spacing.lg,
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
    borderTopWidth: theme.borderWidth.hairline,
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
