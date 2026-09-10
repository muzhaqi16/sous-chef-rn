import React from 'react';
import { useTranslation } from '#/i18n';
import type { StaticScreenProps } from '@react-navigation/native';
import type { ListRenderItemInfo } from '@shopify/flash-list';
import type { PantryItemBatchFragment } from '#features/pantry/graphql/pantryFragments.generated';
import { BatchStatus } from '#/graphql/generated/schemaTypes';
import { usePantryBatchHistory } from '#features/pantry/hooks/usePantryBatchHistory';
import { PaginatedHistoryScreen } from '#components/templates/PaginatedHistoryScreen';
import { Text } from '#components/atoms/Text';
import { BatchListItem } from '#features/pantry/components/BatchListItem';
import { useOpenPantryItemBatch } from '#features/pantry/hooks/mutations/useOpenPantryItemBatch';
import { useWastePantryItemBatch } from '#features/pantry/hooks/mutations/useWastePantryItemBatch';

const keyExtractor = (item: PantryItemBatchFragment) => item.id;
const getItemType = (item: PantryItemBatchFragment) =>
  item.status === BatchStatus.Active ? 'active' : 'inactive';

type RouteParams = {
  pantryItemId: string;
  itemName: string;
  unitSymbol?: string;
};

export const PantryBatchHistoryScreen: React.FC<
  StaticScreenProps<RouteParams>
> = ({ route }) => {
  const { t } = useTranslation();
  const { pantryItemId, itemName, unitSymbol } = route.params;
  const { openBatch } = useOpenPantryItemBatch();
  const { wasteBatch } = useWastePantryItemBatch();
  const {
    batches,
    totalCount,
    activeCount,
    state,
    loadMore,
    isFetchingMore,
    retry,
  } = usePantryBatchHistory(pantryItemId);

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
      onRetry={retry}
      onEndReached={loadMore}
      isFetchingMore={isFetchingMore}
      keyExtractor={keyExtractor}
      renderItem={renderItem}
      getItemType={getItemType}
      summary={
        <Text role="caption" tone="secondary">
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
