import React, { useRef } from 'react';
import { View } from 'react-native';
import { useTranslation } from '#/i18n';
import { useQuery } from '@apollo/client/react';
import type { StaticScreenProps } from '@react-navigation/native';
import {
  FlashList,
  type ListRenderItemInfo,
  type FlashListRef,
} from '@shopify/flash-list';
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
import { useFlashListPerformance } from '#hooks/performance/useFlashListPerformance';
import { useDataReferenceTracker } from '#hooks/performance/useDataReferenceTracker';
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
 * Derived from the query rather than restated beside it, so it cannot disagree
 * with the schema (`user.email` is nullable — self-or-admin only).
 */
type PurchaseItem = NonNullable<
  GetItemPurchaseHistoryQuery['shoppingListItem']
>['purchasesConnection']['edges'][number]['node'];

// An `undefined` locale makes Intl use the device's own, so the field order
// follows the reader rather than forcing US month-day.
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
  // At quantity 1 the per-unit price IS the total; repeating it reads as noise.
  const perUnitText =
    purchase.quantity > 1
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

export const PurchaseHistoryScreen: React.FC<
  StaticScreenProps<RouteParams>
> = ({ route }) => {
  const { t } = useTranslation();
  const { goBack } = useAppNavigation();
  const { itemId, itemName } = route.params;

  // On demand: ItemDetail carries only the summary, and a frequently re-bought
  // item runs past one page.
  const { data, loading, error, refetch, fetchMore, networkStatus } = useQuery(
    GetItemPurchaseHistoryDocument,
    {
      variables: { itemId, first: PAGE_SIZE },
      notifyOnNetworkStatusChange: true,
      // NOT the app-wide `'all'`: a field error inside the non-null
      // `purchasesConnection` nulls `shoppingListItem`, and `'all'` WRITES that
      // null onto `ROOT_QUERY.shoppingListItem({id})` — the field ItemDetail
      // reads — where it sticks (the redirect fires only on `undefined`) and
      // persists to MMKV. The cost of `'none'` is losing a partial page.
      errorPolicy: 'none',
    },
  );

  const connection = data?.shoppingListItem?.purchasesConnection;
  const purchases: PurchaseItem[] =
    connection?.edges?.map(edge => edge.node) ?? [];

  // A full screen, so `flashlist_initial_load_ms` and blank-cell episodes are
  // worth the per-cell wrapper's cost (sampled 5% in release).
  const flashListRef = useRef<FlashListRef<PurchaseItem>>(null);
  const perfCallbacks = useFlashListPerformance(flashListRef, {
    componentName: 'PurchaseHistoryScreen',
    hasRealContent: purchases.length > 0,
  });
  useDataReferenceTracker(
    purchases,
    'PurchaseHistoryScreen.items',
    perfCallbacks.onDataReferenceChange,
  );

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

  // A failed read is not an empty history: rendering both as the empty state
  // advises buying something the user may already own, exactly when the app
  // cannot know. `useDataState` also splits offline out of error.
  const state = useDataState({
    loading,
    error,
    hasResult: data !== undefined,
    isEmpty: purchases.length === 0,
  });

  const handleRetry = () => {
    // Under `errorPolicy: 'none'` a failed refetch REJECTS rather than
    // resolving with the error, so this catch runs on an ordinary failure too.
    void refetch().catch(refetchError =>
      errorService.reportError(refetchError, {
        operation: 'PurchaseHistory.retry',
      }),
    );
  };

  // Priced purchases only — auto-recorded ones would drag the average to 0.
  const pricedPurchases = purchases.filter(p => p.totalPrice > 0);
  const currencyCode = pricedPurchases[0]?.currency.code;
  const spent = pricedPurchases.reduce((sum, p) => sum + p.totalPrice, 0);
  const totalSpent = formatPrice(spent, currencyCode);
  const averageSpent = pricedPurchases.length
    ? formatPrice(spent / pricedPurchases.length, currencyCode)
    : null;

  return (
    <View style={styles.container}>
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

      {state === 'loading' ? (
        <View style={styles.loadingContainer}>
          <ThemedActivityIndicator />
        </View>
      ) : (
        <PurchaseHistoryProvider value={{ totalCount }}>
          <FlashList
            ref={flashListRef}
            CellRendererComponent={perfCallbacks.CellRendererComponent}
            onLoad={perfCallbacks.onLoad}
            onViewableItemsChanged={perfCallbacks.onViewableItemsChanged}
            onCommitLayoutEffect={perfCallbacks.onCommitLayoutEffect}
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
