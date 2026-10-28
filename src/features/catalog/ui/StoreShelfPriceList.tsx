import React, { useState } from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { useTranslation } from '#/i18n';
import { Badge } from '#components/atoms/Badge';
import { Text } from '#components/atoms/Text';
import { Button } from '#components/molecules/Button';
import type { StoreShelfPriceRow } from '#features/catalog/hooks/useStoreShelfPrices';
import { catalogTestIDs } from '#features/catalog/testIDs';

/** The stores shown before the rest are asked for. */
const FIRST_SHOWN = 3;

const PriceRow: React.FC<{ row: StoreShelfPriceRow }> = ({ row }) => {
  const { t } = useTranslation();
  const notes = [
    row.perBasis,
    row.wasPrice,
    row.usual,
    row.lowest,
    row.lastSeen,
  ].flatMap(note => note ?? []);
  const tagged = row.isCheapest || !!row.wasPrice || row.isListStore;

  return (
    <View
      style={styles.row}
      testID={catalogTestIDs.storeShelfPrice(row.storeId)}
    >
      <View style={styles.store}>
        <Text role="body">{row.storeName}</Text>
        {!!row.aisle && (
          <Text role="caption" tone="secondary">
            {row.aisle}
          </Text>
        )}
        {!!tagged && (
          <View style={styles.badges}>
            {!!row.isCheapest && (
              <Badge variant="success">{t('storeShelfPrices.cheapest')}</Badge>
            )}
            {!!row.wasPrice && (
              <Badge variant="warning">{t('storeShelfPrices.sale')}</Badge>
            )}
            {!!row.isListStore && (
              <Badge>{t('storeShelfPrices.listStore')}</Badge>
            )}
          </View>
        )}
      </View>
      <View style={styles.price}>
        <Text role="bodyStrong" style={styles.priceText}>
          {row.price}
        </Text>
        {notes.map(note => (
          <Text
            key={note}
            role="caption"
            tone="secondary"
            style={styles.priceText}
          >
            {note}
          </Text>
        ))}
      </View>
    </View>
  );
};

interface StoreShelfPriceListProps {
  rows: readonly StoreShelfPriceRow[];
}

/**
 * An item's shelf price at each store, in the order given: three at first, the
 * rest on request. Its host gives it a heading and a container.
 */
export const StoreShelfPriceList: React.FC<StoreShelfPriceListProps> = ({
  rows,
}) => {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? rows : rows.slice(0, FIRST_SHOWN);
  const hidden = rows.length - shown.length;

  return (
    <View style={styles.list}>
      {shown.map(row => (
        <PriceRow key={row.storeId} row={row} />
      ))}
      {hidden > 0 && (
        <Button
          variant="ghost"
          size="small"
          onPress={() => setExpanded(true)}
          testID={catalogTestIDs.storeShelfPricesShowMore}
        >
          {t('storeShelfPrices.showMore', { count: hidden })}
        </Button>
      )}
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  list: {
    gap: theme.spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.spacing.md,
  },
  store: {
    flex: 1,
    gap: theme.spacing.xs,
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.xs,
  },
  price: {
    flexShrink: 1,
    alignItems: 'flex-end',
  },
  priceText: {
    textAlign: 'right',
  },
}));
