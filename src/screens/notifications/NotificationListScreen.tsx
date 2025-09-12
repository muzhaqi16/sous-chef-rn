import React, {useState, useCallback, useMemo} from 'react';
import {View, SectionList, RefreshControl} from 'react-native';
import {useNavigationFlow} from '#hooks';
import {StyleSheet} from 'react-native-unistyles';
import {
  NotificationItem,
  EmptyNotifications,
  NotificationHeader,
  NotificationGroupHeader,
  useNotificationSync,
  NotificationFilters,
  UrgentNotificationsBanner,
} from '#components/notifications';
import {
  useNotifications,
  useRealTimeNotifications,
  useNotificationRefresh,
} from '#hooks';
import {
  NotificationItem as NotificationType,
  NotificationCategory,
  NotificationPriority,
} from '#store/slices/notificationSlice';
import {NotificationListNavProp} from '#navigation';
import {useStore} from '#store';
import {Header} from '#components/molecules/Header';
import {NotificationActionHandler} from '#components/notifications/NotificationActionHandler';
import {
  groupNotificationsByDate,
  createSectionListData,
} from '#utils/notificationGrouping';

export const NotificationListScreen: React.FC = () => {
  const {
    navigateWithinStack,
    navigateToShoppingList,
    navigateToPantry,
    navigateToProfile,
    goBack,
  } = useNavigationFlow();
  const [filterCategory, setFilterCategory] =
    useState<NotificationCategory | null>(null);
  const userId = useStore(state => state.user?.id);

  const {
    notifications,
    handleMarkAsRead,
    handleMarkAllAsRead,
    handleRemoveNotification,
    clearAll,
    getNotificationsByCategory,
  } = useNotifications();

  // Initialize real-time notifications
  const {notificationCount, config} = useRealTimeNotifications({
    enablePantryNotifications: true,
    enableShoppingListNotifications: true,
    enableMembershipNotifications: true,
    enableLowStockAlerts: true,
    enableExpirationAlerts: true,
    enableCollaborationNotifications: true,
    showInAppNotifications: true,
    showPushNotifications: true,
  });

  // Server sync management (returns refetch function)
  const {refetch} = useNotificationSync({userId});

  // Refresh handling
  const {isRefreshing, handleRefresh} = useNotificationRefresh({
    refetch,
  });

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
            navigateToShoppingList('ShoppingListMain', notification.actionData);
            break;
          case 'VIEW_EXPIRING_ITEMS':
            navigateToPantry('ExpiringItems', notification.actionData);
            break;
          case 'REVIEW_SECURITY':
            navigateToProfile('ProfileSettings');
            break;
          default:
            navigateWithinStack('NotificationDetail', {
              notification,
            });
        }
      } else {
        // Default navigation based on category
        switch (notification.category) {
          case NotificationCategory.SHOPPING_LIST:
            navigateToShoppingList('ListSettings', {
              listId: notification.payload.listId,
            });
            break;
          case NotificationCategory.PANTRY:
            navigateToPantry();
            break;
          case NotificationCategory.SECURITY:
            navigateToProfile('ProfileSettings');
            break;
          default:
            navigateWithinStack('NotificationDetail', {
              notification,
            });
        }
      }
    },
    [handleMarkAsRead, navigateWithinStack],
  );

  // Test notification creation
  const addNotification = useStore(state => state.addNotification);
  const handleTestNotification = () => {
    const testNotification = {
      id: `test-${Date.now()}`,
      type: 'HomeJoined' as any,
      category: NotificationCategory.MEMBERSHIP,
      priority: NotificationPriority.HIGH,
      title: 'Test Notification',
      message: 'This is a test notification to verify the system is working',
      payload: {test: true},
      sentAt: new Date().toISOString(),
    };
    console.log('Creating test notification:', testNotification);
    addNotification(testNotification);
  };

  // Prepare sections for SectionList using utility
  const sections = createSectionListData(filteredGroups);

  const hasNotifications = sections.length > 0;

  const renderHeader = () => (
    <Header
      title={'Notifications'}
      centerTitle={true}
      onBack={goBack}
      rightActions={[
        {
          icon: 'bug-report',
          onPress: handleTestNotification,
        },
        {
          icon: 'settings',
          onPress: () => navigateWithinStack('NotificationSettings'),
        },
      ]}
    />
  );

  return (
    <NotificationActionHandler>
      {({handleNotificationAction}) => (
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
            renderItem={({item}) => (
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
            renderSectionHeader={({section}) => (
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
    paddingVertical: theme.spacing.md,
  },
  emptyContainer: {
    flex: 1,
  },
}));
