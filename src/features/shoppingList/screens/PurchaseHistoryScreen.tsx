import React from 'react';
import { View } from 'react-native';
import { useTranslation } from '#/i18n';
import type { StaticScreenProps } from '@react-navigation/native';
import type { ListRenderItemInfo } from '@shopify/flash-list';
import {
  useItemPurchaseHistory,
  type PurchaseItem,
} from '#features/shoppingList/hooks/useItemPurchaseHistory';
import { StyleSheet } from 'react-native-unistyles';
import { Icon } from '#utils/iconUtils';
import { commonStyles } from '#/styles/commonStyles';

import {
  PurchaseHistoryProvider,
  usePurchaseHistoryContext,
} from './PurchaseHistoryContext';
import { Text } from '#components/atoms/Text';
import { PaginatedHistoryScreen } from '#components/templates/PaginatedHistoryScreen';
import { DEFAULT_CURRENCY, formatCurrency } from '#/utils/formatters/number';
import { formatDateTime } from '#/utils/formatters/date';

const keyExtractor = (item: { id: string }) => item.id;

type RouteParams = {
  itemId: string;
  itemName: string;
};

// An `undefined` locale makes Intl use the device's own, so the field order
// follows the reader rather than forcing US month-day.
const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return formatDateTime(date);
};

// null for a missing/zero amount, so the row is omitted rather than showing
// "$0.00" — a purchase auto-recorded at check-off carries no price. Formatted
// from the ISO code, not by prefixing `currencySymbol`, so the symbol and
// separator land where the locale puts them.
const formatPrice = (
  amount: number | null | undefined,
  currencyCode: string | null | undefined,
): string | null => {
  if (amount == null || amount <= 0) return null;
  return formatCurrency(amount, currencyCode ?? DEFAULT_CURRENCY);
};

type PurchaseHistoryItemProps = ListRenderItemInfo<PurchaseItem>;

const PurchaseHistoryItemComponent: React.FC<PurchaseHistoryItemProps> = ({
  item: purchase,
  index,
}) => {
  const { t } = useTranslation();
  const { totalCount } = usePurchaseHistoryContext();
  const priceText = formatPrice(purchase.totalPrice, purchase.currency.code);
  // At quantity 1 the per-unit price IS the total. Every other quantity gets
  // the rate — a fractional one most of all.
  const perUnitText =
    purchase.quantity !== 1
      ? formatPrice(purchase.unitPrice, purchase.currency.code)
      : null;

  return (
    <View style={[styles.purchaseCard, commonStyles.shadow]}>
      <View style={styles.purchaseHeader}>
        <View style={styles.purchaseNumber}>
          <Text size="xs" weight="bold" style={styles.purchaseNumberText}>
            #{totalCount - index}
          </Text>
        </View>
        <Text size="sm" weight="medium" style={styles.purchaseDate}>
          {formatDate(purchase.purchaseDate)}
        </Text>
      </View>

      <View style={styles.purchaseDetails}>
        <View style={styles.purchaseSummaryRow}>
          <View style={styles.purchaseInlineGroup}>
            <Icon name="cube-outline" size={18} tone="iconSecondary" />
            <Text size="sm" tone="secondary" style={styles.purchaseDetailLabel}>
              {t('purchaseHistory.quantityLabel')}
            </Text>
            <Text size="sm" weight="medium">
              {purchase.quantity} {purchase.unitSymbol}
            </Text>
          </View>

          {!!priceText && (
            <View style={styles.purchaseInlineGroup}>
              <Icon name="pricetag-outline" size={18} tone="iconSecondary" />
              <Text
                size="sm"
                tone="secondary"
                style={styles.purchaseDetailLabel}
              >
                {t('purchaseHistory.priceLabel')}
              </Text>
              <View style={styles.purchasePriceCell}>
                <Text size="sm" weight="medium">
                  {priceText}
                </Text>
                {!!perUnitText && (
                  <Text size="xs" tone="secondary">
                    {t(
                      purchase.unitSymbol
                        ? 'purchaseAmountSheet.perUnitOfHint'
                        : 'purchaseAmountSheet.perUnitHint',
                      { price: perUnitText, unit: purchase.unitSymbol },
                    )}
                  </Text>
                )}
              </View>
            </View>
          )}
        </View>

        <View style={styles.purchaseDetailRow}>
          <Icon name="person-outline" size={18} tone="iconSecondary" />
          <Text size="sm" tone="secondary" style={styles.purchaseDetailLabel}>
            {t('purchaseHistory.purchasedBy')}
          </Text>
          {/* displayName -> email -> "Someone": `email` is null for anyone but
              the caller themself, and a profile is optional. */}
          <Text size="sm" weight="medium" style={styles.purchaseDetailValue}>
            {purchase.user.profile?.displayName ||
              purchase.user.email ||
              t('labels.someone')}
          </Text>
        </View>
      </View>
    </View>
  );
};

