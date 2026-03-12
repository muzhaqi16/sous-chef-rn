import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import {
  useNotificationChangedSubscription,
  NotificationType } from '#generated';
import { useAppStore } from '#store/useAppStore';
import { useShallow } from 'zustand/react/shallow';
import { showLocalNotification } from '#utils/notifications/localNotificationHelper';
import {
  getNotificationTitle,
  getNotificationMessage,
  getNotificationCategory,
  getNotificationPriority } from '#utils/notifications/notificationParser';
import {
  NotificationCategory } from '#store/slices/notificationSlice';
import {
  handleSubscriptionError,
  clearAllRetryStates } from '#utils/subscriptionErrorHandler';
import { useNotificationSettings } from './useNotificationSettings';
import { useNotificationSync } from './useNotificationSync';

// PERFORMANCE: Grouped selectors to reduce subscriptions from 7 to 2
const selectNotificationState = (state: any) => ({
  notifications: state.notifications,
  user: state.user });

const selectNotificationActions = (state: any) => ({
  addNotification: state.addNotification,
  clearAll: state.clearAll,
  getNotificationsByCategory: state.getNotificationsByCategory });

interface NotificationConfig {
  skip?: boolean;
  showInAppNotifications?: boolean;
  showPushNotifications?: boolean;
}

