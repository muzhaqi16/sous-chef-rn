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
import { formatCurrency } from '#/utils/formatters/number';
import { usePreferredCurrency } from '#/domain/money';
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
  preferredCurrency: string,
): string | null => {
  // Only an ABSENT price has nothing to show. A price recorded as zero is a
  // price somebody entered — a comped or free line — and it is counted in the
  // totals below, so suppressing its own row would disagree with them.
  if (amount == null) return null;
  return formatCurrency(amount, currencyCode ?? preferredCurrency);
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
    purchase.currency.code,
    preferredCurrency,
  );
  // At quantity 1 the per-unit price IS the total. Every other quantity gets
  // the rate — a fractional one most of all.
  const perUnitText =
    purchase.quantity !== 1
      ? formatPrice(
          purchase.unitPrice,
          purchase.currency.code,
          preferredCurrency,
        )
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
              {purchase.quantity} {purchase.unitSymbol}
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
                  <Text role="caption" tone="secondary">
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

// A factory so the row gets the count as a prop and `renderItem` still has one
// identity per count, not one per screen render.
const makeRenderItem =
  (totalCount: number) => (info: ListRenderItemInfo<PurchaseItem>) =>
    <PurchaseHistoryItem {...info} totalCount={totalCount} />;

const PurchaseHistoryHeader: React.FC<{
  totalCount: number;
  totalSpent: string | null;
  averageSpent: string | null;
}> = ({ totalCount, totalSpent, averageSpent }) => {
  const { t } = useTranslation();
  return (
    <View style={styles.statsContainer}>
      <Text>
        {t('purchaseHistory.totalPurchases')}{' '}
        <Text role="bodyStrong" style={styles.statsValue}>
          {totalCount}
        </Text>
      </Text>
      {!!totalSpent && (
        <Text style={styles.statsRow}>
          {t('purchaseHistory.totalSpent')}{' '}
          <Text role="bodyStrong" style={styles.statsValue}>
            {totalSpent}
          </Text>
        </Text>
      )}
      {!!averageSpent && (
        <Text style={styles.statsRow}>
          {t('purchaseHistory.averagePrice')}{' '}
          <Text role="bodyStrong" style={styles.statsValue}>
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
  const preferredCurrency = usePreferredCurrency();

  // Priced purchases only. A price is NULL when it was never observed — a line
  // moved to the pantry without one — which is unknown, not zero, and averaging
  // it in would drag the mean toward zero. A price RECORDED as zero is a price
  // somebody entered and belongs in both figures.
  const pricedPurchases = purchases.filter(
    (p): p is typeof p & { totalPrice: number } => p.totalPrice != null,
  );
  const currencyCode = pricedPurchases[0]?.currency.code;
  const spent = pricedPurchases.reduce((sum, p) => sum + p.totalPrice, 0);
  const totalSpent = formatPrice(spent, currencyCode, preferredCurrency);
  const averageSpent = pricedPurchases.length
    ? formatPrice(
        spent / pricedPurchases.length,
        currencyCode,
        preferredCurrency,
      )
    : null;

  return (
    <PaginatedHistoryScreen
      title={t('labels.purchaseHistory')}
      subtitle={itemName}
      items={purchases}
      state={state}
      onRetry={retry}
      onEndReached={loadMore}
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
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));
