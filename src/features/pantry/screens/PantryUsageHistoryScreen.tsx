import React from 'react';
import { useTranslation } from '#/i18n';
import { useQuery } from '@apollo/client/react';
import type { StaticScreenProps } from '@react-navigation/native';
import type { ListRenderItemInfo } from '@shopify/flash-list';
import { GetPantryItemUsageHistoryDocument } from '#features/pantry/graphql/pantry.generated';
import { errorService } from '#/services/errorService';
import { useDataState } from '#hooks/data/useDataState';
import { PaginatedHistoryScreen } from '#components/templates/PaginatedHistoryScreen';
import { Text } from '#components/atoms/Text';
import {
  UsageHistoryRow,
  type UsageRecord,
} from '#features/pantry/components/UsageHistoryRow';

const keyExtractor = (item: UsageRecord) => item.id;
const getItemType = () => 'usage';
const renderItem = ({ item }: ListRenderItemInfo<UsageRecord>) => (
  <UsageHistoryRow usage={item} />
);

const PAGE_SIZE = 30;

type RouteParams = {
  pantryItemId: string;
  itemName: string;
};

export const PantryUsageHistoryScreen: React.FC<
  StaticScreenProps<RouteParams>
> = ({ route }) => {
  const { t } = useTranslation();
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
    <PaginatedHistoryScreen
      title={t('pantryItemDetail.usageHistory')}
      subtitle={itemName}
      items={records}
      state={state}
      onRetry={handleRetry}
      onEndReached={loadMore}
      isFetchingMore={loadingMore}
      keyExtractor={keyExtractor}
      renderItem={renderItem}
      getItemType={getItemType}
      summary={
        <Text size="sm" tone="secondary">
          {t('pantryItemDetail.usage.totalEntries', { count: totalCount })}
        </Text>
      }
      emptyIcon="time-outline"
      emptyTitle={t('pantryItemDetail.usage.emptyTitle')}
      componentName="PantryUsageHistoryScreen"
    />
  );
};
