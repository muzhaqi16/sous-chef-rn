import React from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { useTranslation } from '#/i18n';
import { Card } from '#components/atoms/Card';
import { Icon } from '#components/atoms/Icon';
import { Text } from '#components/atoms/Text';
import { Button } from '#components/molecules/Button';
import type { BrandListing } from '#features/barcode/hooks/useProductBrandListings';
import { barcodeTestIDs } from '#features/barcode/testIDs';

interface BrandListingsSectionProps {
  listings: BrandListing[];
  /** The scanned barcode's own brand, which the user can add to a list. */
  brandName: string | null;
  onAddToList: () => void;
}

/**
 * The user's own lists the scanned brand is on, and a way to put it on one.
 * An unlisted brand shows no listing and no "not listed" line: a list is the
 * user's record, never a fact the app states about the product.
 */
export const BrandListingsSection: React.FC<BrandListingsSectionProps> = ({
  listings,
  brandName,
  onAddToList,
}) => {
  const { t } = useTranslation();

  return (
    <View style={styles.section}>
      {listings.length > 0 && (
        <Card style={styles.card} testID={barcodeTestIDs.brandListings}>
          {listings.map(listing => (
            <View key={listing.key} style={styles.listing}>
              <View style={styles.line}>
                <Icon name="bookmark" size="sm" tone="primary" />
                <Text role="bodyStrong" style={styles.text}>
                  {t('barcode.brandLists.onList', { list: listing.listName })}
                </Text>
              </View>
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
        </Card>
      )}
      {!!brandName && (
        <Button
          variant="ghost"
          size="small"
          icon="bookmark-outline"
          onPress={onAddToList}
          testID={barcodeTestIDs.addBrandToList}
        >
          {t('barcode.brandLists.addToList', { brand: brandName })}
        </Button>
      )}
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  section: {
    gap: theme.spacing.sm,
  },
  card: {
    padding: theme.spacing.lg,
    gap: theme.spacing.sm,
  },
  listing: {
    gap: theme.spacing.xs,
  },
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  text: {
    flex: 1,
  },
}));
