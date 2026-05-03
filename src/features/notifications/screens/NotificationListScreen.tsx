import React, { useRef, useState } from 'react';
import { View, SectionList } from 'react-native';
import { useAppNavigation } from '#hooks/navigation/useAppNavigation';
import { StyleSheet } from 'react-native-unistyles';
import { NotificationItem } from '#features/notifications/components/NotificationItem';
import { EmptyNotifications } from '#features/notifications/components/EmptyNotifications';
import { NotificationHeader } from '#features/notifications/components/NotificationHeader';
import { NotificationGroupHeader } from '#features/notifications/components/NotificationGroupHeader';
import { NotificationFilters } from '#features/notifications/components/NotificationFilters';
import { UrgentNotificationsBanner } from '#features/notifications/components/UrgentNotificationsBanner';
import { useNotifications } from '#features/notifications/hooks/useNotifications';
import { NotificationItem as NotificationType } from '#store/slices/notificationSlice';
import { NotificationCategory } from '#/graphql/generated/schemaTypes';
import { Header } from '#components/molecules/Header';
import { NotificationActionHandler } from '#features/notifications/components/NotificationActionHandler';
import {
  groupNotificationsByDate,
  createSectionListData,
} from '#utils/notificationGrouping';
import { useScreenTransition } from '#hooks/performance/useScreenTransition';

export const NotificationListScreen: React.FC = () => {
  useScreenTransition('NotificationListScreen');
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

  // Filter notifications based on selected category
  const filteredNotifications = (() => {
    if (!filterCategory) return notifications;
    return getNotificationsByCategory(filterCategory);
  })();

  // Group filtered notifications using utility
  const filteredGroups = (() => {
    return groupNotificationsByDate(filteredNotifications);
  })();

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
            navigate('Pantry');
          }
          break;
        default:
          navigate('NotificationDetail', {
            notification,
          });
      }
    } else {
      // Default navigation based on category
      switch (notification.category) {
        case NotificationCategory.Shopping:
          navigateTo.shoppingListMain();
          break;
        case NotificationCategory.Pantry:
          navigateTo.pantryMain();
          break;
        default:
          navigate('NotificationDetail', {
            notification,
          });
      }
    }
  };

  // Prepare sections for SectionList using utility
  const sections = createSectionListData(filteredGroups);

  const hasNotifications = sections.length > 0;

  const keyExtractor = (item: NotificationType) => item.id;

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

  const notificationActionRef = useRef<
    ((notification: NotificationType) => void) | null
  >(null);

  const renderNotificationItem = ({ item }: { item: NotificationType }) => (
    <NotificationItem
      notification={item}
      onPress={notification =>
        handleNotificationPress(
          notification,
          notificationActionRef.current ?? undefined,
        )
      }
      onDismiss={handleRemoveNotification}
    />
  );

  const renderSectionHeader = ({ section }: { section: { title: string } }) => (
    <NotificationGroupHeader title={section.title} />
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
              keyExtractor={keyExtractor}
              renderItem={renderNotificationItem}
              renderSectionHeader={renderSectionHeader}
              ListEmptyComponent={<EmptyNotifications />}
              contentContainerStyle={
                !hasNotifications ? styles.emptyContainer : undefined
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
  emptyContainer: {
    flex: 1,
  },
}));
