import React from 'react';
import type { ListRenderItemInfo } from '@shopify/flash-list';
import { useTranslation } from '#/i18n';
import { PaginatedHistoryScreen } from '#components/templates/PaginatedHistoryScreen';
import { useMyReports, type MyReportNode } from './useMyReports';
import { MyReportRow } from '#features/profile/components/MyReportRow';

const keyExtractor = (item: MyReportNode) => item.id;
const getItemType = () => 'report';
const renderItem = ({ item }: ListRenderItemInfo<MyReportNode>) => (
  <MyReportRow reportRef={item} />
);

export const MyReportsScreen: React.FC = () => {
  const { t } = useTranslation();
  const { reports, state, hasMore, isLoadingMore, loadMore, retry } =
    useMyReports();

  return (
    <PaginatedHistoryScreen
      title={t('reports.myReportsTitle')}
      items={reports}
      state={state}
      onRetry={retry}
      onEndReached={loadMore}
      hasNextPage={hasMore}
      isFetchingMore={isLoadingMore}
      keyExtractor={keyExtractor}
      renderItem={renderItem}
      getItemType={getItemType}
      emptyIcon="flag-outline"
      emptyTitle={t('reports.emptyTitle')}
      emptyDescription={t('reports.emptyDescription')}
      componentName="MyReportsScreen"
    />
  );
};

export default MyReportsScreen;