export const useNotifications = (config: NotificationConfig = {}) => {
  // PERFORMANCE: Use ref instead of state for AppState to avoid re-renders
  // AppState is only needed in side effect (push notification check), not for rendering
  const appStateRef = useRef(AppState.currentState);

  // PERFORMANCE: Use grouped selectors with useShallow to reduce subscriptions (7 → 2)
  const { notifications, user } = useAppStore(useShallow(selectNotificationState));
  const {
    addNotification,
    clearAll,
    getNotificationsByCategory } = useAppStore(useShallow(selectNotificationActions));

  // Fetch user notification preferences (deferred when hook is skipped)
  const { settings: userPreferences, isQuietTime } = useNotificationSettings({ skip: config.skip });

  // Server-synced notification actions
  const { syncMarkAsRead, syncDelete, syncMarkAllAsRead } = useNotificationSync();

  // Default configuration
  const finalConfig = ({
      showInAppNotifications: true,
      showPushNotifications: true,
      ...config });

  // Check if notification type is enabled in user preferences
  const isNotificationTypeEnabled = (type: NotificationType): boolean => {
      if (!userPreferences) return true; // Show by default if preferences not loaded

      switch (type) {
        case NotificationType.ItemUpdated:
          return userPreferences.pantryChanges;
        case NotificationType.LowStock:
          return userPreferences.lowStockAlerts;
        case NotificationType.ExpiryReminder:
          return userPreferences.expirationNotifications;
        case NotificationType.ListUpdated:
          return (
            userPreferences.shoppingListUpdates ||
            userPreferences.sharedListUpdates
          );
        case NotificationType.CollaborationInvite:
        case NotificationType.CollaborationAccepted:
        case NotificationType.CollaborationDeclined:
        case NotificationType.CollaboratorRemoved:
        case NotificationType.CollaboratorRoleChanged:
        case NotificationType.CollaboratorPermissionsUpdated:
          return userPreferences.collaborationInvites;
        case NotificationType.MembershipInvite:
        case NotificationType.HomeInvitation:
        case NotificationType.HomeJoined:
          return userPreferences.homeInvites;
        case NotificationType.RecipeCooked:
          return userPreferences.cookingReminders;
        case NotificationType.RecipeSaved:
          return userPreferences.recipeRecommendations;
        default:
          return true; // Show unknown notification types by default
      }
    };

  const processNotification = (
      notification: any,
      category: NotificationCategory,
      sourceUserId?: string,
    ) => {
      if (!finalConfig.showInAppNotifications) return;

      // Filter out notifications triggered by the current user
      if (sourceUserId && user?.id && sourceUserId === user.id) {
        console.log('🚫 Filtering notification - triggered by current user:', {
          type: notification.type,
          sourceUserId,
          currentUserId: user.id });
        return;
      }

      // Check if notification type is enabled in user preferences
      if (!isNotificationTypeEnabled(notification.type)) {
        console.log(
          '🚫 Filtering notification - disabled in user preferences:',
          {
            type: notification.type },
        );
        return;
      }

      // Check if it's quiet time (only affects push notifications)
      if (isQuietTime()) {
        console.log('🔕 Quiet time active - suppressing push notification:', {
          type: notification.type });
        // Continue to show in-app notification but skip push
      }

      // Determine if notification requires action based on type
      const requiresAction =
        notification.type === NotificationType.MembershipInvite ||
        notification.type === NotificationType.HomeInvitation ||
        notification.type === NotificationType.CollaborationInvite;

      // Set action type based on notification type
      const actionType =
        notification.type === NotificationType.MembershipInvite ||
        notification.type === NotificationType.HomeInvitation
          ? 'ACCEPT_HOME_INVITE'
          : notification.type === NotificationType.CollaborationInvite
          ? 'ACCEPT_SHOPPING_LIST_INVITE'
          : undefined;

      const processedNotification = {
        id: notification.id || Date.now().toString(),
        type: notification.type || NotificationType.HomeJoined,
        title: notification.title || 'Notification',
        message: notification.message || '',
        category,
        priority: getNotificationPriority(notification.type),
        payload: notification.payload || {},
        sentAt: notification.sentAt || new Date().toISOString(),
        isRead: false,
        requiresAction,
        actionType,
        actionData: notification.payload };

      addNotification(processedNotification);

      // Show push notification if enabled, app is not active, and not quiet time
      if (
        finalConfig.showPushNotifications &&
        appStateRef.current !== 'active' &&
        !isQuietTime()
      ) {
        showLocalNotification({
          id: processedNotification.id,
          title: processedNotification.title,
          body: processedNotification.message });
      }
    };

  // Error handler - suppresses expected network errors
  const handleError = (subscriptionName: string, error: any) => {
    const errorMessage = error?.message?.toLowerCase() || '';
    const isSocketClosed = errorMessage.includes('socket closed');
    const isNetworkError = errorMessage.includes('network') ||
      errorMessage.includes('connection') ||
      errorMessage.includes('websocket');

    // Socket closed errors are expected during network transitions - will auto-reconnect
    if (isSocketClosed || isNetworkError) {
      return;
    }

    console.warn(`${subscriptionName} subscription error:`, error.message);
    handleSubscriptionError(subscriptionName, error);
  };

  // General notifications
  useNotificationChangedSubscription({
    skip: config.skip || !user?.id,
    onData: ({ data }) => {
      console.log(
        '🔔 [NotificationChanged] Raw subscription data received:',
        data,
      );
      if (data.data?.notificationChanged?.notification) {
        const rawNotification = data.data.notificationChanged.notification;

        console.log('🔔 [NotificationChanged] Processing notification:', {
          type: rawNotification.type,
          id: rawNotification.id,
          payload: rawNotification.payload,
          changeType: data.data.notificationChanged.changeType });

        // Create properly structured notification using helper functions
        processNotification(
          {
            type: rawNotification.type,
            title: getNotificationTitle(
              rawNotification.type,
              rawNotification.payload,
            ),
            message: getNotificationMessage(
              rawNotification.type,
              rawNotification.payload,
            ),
            payload: rawNotification.payload,
            sentAt: rawNotification.sentAt },
          getNotificationCategory(rawNotification.type),
        );
      } else {
        console.warn(
          '⚠️ [NotificationChanged] Data received but no notification payload',
        );
      }
    },
    onError: (error: Error) => {
      // Let handleError decide whether to log based on error type
      handleError('NotificationChanged', error);
    } });

  // PERFORMANCE: App state handling - store in ref to avoid re-renders
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      appStateRef.current = nextAppState;
    });
    return () => subscription.remove();
  }, []);

  // Cleanup on logout
  useEffect(() => {
    if (!user?.id) {
      clearAllRetryStates();
    }
  }, [user?.id]);

  // Log subscription status for debugging
  useEffect(() => {
    if (!config.skip && user?.id) {
      console.log(
        '✅ [NotificationChanged] Subscription ACTIVE for user:',
        user.id,
      );
    } else if (!user?.id) {
      console.log(
        '⏸️ [NotificationChanged] Subscription SKIPPED - no authenticated user',
      );
    } else {
      console.log(
        '⏸️ [NotificationChanged] Subscription DEFERRED - startup delay',
      );
    }
  }, [user?.id, config.skip]);

  // PERFORMANCE: Optimize callback references - remove unnecessary wrappers
  return {
    config: finalConfig,
    notifications,
    handleMarkAsRead: syncMarkAsRead,
    handleMarkAllAsRead: syncMarkAllAsRead,
    handleRemoveNotification: syncDelete,
    clearAll, // Local-only bulk clear (no server equivalent)
    getNotificationsByCategory, // Direct reference instead of wrapper
    updateConfig: (newConfig: Partial<NotificationConfig>) => {
      // This would typically update stored preferences
      console.log('Updating notification config:', newConfig);
    } };
};