const PurchaseHistoryItem = PurchaseHistoryItemComponent;

const getPurchaseItemType = () => 'item';

const renderItem = (info: ListRenderItemInfo<PurchaseItem>) => (
  <PurchaseHistoryItem {...info} />
);

const PurchaseHistoryHeader: React.FC<{
  totalCount: number;
  totalSpent: string | null;
  averageSpent: string | null;
}> = ({ totalCount, totalSpent, averageSpent }) => {
  const { t } = useTranslation();
  return (
    <View style={styles.statsContainer}>
      <Text size="md">
        {t('purchaseHistory.totalPurchases')}{' '}
        <Text weight="bold" style={styles.statsValue}>
          {totalCount}
        </Text>
      </Text>
      {!!totalSpent && (
        <Text size="md" style={styles.statsRow}>
          {t('purchaseHistory.totalSpent')}{' '}
          <Text weight="bold" style={styles.statsValue}>
            {totalSpent}
          </Text>
        </Text>
      )}
      {!!averageSpent && (
        <Text size="md" style={styles.statsRow}>
          {t('purchaseHistory.averagePrice')}{' '}
          <Text weight="bold" style={styles.statsValue}>
            {averageSpent}
          </Text>
        </Text>
      )}
    </View>
  );
};

export const PurchaseHistoryScreen: React.FC<
  StaticScreenProps<RouteParams>
> = ({ route }) => {
  const { t } = useTranslation();
  const { itemId, itemName } = route.params;

  const { purchases, totalCount, state, loadMore, isFetchingMore, retry } =
    useItemPurchaseHistory(itemId);

  // Priced purchases only — auto-recorded ones would drag the average to 0.
  const pricedPurchases = purchases.filter(p => p.totalPrice > 0);
  const currencyCode = pricedPurchases[0]?.currency.code;
  const spent = pricedPurchases.reduce((sum, p) => sum + p.totalPrice, 0);
  const totalSpent = formatPrice(spent, currencyCode);
  const averageSpent = pricedPurchases.length
    ? formatPrice(spent / pricedPurchases.length, currencyCode)
    : null;

  return (
    <PurchaseHistoryProvider value={{ totalCount }}>
      <PaginatedHistoryScreen
        title={t('labels.purchaseHistory')}
        subtitle={itemName}
        items={purchases}
        state={state}
        onRetry={retry}
        onEndReached={loadMore}
        isFetchingMore={isFetchingMore}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        getItemType={getPurchaseItemType}
        summary={
          <PurchaseHistoryHeader
            totalCount={totalCount}
            totalSpent={totalSpent}
            averageSpent={averageSpent}
          />
        }
        emptyIcon="receipt-outline"
        emptyTitle={t('purchaseHistory.emptyTitle')}
        emptyDescription={t('purchaseHistory.emptySubtitle')}
        componentName="PurchaseHistoryScreen"
      />
    </PurchaseHistoryProvider>
  );
};

const styles = StyleSheet.create(theme => ({
  statsContainer: {
    backgroundColor: theme.colors.infoLight,
    padding: theme.spacing.md,
    borderRadius: theme.radii.md,
    borderCurve: 'continuous',
    marginBottom: theme.spacing.md,
    borderWidth: theme.borderWidth.hairline,
    borderColor: theme.colors.info,
  },
  statsValue: {
    color: theme.colors.info,
  },
  statsRow: {
    marginTop: theme.spacing.xs,
  },
  purchaseCard: {
    borderRadius: theme.radii.md,
    borderCurve: 'continuous',
    padding: theme.spacing.md,
    borderWidth: theme.borderWidth.hairline,
    marginVertical: theme.spacing.sm,
    borderColor: theme.colors.border,
  },
  purchaseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
    paddingBottom: theme.spacing.sm,
    borderBottomWidth: theme.borderWidth.hairline,
    borderBottomColor: theme.colors.border,
  },
  purchaseNumber: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.radii.sm,
    borderCurve: 'continuous',
    marginRight: theme.spacing.sm,
  },
  purchaseNumberText: {
    color: theme.colors.onPrimary,
  },
  purchaseDate: {
    flex: 1,
  },
  purchaseDetails: {
    gap: theme.spacing.xs,
  },
  // Quantity (left) and price (right) share a single line; wraps if the card is
  // too narrow to fit both groups.
  purchaseSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    rowGap: theme.spacing.xs,
    columnGap: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
  },
  purchaseInlineGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  purchaseDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.xs,
  },
  purchasePriceCell: {
    alignItems: 'flex-end',
  },
  purchaseDetailLabel: {
    marginLeft: theme.spacing.xs,
    marginRight: theme.spacing.xs,
  },
  purchaseDetailValue: {
    flex: 1,
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));
