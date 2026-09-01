import React, { useRef } from 'react';
import { View } from 'react-native';
import { useTranslation } from '#/i18n';
import { useApolloClient, useQuery } from '@apollo/client/react';
import type { StaticScreenProps } from '@react-navigation/native';
import {
  FlashList,
  type ListRenderItemInfo,
  type FlashListRef,
} from '@shopify/flash-list';
import { GetPantryItemBatchHistoryDocument } from '#features/pantry/graphql/pantry.generated';
import {
  PantryItemBatchFragmentDoc,
  type PantryItemBatchFragment,
} from '#features/pantry/graphql/pantryFragments.generated';
import { BatchStatus } from '#/graphql/generated/schemaTypes';
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
import { BatchListItem } from '#features/pantry/components/BatchListItem';
import { useOpenPantryItemBatch } from '#features/pantry/hooks/mutations/useOpenPantryItemBatch';
import { useWastePantryItemBatch } from '#features/pantry/hooks/mutations/useWastePantryItemBatch';

const keyExtractor = (item: PantryItemBatchFragment) => item.id;
const getItemType = (item: PantryItemBatchFragment) =>
  item.status === BatchStatus.Active ? 'active' : 'inactive';

const PAGE_SIZE = 30;

type RouteParams = {
  pantryItemId: string;
  itemName: string;
  unitSymbol?: string;
};

export const PantryBatchHistoryScreen: React.FC<
  StaticScreenProps<RouteParams>
> = ({ route }) => {
  const { t } = useTranslation();
  const { goBack } = useAppNavigation();
  const { pantryItemId, itemName, unitSymbol } = route.params;

  const client = useApolloClient();
  const { openBatch } = useOpenPantryItemBatch();
  const { wasteBatch } = useWastePantryItemBatch();

  const { data, loading, error, refetch, fetchMore, networkStatus } = useQuery(
    GetPantryItemBatchHistoryDocument,
    {
      variables: { pantryItemId, first: PAGE_SIZE },
      notifyOnNetworkStatusChange: true,
      // NOT the app-wide `'all'`: a field error would write a null over
      // `ROOT_QUERY.pantryItemBatchesConnection(...)`, which the detail screen
      // reads to derive its costs, where it sticks and persists to MMKV.
      errorPolicy: 'none',
    },
  );

  const connection = data?.pantryItemBatchesConnection;
  // Edges arrive MASKED, so `edge.node.status` is undefined — materialize each
  // before sorting or counting by it, as the detail screen does.
  const batches: PantryItemBatchFragment[] = (connection?.edges ?? [])
    .map(edge =>
      client.cache.readFragment<PantryItemBatchFragment>({
        fragment: PantryItemBatchFragmentDoc,
        fragmentName: 'PantryItemBatchFragment',
        from: edge.node,
      }),
    )
    .filter((b): b is PantryItemBatchFragment => b != null)
    // Active first, then the inactive history — the order the detail screen
    // shows and the order a reader expects to scan.
    .sort((a, b) => {
      const aActive = a.status === BatchStatus.Active ? 0 : 1;
      const bActive = b.status === BatchStatus.Active ? 0 : 1;
      if (aActive !== bActive) return aActive - bActive;
      return a.batchNumber - b.batchNumber;
    });

  const flashListRef = useRef<FlashListRef<PantryItemBatchFragment>>(null);
  const perfCallbacks = useFlashListPerformance(flashListRef, {
    componentName: 'PantryBatchHistoryScreen',
    hasRealContent: batches.length > 0,
  });
  useDataReferenceTracker(
    batches,
    'PantryBatchHistoryScreen.items',
    perfCallbacks.onDataReferenceChange,
  );

  const totalCount = connection?.totalCount ?? batches.length;
  const activeCount = batches.filter(
    b => b.status === BatchStatus.Active,
  ).length;
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
        operation: 'PantryBatchHistory.loadMore',
      }),
    );
  };

  const state = useDataState({
    loading,
    error,
    hasResult: data !== undefined,
    isEmpty: batches.length === 0,
  });

  const handleRetry = () => {
    void refetch().catch(refetchError =>
      errorService.reportError(refetchError, {
        operation: 'PantryBatchHistory.retry',
      }),
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <ThemedBackButton onPress={goBack} style={styles.backButton} />
        <View style={styles.headerContent}>
          <Text size="lg" weight="semibold">
            {t('pantryItemDetail.batch.historyTitle')}
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
          data={batches}
          keyExtractor={keyExtractor}
          renderItem={({
            item,
          }: ListRenderItemInfo<PantryItemBatchFragment>) => (
            <BatchListItem
              batch={item}
              unitSymbol={unitSymbol}
              onOpen={openBatch}
              onWaste={wasteBatch}
            />
          )}
          getItemType={getItemType}
          {...FLASHLIST_DEFAULTS.fullScreen}
          onEndReached={loadMore}
          onEndReachedThreshold={0.4}
          ListHeaderComponent={
            batches.length > 0 ? (
              <Text size="sm" tone="secondary" style={styles.summary}>
                {t('pantryItemDetail.batch.historySummary', {
                  active: activeCount,
                  total: totalCount,
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
                <Icon name="layers-outline" size={64} tone="iconDisabled" />
                <Text size="lg" weight="semibold" style={styles.emptyText}>
                  {t('pantryItemDetail.batch.emptyTitle')}
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
