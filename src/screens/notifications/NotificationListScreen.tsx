import React, { useState, useCallback, useMemo } from 'react';
import { View, SectionList, RefreshControl } from 'react-native';
import { useAppNavigation } from '#hooks';
import { StyleSheet } from 'react-native-unistyles';
import {
  NotificationItem,
  EmptyNotifications,
  NotificationHeader,
  NotificationGroupHeader,
  NotificationFilters,
  UrgentNotificationsBanner,
} from '#components/notifications';
import { useNotifications } from '#hooks';
import {
  NotificationItem as NotificationType,
  NotificationCategory,
} from '#store/slices/notificationSlice';
import { NotificationStackParamList } from '#navigation/stacks/NotificationStack';
import { Header } from '#components/molecules/Header';
import { NotificationActionHandler } from '#components/notifications/NotificationActionHandler';
import {
  groupNotificationsByDate,
  createSectionListData,
} from '#utils/notificationGrouping';

export const NotificationListScreen: React.FC<{
  route: { params?: NotificationStackParamList['NotificationList'] };
}> = () => {
  const { navigate, navigateTo, goBack } = useAppNavigation();
  const [filterCategory, setFilterCategory] =
    useState<NotificationCategory | null>(null);

  const {
    notifications,
    handleMarkAsRead,
    handleMarkAllAsRead,
    handleRemoveNotification,
    clearAll,
    getNotificationsByCategory,
  } = useNotifications();

  // Initialize real-time notifications (already handled by consolidated useNotifications)
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    // Add server sync logic here if needed
    setTimeout(() => setIsRefreshing(false), 1000);
  }, []);

  // Filter notifications based on selected category
  const filteredNotifications = useMemo(() => {
    if (!filterCategory) return notifications;
    return getNotificationsByCategory(filterCategory);
  }, [notifications, filterCategory, getNotificationsByCategory]);

  // Group filtered notifications using utility
  const filteredGroups = useMemo(() => {
    return groupNotificationsByDate(filteredNotifications);
  }, [filteredNotifications]);

  const handleNotificationPress = useCallback(
    async (
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
          case 'ACCEPT_INVITE':
          case 'ACCEPT_HOME_INVITE':
          case 'ACCEPT_SHOPPING_LIST_INVITE':
            // These will be handled by the action handler
            if (actionHandler) {
              actionHandler(notification);
            }
            break;
          case 'ADD_TO_SHOPPING_LIST':
            navigateTo.shoppingListMain();
            break;
          case 'VIEW_EXPIRING_ITEMS':
            // Navigate to main pantry - expired items now shown inline
            navigate('Pantry');
            break;
          case 'REVIEW_SECURITY':
            navigateTo.profile();
            break;
          default:
            navigate('NotificationDetail', {
              notification,
            });
        }
      } else {
        // Default navigation based on category
        switch (notification.category) {
          case NotificationCategory.SHOPPING_LIST:
            navigateTo.shoppingListMain();
            break;
          case NotificationCategory.PANTRY:
            navigateTo.pantryMain();
            break;
          case NotificationCategory.SECURITY:
            navigateTo.profile();
            break;
          default:
            navigate('NotificationDetail', {
              notification,
            });
        }
      }
    },
    [handleMarkAsRead, navigate, navigateTo],
  );

  // Prepare sections for SectionList using utility
  const sections = createSectionListData(filteredGroups);

  const hasNotifications = sections.length > 0;

  const renderHeader = () => (
    <Header
      title="Notifications"
      centerTitle={true}
      onBack={goBack}
      rightActions={[
        {
          icon: 'settings',
          onPress: () => navigate('NotificationSettings'),
        },
      ]}
    />
  );

  return (
    <NotificationActionHandler>
      {({ handleNotificationAction }) => (
        <View style={styles.container}>
          <UrgentNotificationsBanner
            urgentNotifications={filteredGroups.urgent}
          />

          <NotificationHeader
            onMarkAllRead={handleMarkAllAsRead}
            onClearAll={clearAll}
            hasNotifications={hasNotifications}
          />

          {renderHeader()}

          <NotificationFilters
            selectedCategory={filterCategory}
            onCategoryChange={setFilterCategory}
          />

          <SectionList
            sections={sections}
            keyExtractor={item => item.id}
            renderItem={({ item }) => (
              <NotificationItem
                notification={item}
                onPress={notification =>
                  handleNotificationPress(
                    notification,
                    handleNotificationAction,
                  )
                }
                onDismiss={handleRemoveNotification}
              />
            )}
            renderSectionHeader={({ section }) => (
              <NotificationGroupHeader title={section.title} />
            )}
            ListEmptyComponent={<EmptyNotifications />}
            contentContainerStyle={
              !hasNotifications ? styles.emptyContainer : undefined
            }
            refreshControl={
              <RefreshControl
                refreshing={isRefreshing}
                onRefresh={handleRefresh}
              />
            }
          />
        </View>
      )}
    </NotificationActionHandler>
  );
};

const styles = StyleSheet.create(theme => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  emptyContainer: {
    flex: 1,
  },
}));
