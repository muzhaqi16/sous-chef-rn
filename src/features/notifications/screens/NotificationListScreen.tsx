import React, { useRef, useState } from 'react';
import { useTranslation } from '#/i18n';
import { View } from 'react-native';
import { useAppNavigation } from '#hooks/navigation/useAppNavigation';
import { StyleSheet } from 'react-native-unistyles';
import { NotificationItem } from '#features/notifications/components/NotificationItem';
import { EmptyNotifications } from '#features/notifications/components/EmptyNotifications';
import { DataStateView } from '#components/organisms/DataStateView';
import { useDataState } from '#hooks/data/useDataState';
import { NotificationHeader } from '#features/notifications/components/NotificationHeader';
import { NotificationGroupHeader } from '#features/notifications/components/NotificationGroupHeader';
import { NotificationFilters } from '#features/notifications/components/NotificationFilters';
import { UrgentNotificationsBanner } from '#features/notifications/components/UrgentNotificationsBanner';
import { useNotifications } from '#features/notifications/hooks/useNotifications';
import { useNotificationHistory } from '#features/notifications/hooks/useNotificationHistory';
import type { DisplayNotification as NotificationType } from '#features/notifications/utils/toDisplayNotification';
import { NotificationCategory } from '#/graphql/generated/schemaTypes';
import { Header } from '#components/organisms/Header';
import { ThemedActivityIndicator } from '#components/atoms/themedComponents';
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
  const { toPantryMain, toNotificationDetail, toNotificationSettings, goBack } =
    useAppNavigation();
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
    loadMore,
    loadingMore,
    loading: historyLoading,
    error: historyError,
    hasResult: historyHasResult,
    refetch: refetchHistory,
  } = useNotificationHistory(filterCategory, true);

  const filteredGroups = groupNotificationsByDate(notifications);

  const historyState = useDataState({
    loading: historyLoading,
    error: historyError,
    hasResult: historyHasResult,
    isEmpty: notifications.length === 0,
  });

  const handleNotificationPress = async (
    notification: NotificationType,
    actionHandler?: (notification: NotificationType) => void,
  ) => {
    // Mark as read
    if (!notification.isRead) {
      await handleMarkAsRead(notification.id);
    }

    // Handle actionable notifications first
    if (
      notification.requiresAction &&
      notification.actionType &&
      actionHandler
    ) {
      actionHandler(notification);
      return;
    }

    // Navigate based on type and action
    if (notification.requiresAction && notification.actionType) {
      switch (notification.actionType) {
        case 'ACCEPT_HOME_INVITE':
        case 'ACCEPT_SHOPPING_LIST_INVITE':
          if (actionHandler) {
            actionHandler(notification);
          }
          break;
        case 'VIEW_EXPIRING_ITEMS':
          if (actionHandler) {
            actionHandler(notification);
          } else {
            toPantryMain();
          }
          break;
        default:
          toNotificationDetail({ id: notification.id, notification });
      }
    } else if (
      notification.category !== NotificationCategory.Pantry &&
      notification.category !== NotificationCategory.Shopping
    ) {
      // Pantry/Shopping notifications have no dedicated destination to jump
      // to — tapping just marks them read (handled above). Other categories
      // open the detail screen, which has real content to show.
      toNotificationDetail({ id: notification.id, notification });
    }
  };

  // Headers inlined into one array; FlashList tells the two apart by item type.
  const rows = createNotificationFeedRows(filteredGroups);

  const hasNotifications = rows.length > 0;

  const keyExtractor = (row: NotificationFeedRow) =>
    row.kind === 'header' ? `header:${row.title}` : row.notification.id;

  const renderHeader = () => (
    <Header
      title={t('labels.notifications')}
      centerTitle={true}
      onBack={goBack}
      rightActions={[
        {
          icon: 'settings',
          accessibilityLabel: t('a11y.notificationSettings'),
          onPress: toNotificationSettings,
        },
      ]}
    />
  );

  const notificationActionRef = useRef<
    ((notification: NotificationType) => void) | null
  >(null);

  const renderRow = ({ item }: { item: NotificationFeedRow }) =>
    item.kind === 'header' ? (
      <NotificationGroupHeader title={item.title} />
    ) : (
      <NotificationItem
        notification={item.notification}
        onPress={notification =>
          handleNotificationPress(
            notification,
            notificationActionRef.current ?? undefined,
          )
        }
        onDismiss={handleRemoveNotification}
      />
    );

  return (
    <NotificationActionHandler>
      {({ handleNotificationAction }) => {
        notificationActionRef.current = handleNotificationAction;
        return (
          <View style={styles.container}>
            <UrgentNotificationsBanner
              urgentNotifications={filteredGroups.urgent}
            />

            {renderHeader()}

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
              ListEmptyComponent={
                // The feed renders from the store, so an empty store looks
                // exactly like a failed fetch unless the query is asked — and
                // "You're all caught up" is the wrong thing to tell someone
                // whose notifications simply did not load.
                historyState === 'error' || historyState === 'offline' ? (
                  <DataStateView
                    state={historyState}
                    onRetry={refetchHistory}
                  />
                ) : (
                  <EmptyNotifications />
                )
              }
              ListFooterComponent={
                loadingMore ? (
                  <ThemedActivityIndicator style={styles.footerLoader} />
                ) : null
              }
              onEndReached={loadMore}
              onEndReachedThreshold={0.4}
              contentContainerStyle={
                !hasNotifications ? styles.emptyInset : undefined
              }
            />
          </View>
        );
      }}
    </NotificationActionHandler>
  );
};

const styles = StyleSheet.create(theme => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  emptyInset: {
    flex: 1,
  },
  footerLoader: {
    paddingVertical: theme.spacing.md,
  },
}));
