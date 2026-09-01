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
import { GetPantryItemUsageHistoryDocument } from '#features/pantry/graphql/pantry.generated';
import { errorService } from '#/services/errorService';
import {
  ThemedActivityIndicator,
  ThemedBackButton,
} from '#components/atoms/themedComponents';
import { StyleSheet } from 'react-native-unistyles';
import { useAppNavigation } from '#hooks/navigation/useAppNavigation';
import { Icon } from '#utils/iconUtils';
import { FLASHLIST_DEFAULTS } from '#utils/flashListDefaults';
import { useFlashListPerformance } from '#hooks/performance/useFlashListPerformance';
import { useDataReferenceTracker } from '#hooks/performance/useDataReferenceTracker';
import { DataStateView } from '#components/molecules/DataStateView';
import { useDataState } from '#hooks/data/useDataState';
import { Text } from '#components/atoms/Text';
import {
  UsageHistoryRow,
  type UsageRecord,
} from '#features/pantry/components/UsageHistoryRow';

const keyExtractor = (item: UsageRecord) => item.id;
const getItemType = () => 'usage';

const PAGE_SIZE = 30;

type RouteParams = {
  pantryItemId: string;
  itemName: string;
};

export const PantryUsageHistoryScreen: React.FC<
  StaticScreenProps<RouteParams>
> = ({ route }) => {
  const { t } = useTranslation();
  const { goBack } = useAppNavigation();
  const { pantryItemId, itemName } = route.params;

  const { data, loading, error, refetch, fetchMore, networkStatus } = useQuery(
    GetPantryItemUsageHistoryDocument,
    {
      variables: { pantryItemId, first: PAGE_SIZE },
      notifyOnNetworkStatusChange: true,
      // NOT the app-wide `'all'`: a field error nulls the non-null
      // `usageRecords` and so `pantryItem`, and `'all'` WRITES that null onto
      // `ROOT_QUERY.pantryItem({id})` — the field the detail screen reads —
      // where it sticks and persists to MMKV.
      errorPolicy: 'none',
    },
  );

  const connection = data?.pantryItem?.usageRecords;
  const records: UsageRecord[] = connection?.edges?.map(e => e.node) ?? [];

  const flashListRef = useRef<FlashListRef<UsageRecord>>(null);
  const perfCallbacks = useFlashListPerformance(flashListRef, {
    componentName: 'PantryUsageHistoryScreen',
    hasRealContent: records.length > 0,
  });
  useDataReferenceTracker(
    records,
    'PantryUsageHistoryScreen.items',
    perfCallbacks.onDataReferenceChange,
  );

  const totalCount = connection?.totalCount ?? records.length;
  const hasNextPage = connection?.pageInfo?.hasNextPage ?? false;
  const endCursor = connection?.pageInfo?.endCursor ?? null;
  // networkStatus 3 = fetchMore in flight.
  const loadingMore = networkStatus === 3;

  const loadMore = () => {
    if (!hasNextPage || !endCursor || loading || loadingMore) return;
    void fetchMore({
      variables: { pantryItemId, first: PAGE_SIZE, after: endCursor },
    }).catch(fetchError =>
      errorService.reportError(fetchError, {
        operation: 'PantryUsageHistory.loadMore',
      }),
    );
  };

  // A failed read is not an empty ledger — `useDataState` also splits offline
  // out of error so the retry is offered only where retrying can help.
  const state = useDataState({
    loading,
    error,
    hasResult: data !== undefined,
    isEmpty: records.length === 0,
  });

  const handleRetry = () => {
    // Under `errorPolicy: 'none'` a failed refetch REJECTS rather than
    // resolving with the error, so this catch runs on an ordinary failure too.
    void refetch().catch(refetchError =>
      errorService.reportError(refetchError, {
        operation: 'PantryUsageHistory.retry',
      }),
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <ThemedBackButton onPress={goBack} style={styles.backButton} />
        <View style={styles.headerContent}>
          <Text size="lg" weight="semibold">
            {t('pantryItemDetail.usageHistory')}
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
        <FlashList
          ref={flashListRef}
          CellRendererComponent={perfCallbacks.CellRendererComponent}
          onLoad={perfCallbacks.onLoad}
          onViewableItemsChanged={perfCallbacks.onViewableItemsChanged}
          onCommitLayoutEffect={perfCallbacks.onCommitLayoutEffect}
          data={records}
          keyExtractor={keyExtractor}
          renderItem={({ item }: ListRenderItemInfo<UsageRecord>) => (
            <UsageHistoryRow usage={item} />
          )}
          getItemType={getItemType}
          {...FLASHLIST_DEFAULTS.fullScreen}
          onEndReached={loadMore}
          onEndReachedThreshold={0.4}
          ListHeaderComponent={
            records.length > 0 ? (
              <Text size="sm" tone="secondary" style={styles.summary}>
                {t('pantryItemDetail.usage.totalEntries', {
                  count: totalCount,
                })}
              </Text>
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
              <View style={styles.emptyContainer}>
                <Icon name="time-outline" size={64} tone="iconDisabled" />
                <Text size="lg" weight="semibold" style={styles.emptyText}>
                  {t('pantryItemDetail.usage.emptyTitle')}
                </Text>
              </View>
            )
          }
          contentContainerStyle={styles.content}
          style={styles.scrollView}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    backgroundColor: theme.colors.surface,
  },
  backButton: {
    marginRight: theme.spacing.sm,
  },
  headerContent: {
    flex: 1,
  },
  headerSubtitle: {
    marginTop: theme.spacing.xs,
  },
  headerSpacer: {
    width: theme.spacing.xl,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: theme.spacing.md,
  },
  summary: {
    marginBottom: theme.spacing.sm,
  },
  footerLoader: {
    marginVertical: theme.spacing.lg,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: theme.spacing.xl,
  },
  emptyText: {
    marginTop: theme.spacing.md,
  },
}));
