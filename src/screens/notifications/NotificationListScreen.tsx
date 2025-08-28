import React, {useState, useCallback, useMemo} from 'react';
import {
  View,
  SectionList,
  RefreshControl,
  Alert,
  Text,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {StyleSheet} from 'react-native-unistyles';
import Icon from '@react-native-vector-icons/material-icons';
import {
  NotificationItem,
  EmptyNotifications,
  NotificationHeader,
  NotificationGroupHeader,
} from '#components/notifications';
import {useNotifications} from '#hooks';
import {
  NotificationItem as NotificationType,
  NotificationCategory,
  NotificationPriority,
} from '#store/slices/notificationSlice';
import {NotificationListNavProp} from '#navigation';
import {useGetMyNotificationsQuery} from '#generated';
import {useStore} from '#store';
import {Header} from '#components/molecules/Header';

export const NotificationListScreen: React.FC = () => {
  const navigation = useNavigation<NotificationListNavProp>();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [filterCategory, setFilterCategory] =
    useState<NotificationCategory | null>(null);
  const userId = useStore(state => state.user?.id);

  const {
    notifications,
    groupedNotifications,
    handleMarkAsRead,
    handleMarkAllAsRead,
    handleRemoveNotification,
    clearAll,
    getNotificationsByCategory,
  } = useNotifications();

  const urgentNotifications = groupedNotifications.urgent || [];

  // Filter notifications based on selected category
  const filteredNotifications = useMemo(() => {
    if (!filterCategory) return notifications;
    return getNotificationsByCategory(filterCategory);
  }, [notifications, filterCategory, getNotificationsByCategory]);

  // Group filtered notifications
  const filteredGroups = useMemo(() => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const groups: {[key: string]: typeof filteredNotifications} = {
      urgent: [],
      today: [],
      yesterday: [],
      older: [],
    };

    filteredNotifications.forEach(notification => {
      // Urgent notifications go to urgent group
      if (
        notification.priority === NotificationPriority.URGENT &&
        !notification.isRead
      ) {
        groups.urgent.push(notification);
        return;
      }

      const notificationDate = new Date(notification.sentAt);

      if (notificationDate.toDateString() === today.toDateString()) {
        groups.today.push(notification);
      } else if (notificationDate.toDateString() === yesterday.toDateString()) {
        groups.yesterday.push(notification);
      } else {
        groups.older.push(notification);
      }
    });

    return groups;
  }, [filteredNotifications]);

  // Fetch notifications from server
  const {refetch} = useGetMyNotificationsQuery({
    skip: !userId,
  });

  const handleNotificationPress = useCallback(
    async (notification: NotificationType) => {
      // Mark as read
      if (!notification.isRead) {
        await handleMarkAsRead(notification.id);
      }

      // Navigate based on type and action
      if (notification.requiresAction && notification.actionType) {
        switch (notification.actionType) {
          case 'ACCEPT_INVITE':
            navigation.getParent()?.navigate('HomeStack', {
              screen: 'Main',
              params: notification.actionData,
            });
            break;
          case 'ADD_TO_SHOPPING_LIST':
            navigation.getParent()?.navigate('ShoppingListStack', {
              screen: 'ShoppingListMain',
              params: notification.actionData,
            });
            break;
          case 'VIEW_EXPIRING_ITEMS':
            navigation.getParent()?.navigate('PantryStack', {
              screen: 'ExpiringItems',
              params: notification.actionData,
            });
            break;
          case 'REVIEW_SECURITY':
            navigation.getParent()?.navigate('SettingsStack', {
              screen: 'ProfileSettings',
            });
            break;
          default:
            navigation.navigate('NotificationDetail', {
              notification,
            });
        }
      } else {
        // Default navigation based on category
        switch (notification.category) {
          case NotificationCategory.SHOPPING_LIST:
            navigation.getParent()?.navigate('ShoppingListStack', {
              screen: 'ListSettings',
              params: {listId: notification.payload.listId},
            });
            break;
          case NotificationCategory.PANTRY:
            navigation.getParent()?.navigate('PantryStack', {
              screen: 'PantryMain',
            });
            break;
          case NotificationCategory.SECURITY:
            navigation.getParent()?.navigate('SettingsStack', {
              screen: 'ProfileSettings',
            });
            break;
          default:
            navigation.navigate('NotificationDetail', {
              notification,
            });
        }
      }
    },
    [handleMarkAsRead, navigation],
  );

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await refetch();
    // Clear expired notifications
    useStore.getState().clearExpired();
    setIsRefreshing(false);
  }, [refetch]);

  // Prepare sections for SectionList
  const sections = [
    {title: '🚨 Urgent', data: filteredGroups.urgent},
    {title: 'Today', data: filteredGroups.today},
    {title: 'Yesterday', data: filteredGroups.yesterday},
    {title: 'Older', data: filteredGroups.older},
  ].filter(section => section.data.length > 0);

  const hasNotifications = sections.length > 0;

  // Category filter pills
  const renderCategoryFilters = () => (
    <View style={styles.filterContainer}>
      <Header
        title={'Notifications'}
        centerTitle={true}
        onBack={navigation.goBack}
        rightActions={[
          {
            icon: 'settings',
            onPress: () => navigation.navigate('NotificationSettings'),
          },
        ]}
      />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterScroll}>
        <TouchableOpacity
          style={[
            styles.filterPill,
            !filterCategory && styles.filterPillActive,
          ]}
          onPress={() => setFilterCategory(null)}>
          <Text
            style={[
              styles.filterText,
              !filterCategory && styles.filterTextActive,
            ]}>
            All
          </Text>
        </TouchableOpacity>

        {Object.values(NotificationCategory).map(category => (
          <TouchableOpacity
            key={category}
            style={[
              styles.filterPill,
              filterCategory === category && styles.filterPillActive,
            ]}
            onPress={() => setFilterCategory(category)}>
            <Text
              style={[
                styles.filterText,
                filterCategory === category && styles.filterTextActive,
              ]}>
              {category.replace('_', ' ')}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );

  return (
    <View style={styles.container}>
      {urgentNotifications.length > 0 && (
        <View style={styles.urgentBanner}>
          <Icon name="warning" size={20} color="#FFF" />
          <Text style={styles.urgentText}>
            {urgentNotifications.length} urgent notification
            {urgentNotifications.length !== 1 ? 's' : ''}
          </Text>
        </View>
      )}

      <NotificationHeader
        onMarkAllRead={handleMarkAllAsRead}
        onClearAll={clearAll}
        hasNotifications={hasNotifications}
      />

      {renderCategoryFilters()}

      <SectionList
        sections={sections}
        keyExtractor={item => item.id}
        renderItem={({item}) => (
          <NotificationItem
            notification={item}
            onPress={handleNotificationPress}
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
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
        }
      />
    </View>
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
  urgentBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.error || '#FF3B30',
    padding: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
  },
  urgentText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
    marginLeft: theme.spacing.sm,
  },
  filterContainer: {
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border || '#E0E0E0',
  },
  filterScroll: {
    padding: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
  },
  filterPill: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
    borderRadius: 20,
    backgroundColor: theme.colors.background,
    marginRight: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.border || '#E0E0E0',
  },
  filterPillActive: {
    backgroundColor: theme.colors.primary || '#62B1F6',
    borderColor: theme.colors.primary || '#62B1F6',
  },
  filterText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    textTransform: 'capitalize',
  },
  filterTextActive: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
}));
