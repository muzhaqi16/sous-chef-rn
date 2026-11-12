import React, { useRef, useState } from 'react';
import { useTranslation } from '#/i18n';
import { useAppNavigation } from '#hooks/navigation/useAppNavigation';
import { StyleSheet } from 'react-native-unistyles';
import { NotificationItem } from '#features/notifications/components/NotificationItem';
import { EmptyNotifications } from '#features/notifications/components/EmptyNotifications';
import { DataStateView } from '#components/organisms/DataStateView';
import { PartialDataNote } from '#components/molecules/PartialDataNote';
import { useDataState } from '#hooks/data/useDataState';
import { NotificationHeader } from '#features/notifications/components/NotificationHeader';
import { NotificationGroupHeader } from '#features/notifications/components/NotificationGroupHeader';
import { NotificationFilters } from '#features/notifications/components/NotificationFilters';
import { UrgentNotificationsBanner } from '#features/notifications/components/UrgentNotificationsBanner';
import { useNotifications } from '#features/notifications/hooks/useNotifications';
import { useNotificationHistory } from '#features/notifications/hooks/useNotificationHistory';
import type { DisplayNotification as NotificationType } from '#features/notifications/utils/toDisplayNotification';
import { NotificationCategory } from '#/graphql/generated/schemaTypes';
import { SubScreen } from '#components/templates/SubScreen';
import { useScreenListInset } from '#components/templates/useScreenListInset';
import { PaginationFooter } from '#components/atoms/PaginationFooter';
import { NotificationActionHandler } from '#features/notifications/components/NotificationActionHandler';
import {
  groupNotificationsByDate,
  createNotificationFeedRows,
  type NotificationFeedRow,
} from '#features/notifications/utils/notificationGrouping';
import { FlashList } from '@shopify/flash-list';
import { SwipeAwareScrollComponent } from '#components/atoms/SwipeAwareScrollComponent';
import { useScreenTransition } from '#hooks/performance/useScreenTransition';

export const NotificationListScreen: React.FC = () => {
  const { t } = useTranslation();
  useScreenTransition('NotificationListScreen');
  const listInset = useScreenListInset();
  const { toNotificationDetail, toNotificationSettings } = useAppNavigation();
  const [filterCategory, setFilterCategory] =
    useState<NotificationCategory | null>(null);

  const {
    handleMarkAsRead,
    handleMarkAllAsRead,
    handleRemoveNotification,
    handleClearRead,
  } = useNotifications();

  // The feed. The category filter is applied SERVER-side by this query, so
  // there is no second client-side filter here: one over a local copy of the
  // same rows could disagree with the query that produced them.
  const {
    notifications,
    hasMore,
    loadMore,
    loadingMore,
    loading: historyLoading,
    error: historyError,
    hasResult: historyHasResult,
    mayHoldMore,
    refetch: refetchHistory,
  } = useNotificationHistory(filterCategory, true);

  const filteredGroups = groupNotificationsByDate(notifications);

  const historyState = useDataState({
    loading: historyLoading,
    error: historyError,
    hasResult: historyHasResult,
    isEmpty: notifications.length === 0,
  });

  const handleNotificationPress = (notification: NotificationType) => {
    // Never awaited: the read shows at once, and a tap must not wait on the
    // server. A read row is left alone by the hook.
    void handleMarkAsRead(notification.id);

    if (notification.requiresAction && notification.actionType) {
      notificationActionRef.current?.(notification);
    } else if (
      notification.category !== NotificationCategory.Pantry &&
      notification.category !== NotificationCategory.Shopping
    ) {
      // Pantry/Shopping notifications have no dedicated destination to jump
      // to — tapping just marks them read. Other categories open the detail
      // screen, which has real content to show.
      toNotificationDetail({ id: notification.id, notification });
    }
  };

  // Headers inlined into one array; FlashList tells the two apart by item type.
  const rows = createNotificationFeedRows(filteredGroups, t);

  const hasNotifications = rows.length > 0;

  const keyExtractor = (row: NotificationFeedRow) =>
    row.kind === 'header' ? `header:${row.title}` : row.notification.id;

  const notificationActionRef = useRef<
    ((notification: NotificationType) => void) | null
  >(null);

  const renderRow = ({ item }: { item: NotificationFeedRow }) =>
    item.kind === 'header' ? (
      <NotificationGroupHeader title={item.title} />
    ) : (
      <NotificationItem
        notification={item.notification}
        onPress={handleNotificationPress}
        onDismiss={handleRemoveNotification}
      />
    );

  return (
    <NotificationActionHandler>
      {({ handleNotificationAction }) => {
        notificationActionRef.current = handleNotificationAction;
        return (
          <SubScreen
            title={t('labels.notifications')}
            actions={[
              {
                icon: 'settings',
                accessibilityLabel: t('a11y.notificationSettings'),
                onPress: toNotificationSettings,
              },
            ]}
            scroll="list"
            gutter="none"
          >
            <UrgentNotificationsBanner
              urgentNotifications={filteredGroups.urgent}
            />

            <NotificationFilters
              selectedCategory={filterCategory}
              onCategoryChange={setFilterCategory}
            />

            <NotificationHeader
              onMarkAllRead={handleMarkAllAsRead}
              onClearRead={() =>
                handleClearRead(
                  notifications.filter(n => n.isRead).map(n => n.id),
                )
              }
              hasNotifications={hasNotifications}
            />

            <FlashList
              data={rows}
              keyExtractor={keyExtractor}
              renderItem={renderRow}
              getItemType={row => row.kind}
              renderScrollComponent={SwipeAwareScrollComponent}
              ListHeaderComponent={
                mayHoldMore && hasNotifications ? (
                  <PartialDataNote onRetry={refetchHistory} />
                ) : null
              }
              ListEmptyComponent={
                // An empty feed looks like a failed fetch unless the query is
                // asked, and "all caught up" is wrong for a feed that never
                // loaded.
                mayHoldMore ? (
                  <DataStateView state="offline" onRetry={refetchHistory} />
                ) : historyState === 'error' || historyState === 'offline' ? (
                  <DataStateView
                    state={historyState}
                    onRetry={refetchHistory}
                  />
                ) : (
                  <EmptyNotifications />
                )
              }
              ListFooterComponent={
                <PaginationFooter
                  hasMore={hasMore}
                  isFetchingMore={loadingMore}
                  itemCount={notifications.length}
                />
              }
              onEndReached={loadMore}
              onEndReachedThreshold={0.4}
              contentContainerStyle={[
                !hasNotifications && styles.emptyInset,
                listInset,
              ]}
            />
          </SubScreen>
        );
      }}
    </NotificationActionHandler>
  );
};

const styles = StyleSheet.create({
  emptyInset: {
    flex: 1,
  },
});
