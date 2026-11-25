import React, { useState } from 'react';
import { useTranslation } from '#i18n';
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
import type { NotificationCategory } from '#graphql/generated/schemaTypes';
import { notificationDestination } from '#services/push/notificationDestination';
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
  useScreenTransition('NotificationListScreen');
  return (
    <NotificationActionHandler>
      {({ handleNotificationAction }) => (
        <NotificationFeed onAction={handleNotificationAction} />
      )}
    </NotificationActionHandler>
  );
};

/** The feed; a notification that asks for an action goes to `onAction`. */
const NotificationFeed: React.FC<{
  onAction: (notification: NotificationType) => void;
}> = ({ onAction }) => {
  const { t } = useTranslation();
  const listInset = useScreenListInset();
  const {
    toNotificationDetail,
    toNotificationSettings,
    toPantryMain,
    toShoppingListMain,
    toRecipeMain,
    toMealPlanMain,
  } = useAppNavigation();
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

  /** A feature's own tab; false for one this screen cannot open. */
  const openTab = (tab: string): boolean => {
    switch (tab) {
      case 'Pantry':
        toPantryMain();
        return true;
      case 'ShoppingList':
        toShoppingListMain();
        return true;
      case 'Recipe':
        toRecipeMain();
        return true;
      case 'MealPlan':
        toMealPlanMain();
        return true;
      default:
        return false;
    }
  };

  // Where it leads is `notificationDestination`'s, which a tapped push asks too.
  const handleNotificationPress = (notification: NotificationType) => {
    // Never awaited: the read shows at once, and a tap must not wait on the
    // server. A read row is left alone by the hook.
    void handleMarkAsRead(notification.id);

    if (notification.requiresAction && notification.actionType) {
      onAction(notification);
      return;
    }
    const destination = notificationDestination(
      notification.category,
      notification.id,
    );
    if (destination.kind === 'feature' && openTab(destination.tab)) return;
    toNotificationDetail({ id: notification.id, notification });
  };

  // Headers inlined into one array; FlashList tells the two apart by item type.
  const rows = createNotificationFeedRows(filteredGroups, t);

  const hasNotifications = rows.length > 0;

  const keyExtractor = (row: NotificationFeedRow) =>
    row.kind === 'header' ? `header:${row.title}` : row.notification.id;

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
      <UrgentNotificationsBanner urgentNotifications={filteredGroups.urgent} />

      <NotificationFilters
        selectedCategory={filterCategory}
        onCategoryChange={setFilterCategory}
      />

      <NotificationHeader
        onMarkAllRead={handleMarkAllAsRead}
        onClearRead={() =>
          handleClearRead(notifications.filter(n => n.isRead).map(n => n.id))
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
            <DataStateView state={historyState} onRetry={refetchHistory} />
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
          styles.gutter,
          !hasNotifications && styles.emptyInset,
          listInset,
        ]}
      />
    </SubScreen>
  );
};

const styles = StyleSheet.create(theme => ({
  // Each row is its own card on the page.
  gutter: {
    paddingHorizontal: theme.layout.pageGutter,
  },
  emptyInset: {
    flex: 1,
  },
}));
