import React from 'react';
import { View } from 'react-native';
import { useMoney } from '#/domain/money';
import { useTranslation } from '#/i18n';
import { Pressable } from '#components/atoms/themedComponents';
import { StyleSheet } from 'react-native-unistyles';
import { CachedImage } from '#components/atoms/CachedImage';
import { Icon } from '#components/atoms/Icon';
import { Text } from '#components/atoms/Text';
import {
  formatQuantityWithUnit,
  type QuantityDisplayOptions,
} from '#utils/formatQuantity';
import { firstNonBlank } from '#/utils/firstNonBlank';
import {
  formatReading,
  readingOf,
  type MeasureShape,
  type ReadingSystem,
} from '#domain/measure';
import { Card } from '#components/atoms/Card';
import { barcodeTestIDs } from '#features/barcode/testIDs';
import { NetWeightKind } from '#/graphql/generated/schemaTypes';
import { PhotoCredit } from '#features/catalog/ui/PhotoCredit';
import type { PhotoCreditValue } from '#/types/attribution';

interface Item {
  id: string;
  name: string;
  brandName?: string;
  netWeight?: number;
  netWeightKind?: NetWeightKind;
  displayUnit?: {
    name?: string;
    symbol?: string;
  };
  /** A PACKAGE figure read in each unit system, which the card shows instead. */
  packageSize?: MeasureShape;
  price?: number;
  upc: string;
  image?: { url: string; credit?: PhotoCreditValue };
}

// The photo's side: big enough to tell the product, small enough to keep the
// add in view.
const THUMBNAIL_SIZE = 96;

// A pack size reads as a label prints it: 1.5 lb, never 1 1/2 lb.
const AS_DECIMAL: QuantityDisplayOptions = { notation: 'decimal' };

interface ItemCardProps {
  item: Item;
  /** The unit system the pack size reads in. */
  readingSystem: ReadingSystem;
  format?: string;
  onEditItem?: () => void;
  onCreateVariant?: () => void;
  /** "Suggest Edit" for a public catalog item, "Edit" when this user can write
   *  through. Falls back to the suggestion wording — the safe assumption. */
  editActionLabel?: string;
}

export const ProductResultCard: React.FC<ItemCardProps> = ({
  item,
  readingSystem,
  format,
  onEditItem,
  onCreateVariant,
  editActionLabel,
}) => {
  const { t } = useTranslation();
  const money = useMoney();
  const showActions = !!onEditItem || !!onCreateVariant;
  const { image, packageSize } = item;
  const amount = packageSize
    ? formatReading(readingOf(packageSize, readingSystem))
    : item.netWeight == null
    ? null
    : formatQuantityWithUnit(
        item.netWeight,
        firstNonBlank(item.displayUnit?.symbol, item.displayUnit?.name),
        AS_DECIMAL,
      );
  // Only a PACKAGE figure is the pack's size; the others say what they measure.
  const netWeightLine =
    amount === null
      ? null
      : item.netWeightKind === NetWeightKind.Serving
      ? t('barcode.servingAmount', { amount })
      : item.netWeightKind === NetWeightKind.Reference
      ? t('barcode.referenceAmount', { amount })
      : amount;

  return (
    <Card padding="none" style={styles.itemCard}>
      <View style={styles.header}>
        {image ? (
          <CachedImage
            uri={image.url}
            style={styles.thumbnail}
            displaySize={THUMBNAIL_SIZE}
          />
        ) : null}
        <View style={styles.headerText}>
          <Text role="title">{item.name}</Text>
          {!!item.brandName && (
            <Text role="body" tone="secondary">
              {item.brandName}
            </Text>
          )}
          {netWeightLine !== null && (
            <Text role="body" tone="secondary">
              {netWeightLine}
            </Text>
          )}
          {item.price != null && (
            <Text role="subheading" tone="success">
              {money(item.price)}
            </Text>
          )}
        </View>
      </View>
      {image?.credit ? <PhotoCredit credit={image.credit} /> : null}

      <View style={styles.itemDetails}>
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
            <Pressable
              style={styles.actionLink}
              onPress={onEditItem}
              testID={barcodeTestIDs.productEditAction}
            >
              <Icon name="create-outline" size={16} tone="primary" />
              <Text
                role="label"
                tone="accent"
                testID={barcodeTestIDs.productEditActionLabel}
              >
                {editActionLabel ?? t('labels.suggestEdit')}
              </Text>
            </Pressable>
          )}
          {!!onEditItem && !!onCreateVariant && (
            <Text role="body" tone="tertiary" style={styles.actionSeparator}>
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
    gap: theme.spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.spacing.md,
  },
  thumbnail: {
    width: THUMBNAIL_SIZE,
    height: THUMBNAIL_SIZE,
    borderRadius: theme.radii.md,
    borderCurve: 'continuous',
  },
  headerText: {
    flex: 1,
    gap: theme.spacing.xs,
  },
  itemDetails: {
    gap: theme.spacing.xs,
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
