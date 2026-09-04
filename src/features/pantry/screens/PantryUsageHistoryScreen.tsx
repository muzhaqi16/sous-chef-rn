import React from 'react';
import { useTranslation } from '#/i18n';
import type { StaticScreenProps } from '@react-navigation/native';
import type { ListRenderItemInfo } from '@shopify/flash-list';
import { usePantryUsageHistory } from '#features/pantry/hooks/usePantryUsageHistory';
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

type RouteParams = {
  pantryItemId: string;
  itemName: string;
};

export const PantryUsageHistoryScreen: React.FC<
  StaticScreenProps<RouteParams>
> = ({ route }) => {
  const { t } = useTranslation();
  const { pantryItemId, itemName } = route.params;
  const { records, totalCount, state, loadMore, isFetchingMore, retry } =
    usePantryUsageHistory(pantryItemId);

  return (
    <PaginatedHistoryScreen
      title={t('pantryItemDetail.usageHistory')}
      subtitle={itemName}
      items={records}
      state={state}
      onRetry={retry}
      onEndReached={loadMore}
      isFetchingMore={isFetchingMore}
      keyExtractor={keyExtractor}
      renderItem={renderItem}
      getItemType={getItemType}
      summary={
        <Text role="caption" tone="secondary">
          {t('pantryItemDetail.usage.totalEntries', { count: totalCount })}
        </Text>
      }
      emptyIcon="time-outline"
      emptyTitle={t('pantryItemDetail.usage.emptyTitle')}
      componentName="PantryUsageHistoryScreen"
    />
  );
};
