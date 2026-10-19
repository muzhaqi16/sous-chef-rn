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

import { Text } from '#components/atoms/Text';
import { PaginatedHistoryScreen } from '#components/templates/PaginatedHistoryScreen';
import { formatCurrency, UNKNOWN_AMOUNT } from '#/utils/formatters/number';
import {
  moneyByCurrency,
  resolveCurrency,
  usePreferredCurrency,
  type FigureCurrency,
} from '#/domain/money';
import { formatDateTime, formatMonthDayYear } from '#/utils/formatters/date';
import { isCalendarDayInstant, purchaseDay } from '#/utils/dateUtils';
import { formatQuantityForDisplay } from '#/utils/formatQuantity';
import { firstNonBlank } from '#/utils/firstNonBlank';
import { PerUnitHint } from '#features/shoppingList/components/PerUnitHint';

const keyExtractor = (item: { id: string }) => item.id;

type RouteParams = {
  itemId: string;
  itemName: string;
};

// A receipt records its day and no time, so it shows as that day alone.
const formatDate = (dateString: string) =>
  isCalendarDayInstant(dateString)
    ? formatMonthDayYear(purchaseDay(dateString))
    : formatDateTime(new Date(dateString));

// null for a missing/zero amount, so an auto-recorded purchase omits the row
// rather than show "$0.00". Formatted from the ISO code, not `currencySymbol`,
// so the symbol and separator land where the locale puts them.
const formatPrice = (
  amount: number | null | undefined,
  currency: FigureCurrency,
  preferredCurrency: string,
): string | null => {
  // Only an ABSENT price has nothing to show. A price recorded as zero is a
  // price somebody entered — a comped or free line — and it is counted in the
  // totals below, so suppressing its own row would disagree with them.
  if (amount == null) return null;
  return formatCurrency(amount, resolveCurrency(currency, preferredCurrency));
};

/**
 * Spend and the average purchase per currency (never summed across), in order
 * of first appearance. Priced purchases only: a NULL price is unknown, not zero,
 * while a RECORDED zero was entered and counts.
 */
const spendByCurrency = (
  purchases: readonly PurchaseItem[],
  preferredCurrency: string,
) => {
  const tallies = new Map<string, { total: number; count: number }>();
  for (const { totalPrice, currency } of purchases) {
    if (totalPrice == null) continue;
    const code = resolveCurrency(currency, preferredCurrency);
    const tally = tallies.get(code) ?? { total: 0, count: 0 };
    tallies.set(code, {
      total: tally.total + totalPrice,
      count: tally.count + 1,
    });
  }
  const entries = [...tallies];
  return {
    totals: entries.map(([currencyCode, { total }]) => ({
      currencyCode,
      amount: total,
    })),
    averages: entries.map(([currencyCode, { total, count }]) => ({
      currencyCode,
      amount: total / count,
    })),
  };
};

type PurchaseHistoryItemProps = ListRenderItemInfo<PurchaseItem> & {
  totalCount: number;
};

