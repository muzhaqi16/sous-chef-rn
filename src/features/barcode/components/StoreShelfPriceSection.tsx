import React from 'react';
import { StyleSheet } from 'react-native-unistyles';
import { useTranslation } from '#/i18n';
import { Card } from '#components/atoms/Card';
import { Text } from '#components/atoms/Text';
import {
  hasShelfPrices,
  type useStoreShelfPrices,
} from '#features/catalog/hooks/useStoreShelfPrices';
import { StoreShelfPriceList } from '#features/catalog/ui/StoreShelfPriceList';
import { barcodeTestIDs } from '#features/barcode/testIDs';

/**
 * Store mode's shelf price at each store for a scanned product, under the
 * household's price lines. With no store priced, the section is left out.
 */
export const StoreShelfPriceSection: React.FC<{
  prices: ReturnType<typeof useStoreShelfPrices>;
}> = ({ prices }) => {
  const { t } = useTranslation();
  if (!hasShelfPrices(prices)) return null;

  return (
    <Card style={styles.card} testID={barcodeTestIDs.storeShelfPrices}>
      <Text role="bodyStrong">{t('storeShelfPrices.title')}</Text>
      <StoreShelfPriceList prices={prices} />
    </Card>
  );
};

const styles = StyleSheet.create(theme => ({
  card: {
    padding: theme.spacing.lg,
    gap: theme.spacing.sm,
  },
}));
