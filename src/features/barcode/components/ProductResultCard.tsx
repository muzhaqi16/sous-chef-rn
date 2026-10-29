import React from 'react';
import { View } from 'react-native';
import { useMoney } from '#/domain/money';
import { useTranslation } from '#/i18n';
import { Pressable } from '#components/atoms/themedComponents';
import { StyleSheet } from 'react-native-unistyles';
import { CachedImage } from '#components/atoms/CachedImage';
import { Icon } from '#components/atoms/Icon';
import { IconButton } from '#components/atoms/IconButton';
import { Text } from '#components/atoms/Text';
import {
  formatQuantityWithUnit,
  type QuantityDisplayOptions,
} from '#utils/formatQuantity';
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
import type { BrandListing } from '#features/barcode/hooks/useProductBrandListings';

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
  /**
   * The user's lists the brand is on, and the way to put it on one, drawn at
   * the brand. Absent when the scan names no brand of its own.
   */
  brandLists?: {
    listings: readonly BrandListing[];
    onAddToList: () => void;
  };
}

export const ProductResultCard: React.FC<ItemCardProps> = ({
  item,
  readingSystem,
  format,
  onEditItem,
  onCreateVariant,
  editActionLabel,
  brandLists,
}) => {
  const { t } = useTranslation();
  const money = useMoney();
  const showActions = !!onEditItem || !!onCreateVariant;
  const { image, packageSize } = item;
  const amount = packageSize
    ? formatReading(readingOf(packageSize, readingSystem))
    : item.netWeight == null
    ? null
    : formatQuantityWithUnit(item.netWeight, item.displayUnit, AS_DECIMAL);
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
            <View style={styles.brandRow}>
              <Text role="body" tone="secondary" style={styles.brandName}>
                {item.brandName}
              </Text>
              {brandLists ? (
                <IconButton
                  name={
                    brandLists.listings.length > 0
                      ? 'bookmark'
                      : 'bookmark-outline'
                  }
                  size="sm"
                  tone="primary"
                  onPress={brandLists.onAddToList}
                  accessibilityLabel={t('barcode.brandLists.addToList', {
                    brand: item.brandName,
                  })}
                  style={styles.brandBookmark}
                  testID={barcodeTestIDs.addBrandToList}
                />
              ) : null}
            </View>
          )}
          {/* A list is the user's record, never a fact about the product: an
              unlisted brand shows no "not listed" line. */}
          {brandLists && brandLists.listings.length > 0 ? (
            <View
              style={styles.brandListings}
              testID={barcodeTestIDs.brandListings}
            >
              {brandLists.listings.map(listing => (
                <View key={listing.key}>
                  <Text role="caption" tone="accent">
                    {t('barcode.brandLists.onList', { list: listing.listName })}
                  </Text>
                  {!!listing.viaParent && (
                    <Text role="caption" tone="secondary">
                      {t('barcode.brandLists.viaParent', {
                        parent: listing.viaParent,
                      })}
                    </Text>
                  )}
                  {!!listing.reason && (
                    <Text role="caption" tone="secondary">
                      {listing.reason}
                    </Text>
                  )}
                </View>
              ))}
            </View>
          ) : null}
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
            {format}
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
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  brandName: {
    flexShrink: 1,
  },
  // The full touch target, without growing the brand's line past its text.
  brandBookmark: {
    marginVertical:
      -(theme.sizes.touchTarget.min - theme.type.body.lineHeight) / 2,
  },
  brandListings: {
    gap: theme.spacing.xs,
  },
  // One line: the barcode, its format trailing quietly at the far end.
  itemDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'baseline',
    columnGap: theme.spacing.sm,
  },
  itemBarcode: {
    fontFamily: 'monospace',
  },
  itemFormat: {
    textTransform: 'uppercase',
    marginLeft: 'auto',
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
