import React from 'react';
import { View } from 'react-native';
import { useTranslation } from '#/i18n';
import { useQuery } from '@apollo/client/react';
import type { StaticScreenProps } from '@react-navigation/native';
import { FlashList, type ListRenderItemInfo } from '@shopify/flash-list';
import {
  GetItemPurchaseHistoryDocument,
  type GetItemPurchaseHistoryQuery,
} from '#features/shoppingList/graphql/shoppingList.generated';
import { errorService } from '#/services/errorService';
import { ThemedActivityIndicator } from '#components/atoms/themedComponents';
import { StyleSheet } from 'react-native-unistyles';
import { useAppNavigation } from '#hooks/navigation/useAppNavigation';
import { Icon } from '#utils/iconUtils';
import { ThemedBackButton } from '#components/atoms/themedComponents';
import { commonStyles } from '#/styles/commonStyles';

import { FLASHLIST_DEFAULTS } from '#utils/flashListDefaults';
import { DataStateView } from '#components/molecules/DataStateView';
import { useDataState } from '#hooks/data/useDataState';
import {
  PurchaseHistoryProvider,
  usePurchaseHistoryContext,
} from './PurchaseHistoryContext';
import { Text } from '#components/atoms/Text';
import { DEFAULT_CURRENCY, formatCurrency } from '#/utils/formatters/number';

const keyExtractor = (item: { id: string }) => item.id;

const PAGE_SIZE = 30;

type RouteParams = {
  itemId: string;
  itemName: string;
};

/**
 * One purchase row, derived from the query instead of restated beside it.
 *
 * The restated copy had `user.email` as `string` where the schema has `String`
 * — the API gates the address to self-or-admin — so the first query that
 * actually selected the field failed to compile. Deriving keeps the two from
 * disagreeing again.
 */
type PurchaseItem = NonNullable<
  GetItemPurchaseHistoryQuery['shoppingListItem']
>['purchasesConnection']['edges'][number]['node'];

// `undefined` as the locale makes Intl use the device's own, so the date reads
// natively for the user. A hardcoded 'en-US' put the month before the day for
// every locale that writes it the other way round, inside otherwise translated UI.
const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

// Format a money amount in the purchase's own currency. Returns null for
// missing/zero amounts so the price row is omitted rather than showing a
// meaningless "$0.00" — purchases auto-recorded when an item is checked off
// may carry no price.
//
// Formatted from the ISO code rather than by prefixing `currencySymbol`, so the
// symbol lands where the locale puts it and the decimal separator matches what
// the app accepts on input.
const formatPrice = (
  amount: number | null | undefined,
  currencyCode: string | null | undefined,
): string | null => {
  if (amount == null || amount <= 0) return null;
  return formatCurrency(amount, currencyCode ?? DEFAULT_CURRENCY);
};

// --- Module-scope FlashList components ---

type PurchaseHistoryItemProps = ListRenderItemInfo<PurchaseItem>;