const PurchaseHistoryItemComponent: React.FC<PurchaseHistoryItemProps> = ({
  item: purchase,
  index,
  totalCount,
}) => {
  const { t } = useTranslation();
  const preferredCurrency = usePreferredCurrency();
  const priceText = formatPrice(
    purchase.totalPrice,
    purchase.currency,
    preferredCurrency,
  );
  // At quantity 1 the per-unit price IS the total. Every other quantity gets
  // the rate — a fractional one most of all.
  const perUnitText =
    purchase.quantity !== 1
      ? formatPrice(purchase.unitPrice, purchase.currency, preferredCurrency)
      : null;

  return (
    <View style={[styles.purchaseCard, commonStyles.shadow]}>
      <View style={styles.purchaseHeader}>
        <View style={styles.purchaseNumber}>
          <Text role="label" style={styles.purchaseNumberText}>
            #{totalCount - index}
          </Text>
        </View>
        <Text role="label" style={styles.purchaseDate}>
          {formatDate(purchase.purchaseDate)}
        </Text>
      </View>

      <View style={styles.purchaseDetails}>
        <View style={styles.purchaseSummaryRow}>
          <View style={styles.purchaseInlineGroup}>
            <Icon name="cube-outline" size={18} tone="iconSecondary" />
            <Text
              role="caption"
              tone="secondary"
              style={styles.purchaseDetailLabel}
            >
              {t('purchaseHistory.quantityLabel')}
            </Text>
            <Text role="label">
              {formatQuantityForDisplay(purchase.quantity)}{' '}
              {purchase.unitSymbol}
            </Text>
          </View>

          {!!priceText && (
            <View style={styles.purchaseInlineGroup}>
              <Icon name="pricetag-outline" size={18} tone="iconSecondary" />
              <Text
                role="caption"
                tone="secondary"
                style={styles.purchaseDetailLabel}
              >
                {t('purchaseHistory.priceLabel')}
              </Text>
              <View style={styles.purchasePriceCell}>
                <Text role="label">{priceText}</Text>
                {!!perUnitText && (
                  <PerUnitHint price={perUnitText} unit={purchase.unitSymbol} />
                )}
              </View>
            </View>
          )}
        </View>

        <View style={styles.purchaseDetailRow}>
          <Icon name="person-outline" size={18} tone="iconSecondary" />
          <Text
            role="caption"
            tone="secondary"
            style={styles.purchaseDetailLabel}
          >
            {t('purchaseHistory.purchasedBy')}
          </Text>
          {/* displayName -> email -> "Someone": `email` is null for anyone but
              the caller themself, and a profile is optional. */}
          <Text role="label" style={styles.purchaseDetailValue}>
            {firstNonBlank(
              purchase.user.profile?.displayName,
              purchase.user.email,
            ) ?? t('labels.someone')}
          </Text>
        </View>
      </View>
    </View>
  );
};

const PurchaseHistoryItem = PurchaseHistoryItemComponent;

const getPurchaseItemType = () => 'item';

// A factory so the row gets the count as a prop and `renderItem` still has one
// identity per count, not one per screen render.
const makeRenderItem =
  (totalCount: number) => (info: ListRenderItemInfo<PurchaseItem>) =>
    <PurchaseHistoryItem {...info} totalCount={totalCount} />;

const PurchaseHistoryHeader: React.FC<{
  totalCount: number;
  totalSpent: string;
  averageSpent: string;
}> = ({ totalCount, totalSpent, averageSpent }) => {
  const { t } = useTranslation();
  return (
    <View style={styles.statsContainer}>
      <Text role="body">
        {t('purchaseHistory.totalPurchases')}{' '}
        <Text role="bodyStrong" style={styles.statsValue}>
          {totalCount}
        </Text>
      </Text>
      <Text role="body" style={styles.statsRow}>
        {t('purchaseHistory.totalSpent')}{' '}
        <Text role="bodyStrong" style={styles.statsValue}>
          {totalSpent}
        </Text>
      </Text>
      <Text role="body" style={styles.statsRow}>
        {t('purchaseHistory.averagePrice')}{' '}
        <Text role="bodyStrong" style={styles.statsValue}>
          {averageSpent}
        </Text>
      </Text>
    </View>
  );
};

export const PurchaseHistoryScreen: React.FC<
  StaticScreenProps<RouteParams>
> = ({ route }) => {
  const { t } = useTranslation();
  const { itemId, itemName } = route.params;

  const {
    purchases,
    totalCount,
    state,
    loadMore,
    hasNextPage,
    isFetchingMore,
    retry,
  } = useItemPurchaseHistory(itemId);
  const preferredCurrency = usePreferredCurrency();

  // With no priced purchase the spend is unknown, never zero. The API states no
  // money totals, so they stay unknown until every page is loaded.
  const spend = spendByCurrency(
    hasNextPage ? [] : purchases,
    preferredCurrency,
  );
  const totalSpent = moneyByCurrency(spend.totals) ?? UNKNOWN_AMOUNT;
  const averageSpent = moneyByCurrency(spend.averages) ?? UNKNOWN_AMOUNT;

  return (
    <PaginatedHistoryScreen
      title={t('labels.purchaseHistory')}
      subtitle={itemName}
      items={purchases}
      state={state}
      onRetry={retry}
      onEndReached={loadMore}
      hasNextPage={hasNextPage}
      isFetchingMore={isFetchingMore}
      keyExtractor={keyExtractor}
      renderItem={makeRenderItem(totalCount)}
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
}));
