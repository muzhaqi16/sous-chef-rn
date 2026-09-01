import React from 'react';
import { useTranslation } from '#/i18n';
import { useApolloClient, useQuery } from '@apollo/client/react';
import type { StaticScreenProps } from '@react-navigation/native';
import type { ListRenderItemInfo } from '@shopify/flash-list';
import { GetPantryItemBatchHistoryDocument } from '#features/pantry/graphql/pantry.generated';
import {
  PantryItemBatchFragmentDoc,
  type PantryItemBatchFragment,
} from '#features/pantry/graphql/pantryFragments.generated';
import { BatchStatus } from '#/graphql/generated/schemaTypes';
import { errorService } from '#/services/errorService';
import { useDataState } from '#hooks/data/useDataState';
import { PaginatedHistoryScreen } from '#components/templates/PaginatedHistoryScreen';
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
  const client = useApolloClient();
  const { pantryItemId, itemName, unitSymbol } = route.params;
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
  const materialized = (connection?.edges ?? []).map(edge =>
    client.cache.readFragment<PantryItemBatchFragment>({
      fragment: PantryItemBatchFragmentDoc,
      fragmentName: 'PantryItemBatchFragment',
      from: edge.node,
    }),
  );
  // `readFragment` returns null for a PARTIALLY cached batch exactly as for a
  // missing one, so a dropped row would vanish while every count still had it.
  const unreadable = materialized.filter(b => b == null).length;

  const batches: PantryItemBatchFragment[] = materialized
    .filter((b): b is PantryItemBatchFragment => b != null)
    // Active first, then the inactive history. Active batches in FIFO order, as
    // `BatchSection` shows them — otherwise "View all" reorders the rows the
    // reader was just looking at.
    .sort((a, b) => {
      const aActive = a.status === BatchStatus.Active ? 0 : 1;
      const bActive = b.status === BatchStatus.Active ? 0 : 1;
      if (aActive !== bActive) return aActive - bActive;
      if (aActive === 1) return a.batchNumber - b.batchNumber;
      if (!a.expiresAt && !b.expiresAt) return a.batchNumber - b.batchNumber;
      if (!a.expiresAt) return 1;
      if (!b.expiresAt) return -1;
      return new Date(a.expiresAt).getTime() - new Date(b.expiresAt).getTime();
    });

  const totalCount = connection?.totalCount ?? batches.length;
  // Only describes the whole connection once every page is loaded — otherwise
  // it counts the loaded window and would climb as the reader scrolls a pantry
  // that did not change. `unreadable` rows are in `totalCount` but not here.
  const allPagesLoaded = !connection?.pageInfo?.hasNextPage && unreadable === 0;
  const activeCount = allPagesLoaded
    ? batches.filter(b => b.status === BatchStatus.Active).length
    : null;
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

  const renderItem = ({
    item,
  }: ListRenderItemInfo<PantryItemBatchFragment>) => (
    <BatchListItem
      batch={item}
      unitSymbol={unitSymbol}
      onOpen={openBatch}
      onWaste={wasteBatch}
    />
  );

  return (
    <PaginatedHistoryScreen
      title={t('pantryItemDetail.batch.historyTitle')}
      subtitle={itemName}
      items={batches}
      state={state}
      onRetry={handleRetry}
      onEndReached={loadMore}
      isFetchingMore={loadingMore}
      keyExtractor={keyExtractor}
      renderItem={renderItem}
      getItemType={getItemType}
      summary={
        <Text size="sm" tone="secondary">
          {activeCount === null
            ? t('pantryItemDetail.batch.historyTotal', { count: totalCount })
            : t('pantryItemDetail.batch.historySummary', {
                active: activeCount,
                total: totalCount,
                count: activeCount,
              })}
        </Text>
      }
      emptyIcon="layers-outline"
      emptyTitle={t('pantryItemDetail.batch.emptyTitle')}
      componentName="PantryBatchHistoryScreen"
    />
  );
};