const PurchaseHistoryItemComponent: React.FC<PurchaseHistoryItemProps> = ({
  item: purchase,
  index,
}) => {
  const { t } = useTranslation();
  const { totalCount } = usePurchaseHistoryContext();
  const priceText = formatPrice(purchase.totalPrice, purchase.currency.code);

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
              <Text size="sm" weight="medium">
                {priceText}
              </Text>
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

const PurchaseHistoryEmpty: React.FC = () => {
  const { t } = useTranslation();
  return (
    <View style={styles.emptyContainer}>
      <Icon name="receipt-outline" size={64} tone="iconDisabled" />
      <Text size="lg" weight="semibold" style={styles.emptyText}>
        {t('purchaseHistory.emptyTitle')}
      </Text>
      <Text
        size="sm"
        tone="secondary"
        align="center"
        style={styles.emptySubtext}
      >
        {t('purchaseHistory.emptySubtitle')}
      </Text>
    </View>
  );
};

// --- Main screen component ---

export const PurchaseHistoryScreen: React.FC<
  StaticScreenProps<RouteParams>
> = ({ route }) => {
  const { t } = useTranslation();
  const { goBack } = useAppNavigation();
  const { itemId, itemName } = route.params;

  // Fetch the history on demand (ItemDetail only carries the summary), paging
  // in more as the user scrolls — a frequently re-bought item can exceed a
  // single page.
  const { data, loading, error, refetch, fetchMore, networkStatus } = useQuery(
    GetItemPurchaseHistoryDocument,
    {
      variables: { itemId, first: PAGE_SIZE },
      notifyOnNetworkStatusChange: true,
      // NOT the app-wide `'all'`. `purchasesConnection` is
      // `PurchaseConnection!`, so a field error anywhere inside it propagates
      // up every non-null hop and nulls `shoppingListItem` itself — and under
      // `'all'` Apollo WRITES that partial `{ shoppingListItem: null }` to the
      // cache (`shouldWriteResult` writes whenever the policy ignores errors
      // and `result.data` is truthy). It would land on
      // `ROOT_QUERY.shoppingListItem({"id": itemId})`, the same field
      // `GetShoppingListItem` reads, so the ItemDetail screen still mounted
      // underneath this one would flip to "Item not found" and STAY there: the
      // `Query.shoppingListItem` redirect only fires when `existing ===
      // undefined`, `nextFetchPolicy: 'cache-first'` issues no fetch on resume,
      // and `cache.extract()` persists the null to MMKV.
      //
      // `'none'` refuses the write instead of letting one screen's failed read
      // decide whether an item exists. The cost is a partial page: if some rows
      // resolve and others error, none are shown. Worth it — `useDataState`
      // classifies the same either way, and a retry is one tap.
      errorPolicy: 'none',
    },
  );

  const connection = data?.shoppingListItem?.purchasesConnection;
  const purchases: PurchaseItem[] =
    connection?.edges?.map(edge => edge.node) ?? [];
  const totalCount = connection?.totalCount ?? purchases.length;
  const hasNextPage = connection?.pageInfo?.hasNextPage ?? false;
  const endCursor = connection?.pageInfo?.endCursor ?? null;
  // networkStatus 3 = fetchMore in flight.
  const loadingMore = networkStatus === 3;

  const loadMore = () => {
    if (!hasNextPage || !endCursor || loading || loadingMore) return;
    // fetchMore rejects on network/GraphQL errors; catch it so a failed page
    // doesn't surface as an unhandled promise rejection.
    void fetchMore({
      variables: { itemId, first: PAGE_SIZE, after: endCursor },
    }).catch(error =>
      errorService.reportError(error, {
        operation: 'PurchaseHistory.loadMore',
      }),
    );
  };

  // A failed read and a genuinely empty history are NOT the same thing, and the
  // screen used to render both as "No purchase history — mark this item as
  // purchased to start tracking history": advice to buy something the person
  // may well have bought already, shown precisely when the app does not know.
  // `useDataState` also splits offline out of error, which the empty state
  // cannot express at all.
  const state = useDataState({
    loading,
    error,
    hasResult: data !== undefined,
    isEmpty: purchases.length === 0,
  });

  const handleRetry = () => {
    // Under this query's `errorPolicy: 'none'` a failed refetch REJECTS rather
    // than resolving with the error, so this catch is the one that runs on an
    // ordinary failure — not just on a link-level throw. `useDataState` keeps
    // the error state on screen either way; reporting here is what stops the
    // rejection going unhandled.
    void refetch().catch(refetchError =>
      errorService.reportError(refetchError, {
        operation: 'PurchaseHistory.retry',
      }),
    );
  };

  // Summary stats over purchases that actually carry a price. Auto-recorded
  // purchases with no price are excluded so the average isn't dragged toward 0.
  const pricedPurchases = purchases.filter(p => p.totalPrice > 0);
  const currencyCode = pricedPurchases[0]?.currency.code;
  const spent = pricedPurchases.reduce((sum, p) => sum + p.totalPrice, 0);
  const totalSpent = formatPrice(spent, currencyCode);
  const averageSpent = pricedPurchases.length
    ? formatPrice(spent / pricedPurchases.length, currencyCode)
    : null;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <ThemedBackButton onPress={goBack} style={styles.backButton} />
        <View style={styles.headerContent}>
          <Text size="lg" weight="semibold">
            {t('labels.purchaseHistory')}
          </Text>
          <Text size="sm" tone="secondary" style={styles.headerSubtitle}>
            {itemName}
          </Text>
        </View>
        <View style={styles.headerSpacer} />
      </View>

      {/* Purchase List */}
      {state === 'loading' ? (
        <View style={styles.loadingContainer}>
          <ThemedActivityIndicator />
        </View>
      ) : (
        <PurchaseHistoryProvider value={{ totalCount }}>
          <FlashList
            data={purchases}
            keyExtractor={keyExtractor}
            renderItem={(info: ListRenderItemInfo<PurchaseItem>) => (
              <PurchaseHistoryItem {...info} />
            )}
            getItemType={getPurchaseItemType}
            {...FLASHLIST_DEFAULTS.fullScreen}
            onEndReached={loadMore}
            onEndReachedThreshold={0.4}
            ListHeaderComponent={
              purchases.length > 0 ? (
                <PurchaseHistoryHeader
                  totalCount={totalCount}
                  totalSpent={totalSpent}
                  averageSpent={averageSpent}
                />
              ) : null
            }
            ListFooterComponent={
              loadingMore ? (
                <ThemedActivityIndicator style={styles.footerLoader} />
              ) : null
            }
            ListEmptyComponent={
              state === 'error' || state === 'offline' ? (
                <DataStateView state={state} onRetry={handleRetry} />
              ) : (
                <PurchaseHistoryEmpty />
              )
            }
            contentContainerStyle={styles.content}
            style={styles.scrollView}
          />
        </PurchaseHistoryProvider>
      )}
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  backButton: {
    padding: theme.spacing.xs,
  },
  headerContent: {
    flex: 1,
    marginLeft: theme.spacing.sm,
  },
  headerSubtitle: {
    marginTop: 2,
  },
  headerSpacer: {
    width: 40, // Balance the back button
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: theme.spacing.md,
    flexGrow: 1,
  },
  statsContainer: {
    backgroundColor: theme.colors.infoLight,
    padding: theme.spacing.md,
    borderRadius: theme.radii.md,
    borderCurve: 'continuous',
    marginBottom: theme.spacing.md,
    borderWidth: 1,
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
    borderWidth: 1,
    marginVertical: theme.spacing.sm,
    borderColor: theme.colors.border,
  },
  purchaseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
    paddingBottom: theme.spacing.sm,
    borderBottomWidth: 1,
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
    color: theme.colors.white,
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
  purchaseDetailLabel: {
    marginLeft: theme.spacing.xs,
    marginRight: theme.spacing.xs,
  },
  purchaseDetailValue: {
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.xl * 2,
  },
  emptyText: {
    marginTop: theme.spacing.md,
  },
  emptySubtext: {
    marginTop: theme.spacing.xs,
    paddingHorizontal: theme.spacing.xl,
  },
  footerLoader: {
    paddingVertical: theme.spacing.md,
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));
