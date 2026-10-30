import React, { useState } from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { useTranslation } from '#/i18n';
import { Badge } from '#components/atoms/Badge';
import { Text } from '#components/atoms/Text';
import { Button } from '#components/molecules/Button';
import type {
  SimilarShelfPriceRow,
  StoreShelfPriceRow,
} from '#features/catalog/hooks/useStoreShelfPrices';
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

/** Another product of the item's kind: never the cheapest, maybe cheaper. */
const SimilarRow: React.FC<{ row: SimilarShelfPriceRow }> = ({ row }) => {
  const { t } = useTranslation();
  return (
    <View
      style={styles.row}
      testID={catalogTestIDs.storeShelfSimilarPrice(row.storeId)}
    >
      <View style={styles.store}>
        <Text role="body">{row.storeName}</Text>
        <Text role="caption" tone="secondary">
          {row.product}
        </Text>
        {!!row.mightBeCheaper && (
          <View style={styles.badges}>
            <Badge variant="primary">
              {t('storeShelfPrices.mightBeCheaper')}
            </Badge>
          </View>
        )}
      </View>
      <View style={styles.price}>
        <Text role="bodyStrong" style={styles.priceText}>
          {row.price}
        </Text>
        {!!row.perBasis && (
          <Text role="caption" tone="secondary" style={styles.priceText}>
            {row.perBasis}
          </Text>
        )}
      </View>
    </View>
  );
};

/** The first few of `items`, and the rest on request. */
function FirstFew<T extends { storeId: string }>({
  items,
  render,
  showMoreTestID,
}: {
  items: readonly T[];
  render: (item: T) => React.ReactElement;
  showMoreTestID: string;
}) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? items : items.slice(0, FIRST_SHOWN);
  const hidden = items.length - shown.length;
  return (
    <>
      {shown.map(item => (
        <React.Fragment key={item.storeId}>{render(item)}</React.Fragment>
      ))}
      {hidden > 0 && (
        <Button
          variant="ghost"
          size="small"
          onPress={() => setExpanded(true)}
          testID={showMoreTestID}
        >
          {t('storeShelfPrices.showMore', { count: hidden })}
        </Button>
      )}
    </>
  );
}

/** `useStoreShelfPrices`' answer, spread. */
interface StoreShelfPriceListProps {
  rows: readonly StoreShelfPriceRow[];
  similarRows: readonly SimilarShelfPriceRow[];
}

/**
 * An item's shelf price at each store, in the order given, then similar
 * products under their own heading: three of each at first, the rest on
 * request. Its host gives it a heading and a container.
 */
export const StoreShelfPriceList: React.FC<StoreShelfPriceListProps> = ({
  rows,
  similarRows,
}) => {
  const { t } = useTranslation();
  return (
    <View style={styles.list}>
      <FirstFew
        items={rows}
        render={row => <PriceRow row={row} />}
        showMoreTestID={catalogTestIDs.storeShelfPricesShowMore}
      />
      {similarRows.length > 0 && (
        <>
          <Text role="bodyStrong">{t('storeShelfPrices.similarTitle')}</Text>
          <FirstFew
            items={similarRows}
            render={row => <SimilarRow row={row} />}
            showMoreTestID={catalogTestIDs.storeShelfSimilarShowMore}
          />
        </>
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
