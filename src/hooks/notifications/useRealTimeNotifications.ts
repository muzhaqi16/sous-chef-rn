import {useEffect, useState, useMemo} from 'react';
import {AppState} from 'react-native';
import {
  useNotificationReceivedSubscription,
  useUrgentNotificationReceivedSubscription,
  usePantryItemsChangedSubscription,
  usePantryLowStockAlertSubscription,
  usePantryExpiringItemsAlertSubscription,
  useShoppingListItemsChangedSubscription,
  useShoppingListCollaboratorsChangedSubscription,
  useMyMembershipUpdatedSubscription,
  useMemberJoinedSubscription,
  useGetHomeInvitesQuery,
  useGetMyPendingInvitesQuery,
  NotificationType,
  NotificationStatus,
  MutationType,
  MembershipMutationType,
} from '#generated';
import {useStore} from '#store';
import {showLocalNotification} from '#utils/notifications/localNotificationHelper';
import {parseNotificationPayload} from '#utils/notifications/notificationParser';
import {
  NotificationCategory,
  NotificationPriority,
} from '#store/slices/notificationSlice';
import {
  handleSubscriptionError,
  clearAllRetryStates,
} from '#utils/subscriptionErrorHandler';

interface RealTimeNotificationConfig {
  enablePantryNotifications?: boolean;
  enableShoppingListNotifications?: boolean;
  enableMembershipNotifications?: boolean;
  enableLowStockAlerts?: boolean;
  enableExpirationAlerts?: boolean;
  enableCollaborationNotifications?: boolean;
  showInAppNotifications?: boolean;
  showPushNotifications?: boolean;
}

export const useRealTimeNotifications = (
  config?: RealTimeNotificationConfig,
) => {
  const [appState, setAppState] = useState(AppState.currentState);
  const addNotification = useStore(state => state.addNotification);
  const user = useStore(state => state.user);
  const selectedHomeId = useStore(state => state.selectedHomeId);
  const selectedPantryId = useStore(state => state.selectedPantryId);
  const selectedShoppingListId = useStore(
    state => state.selectedShoppingListId,
  );
  const pushNotifications = useStore(state => state.pushNotifications);

  // Default configuration
  const finalConfig = useMemo<RealTimeNotificationConfig>(() => {
    const config_result = {
      enablePantryNotifications: true,
      enableShoppingListNotifications: true,
      enableMembershipNotifications: true,
      enableLowStockAlerts: true,
      enableExpirationAlerts: true,
      enableCollaborationNotifications: true,
      showInAppNotifications: true,
      showPushNotifications: pushNotifications,
      ...config,
    };
    return config_result;
  }, [config, pushNotifications]);

  // Helper functions
  const getCategoryFromType = (
    type: NotificationType,
  ): NotificationCategory => {
    switch (type) {
      case NotificationType.ExpiryReminder:
      case NotificationType.LowStock:
        return NotificationCategory.PANTRY;
      case NotificationType.NewItemAdded:
      case NotificationType.ItemUpdated:
      case NotificationType.ItemDeleted:
      case NotificationType.ListUpdated:
        return NotificationCategory.SHOPPING_LIST;
      case NotificationType.MembershipInvite:
      case NotificationType.HomeJoined:
        return NotificationCategory.MEMBERSHIP;
      case NotificationType.CollaborationInvite:
        return NotificationCategory.COLLABORATION;
      default:
        return NotificationCategory.SYSTEM;
    }
  };

  const getPriorityFromType = (
    type: NotificationType,
  ): NotificationPriority => {
    switch (type) {
      case NotificationType.ExpiryReminder:
        return NotificationPriority.URGENT;
      case NotificationType.LowStock:
      case NotificationType.MembershipInvite:
      case NotificationType.CollaborationInvite:
        return NotificationPriority.HIGH;
      case NotificationType.NewItemAdded:
      case NotificationType.ItemUpdated:
      case NotificationType.ItemDeleted:
        return NotificationPriority.LOW;
      default:
        return NotificationPriority.MEDIUM;
    }
  };

  const getUserDisplayName = (userId: string): string => {
    // You might want to implement user lookup here
    // For now, return 'Someone'
    return 'Someone';
  };

  const shouldShowNotification = (category: NotificationCategory): boolean => {
    switch (category) {
      case NotificationCategory.PANTRY:
        return finalConfig.enablePantryNotifications ?? true;
      case NotificationCategory.SHOPPING_LIST:
        return finalConfig.enableShoppingListNotifications ?? true;
      case NotificationCategory.MEMBERSHIP:
        return finalConfig.enableMembershipNotifications ?? true;
      case NotificationCategory.COLLABORATION:
        return finalConfig.enableCollaborationNotifications ?? true;
      default:
        return true;
    }
  };

  // Handle app state changes
  useEffect(() => {
    const subscription = AppState.addEventListener('change', setAppState);
    return () => subscription.remove();
  }, []);

  // ============================================
  // GENERAL NOTIFICATIONS SUBSCRIPTIONS
  // ============================================

  const {data: notificationData} = useNotificationReceivedSubscription({
    skip: !user?.id,
    onError: error => {
      handleSubscriptionError('NotificationReceived', error);
    },
  });

  const {data: urgentNotificationData} =
    useUrgentNotificationReceivedSubscription({
      skip: !user?.id,
      onError: error => {
        handleSubscriptionError('UrgentNotificationReceived', error);
      },
    });

  // ============================================
  // PANTRY SUBSCRIPTIONS
  // ============================================

  // NOTE: Pantry item change notifications are now handled by the dedicated
  // usePantryManagement hook in the PantryMain screen to avoid duplicate subscriptions.
  // Only subscribe to pantry notifications when NOT actively viewing a pantry screen.
  // This can be improved later with context to know which screen is active.
  const {data: pantryItemsChanged} = usePantryItemsChangedSubscription({
    variables: {pantryId: selectedPantryId || ''},
    skip: true, // Temporarily disabled to avoid duplicate subscriptions
    onError: error => {
      handleSubscriptionError('PantryItemsChanged', error);
    },
  });

  const {data: lowStockAlert} = usePantryLowStockAlertSubscription({
    variables: {pantryId: selectedPantryId || ''},
    skip: !user?.id || !selectedPantryId || !finalConfig.enableLowStockAlerts,
    onError: error => {
      handleSubscriptionError('PantryLowStockAlert', error);
    },
  });

  const {data: expirationAlert} = usePantryExpiringItemsAlertSubscription({
    variables: {pantryId: selectedPantryId || ''},
    skip: !user?.id || !selectedPantryId || !finalConfig.enableExpirationAlerts,
    onError: error => {
      handleSubscriptionError('PantryExpiringItemsAlert', error);
    },
  });

  // ============================================
  // SHOPPING LIST SUBSCRIPTIONS
  // ============================================

  const {data: shoppingListItemsChanged} =
    useShoppingListItemsChangedSubscription({
      variables: {listId: selectedShoppingListId || ''},
      skip:
        !user?.id ||
        !selectedShoppingListId ||
        !finalConfig.enableShoppingListNotifications,
      onError: error => {
        handleSubscriptionError('ShoppingListItemsChanged', error);
      },
    });

  const {data: collaboratorsChanged} =
    useShoppingListCollaboratorsChangedSubscription({
      variables: {listId: selectedShoppingListId || ''},
      skip:
        !user?.id ||
        !selectedShoppingListId ||
        !finalConfig.enableCollaborationNotifications,
      onError: error => {
        handleSubscriptionError('ShoppingListCollaboratorsChanged', error);
      },
    });

  // ============================================
  // MEMBERSHIP SUBSCRIPTIONS
  // ============================================

  const {data: membershipUpdated} = useMyMembershipUpdatedSubscription({
    skip:
      !user?.id ||
      !user?.emailVerified ||
      !finalConfig.enableMembershipNotifications,
    onError: error => {
      handleSubscriptionError('MyMembershipUpdated', error);
    },
  });

  const {data: memberJoined} = useMemberJoinedSubscription({
    variables: {homeId: selectedHomeId || ''},
    skip:
      !user?.id ||
      !user?.emailVerified ||
      !selectedHomeId ||
      !finalConfig.enableMembershipNotifications,
    onError: error => {
      handleSubscriptionError('MemberJoined', error);
    },
  });

  // Poll for my pending home invites
  const {data: invitesData} = useGetMyPendingInvitesQuery({
    skip: !user?.id,
    pollInterval: 30000, // Poll every 30 seconds
  });

  // ============================================
  // NOTIFICATION HANDLERS
  // ============================================

  // Handle general notifications
  useEffect(() => {
    if (notificationData?.notificationReceived) {
      const {notification, timestamp} = notificationData.notificationReceived;

      if (notification && notification.status !== NotificationStatus.Read) {
        const parsed = parseNotificationPayload(notification.payload);
        const notificationType = notification.type as NotificationType;
        const category = getCategoryFromType(notificationType);

        if (!shouldShowNotification(category)) return;

        const newNotification = {
          id: notification.id,
          type: notificationType,
          category,
          priority: getPriorityFromType(notificationType),
          title: parsed.title,
          message: parsed.message,
          payload: notification.payload,
          status: notification.status,
          sentAt: notification.sentAt,
          readAt: notification.readAt,
          createdAt: notification.createdAt,
          timestamp,
        };

        if (finalConfig.showInAppNotifications) {
          addNotification(newNotification);
        }

        if (finalConfig.showPushNotifications) {
          showLocalNotification({
            id: notification.id,
            title: parsed.title,
            body: parsed.message,
          });
        }
      }
    }
  }, [notificationData, addNotification, finalConfig]);

  // Handle urgent notifications
  useEffect(() => {
    if (urgentNotificationData?.urgentNotificationReceived) {
      const {notification} = urgentNotificationData.urgentNotificationReceived;

      if (notification && finalConfig.showPushNotifications) {
        const parsed = parseNotificationPayload(notification.payload);

        showLocalNotification({
          id: notification.id,
          title: `🚨 ${parsed.title}`,
          body: parsed.message,
          priority: 'high',
        });
      }
    }
  }, [urgentNotificationData, finalConfig.showPushNotifications]);

  // Handle pantry item changes
  useEffect(() => {
    if (pantryItemsChanged?.pantryItemsChanged) {
      const change = pantryItemsChanged.pantryItemsChanged;

      // Only notify if change was made by someone else
      if (change.userId !== user?.id) {
        let title = '';
        let message = '';

        switch (change.mutation) {
          case MutationType.Created:
          case MutationType.ItemAdded:
            title = 'Pantry Item Added';
            message = `${change.item?.itemName} was added to your pantry`;
            break;
          case MutationType.Updated:
          case MutationType.ItemUpdated:
            title = 'Pantry Item Updated';
            message = `${change.item?.itemName} was updated in your pantry`;
            break;
          case MutationType.Deleted:
          case MutationType.ItemRemoved:
            title = 'Pantry Item Removed';
            message = `${change.item?.itemName} was removed from your pantry`;
            break;
        }

        if (title && message) {
          const notification = {
            id: `pantry-change-${Date.now()}`,
            type: NotificationType.ItemUpdated,
            category: NotificationCategory.PANTRY,
            priority: NotificationPriority.LOW,
            title,
            message,
            payload: {
              pantryId: change.pantryId,
              itemId: change.item?.id,
              itemName: change.item?.itemName,
              mutation: change.mutation,
              userId: change.userId,
            },
            sentAt: new Date().toISOString(),
          };

          if (finalConfig.showInAppNotifications) {
            addNotification(notification);
          }

          // Only show push notification if app is in background
          if (
            finalConfig.showPushNotifications &&
            (appState === 'background' || appState === 'inactive')
          ) {
            showLocalNotification({
              id: notification.id,
              title: notification.title,
              body: notification.message,
            });
          }
        }
      }
    }
  }, [pantryItemsChanged, addNotification, user?.id, finalConfig, appState]);

  // Handle low stock alerts
  useEffect(() => {
    if (lowStockAlert?.pantryLowStockAlert) {
      const alerts = lowStockAlert.pantryLowStockAlert;

      alerts.forEach(alert => {
        const notification = {
          id: `low-stock-${alert.id}`,
          type: NotificationType.LowStock,
          category: NotificationCategory.PANTRY,
          priority: NotificationPriority.HIGH,
          title: 'Low Stock Alert',
          message: `${alert.itemName} is running low (${alert.currentQuantity} left)`,
          payload: {
            itemId: alert.id,
            itemName: alert.itemName,
            currentQuantity: alert.currentQuantity,
            autoReorderPoint: alert.autoReorderPoint,
          },
          sentAt: new Date().toISOString(),
          requiresAction: true,
          actionType: 'ADD_TO_SHOPPING_LIST',
          actionData: {
            itemId: alert.id,
            itemName: alert.itemName,
          },
        };

        if (finalConfig.showInAppNotifications) {
          addNotification(notification);
        }

        if (finalConfig.showPushNotifications) {
          showLocalNotification({
            id: notification.id,
            title: notification.title,
            body: notification.message,
            priority: 'high',
          });
        }
      });
    }
  }, [lowStockAlert, addNotification, finalConfig]);

  // Handle expiration alerts
  useEffect(() => {
    if (expirationAlert?.pantryExpiringItemsAlert) {
      const alerts = expirationAlert.pantryExpiringItemsAlert;

      alerts.forEach(alert => {
        // Calculate days until expiration from expiresAt
        const expiresDate = new Date(alert.expiresAt || alert.bestByDate || '');
        const today = new Date();
        const daysUntilExpiration = Math.ceil(
          (expiresDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
        );

        const notification = {
          id: `expiration-${alert.id}`,
          type: NotificationType.ExpiryReminder,
          category: NotificationCategory.PANTRY,
          priority: NotificationPriority.URGENT,
          title: 'Expiration Alert',
          message: `${alert.itemName} expires in ${daysUntilExpiration} day${
            daysUntilExpiration !== 1 ? 's' : ''
          }`,
          payload: {
            itemId: alert.id,
            itemName: alert.itemName,
            expiresAt: alert.expiresAt,
            daysUntilExpiration,
          },
          sentAt: new Date().toISOString(),
          requiresAction: true,
          actionType: 'VIEW_EXPIRING_ITEMS',
          actionData: {
            itemId: alert.id,
          },
        };

        if (finalConfig.showInAppNotifications) {
          addNotification(notification);
        }

        if (finalConfig.showPushNotifications) {
          showLocalNotification({
            id: notification.id,
            title: `🚨 ${notification.title}`,
            body: notification.message,
            priority: 'high',
          });
        }
      });
    }
  }, [expirationAlert, addNotification, finalConfig]);

  // Handle shopping list item changes
  useEffect(() => {
    if (shoppingListItemsChanged?.shoppingListItemsChanged) {
      const change = shoppingListItemsChanged.shoppingListItemsChanged;

      // Only notify if change was made by someone else
      if (change.userId !== user?.id) {
        let title = '';
        let message = '';

        switch (change.mutation) {
          case MutationType.Created:
          case MutationType.ItemAdded:
            title = 'Item Added';
            message = `${change.item?.itemName || change.item?.item?.name} was added to your shopping list`;
            break;
          case MutationType.Updated:
          case MutationType.ItemUpdated:
            if (change.item?.isPurchased) {
              title = 'Item Purchased';
              message = `${change.item?.itemName || change.item?.item?.name} was marked as purchased`;
            } else {
              title = 'Item Updated';
              message = `${change.item?.itemName || change.item?.item?.name} was updated in your shopping list`;
            }
            break;
          case MutationType.ItemCompleted:
            title = 'Item Purchased';
            message = `${change.item?.itemName || change.item?.item?.name} was marked as purchased`;
            break;
          case MutationType.Deleted:
          case MutationType.ItemRemoved:
            title = 'Item Removed';
            message = `${change.item?.itemName || change.item?.item?.name} was removed from your shopping list`;
            break;
        }

        if (title && message) {
          const notification = {
            id: `shopping-list-change-${Date.now()}`,
            type: NotificationType.ListUpdated,
            category: NotificationCategory.SHOPPING_LIST,
            priority: NotificationPriority.LOW,
            title,
            message,
            payload: {
              listId: change.listId,
              itemId: change.item?.id,
              itemName: change.item?.itemName,
              mutation: change.mutation,
              userId: change.userId,
            },
            sentAt: new Date().toISOString(),
          };

          if (finalConfig.showInAppNotifications) {
            addNotification(notification);
          }

          // Only show notification if app is in background
          if (
            finalConfig.showPushNotifications &&
            (appState === 'background' || appState === 'inactive')
          ) {
            showLocalNotification({
              id: notification.id,
              title: notification.title,
              body: notification.message,
            });
          }
        }
      }
    }
  }, [
    shoppingListItemsChanged,
    addNotification,
    user?.id,
    finalConfig,
    appState,
  ]);

  // Handle collaborator changes
  useEffect(() => {
    if (collaboratorsChanged?.shoppingListCollaboratorsChanged) {
      const change = collaboratorsChanged.shoppingListCollaboratorsChanged;

      if (change.userId !== user?.id) {
        let title = '';
        let message = '';

        switch (change.mutation) {
          case MutationType.Created:
          case MutationType.CollaboratorAdded:
            title = 'Collaborator Added';
            message = `${change.collaborator?.email} was added to your shopping list`;
            break;
          case MutationType.Deleted:
          case MutationType.CollaboratorRemoved:
            title = 'Collaborator Removed';
            message = `${change.collaborator?.email} was removed from your shopping list`;
            break;
        }

        if (title && message) {
          const notification = {
            id: `collaborator-change-${Date.now()}`,
            type: NotificationType.CollaborationInvite,
            category: NotificationCategory.COLLABORATION,
            priority: NotificationPriority.MEDIUM,
            title,
            message,
            payload: {
              listId: change.listId,
              collaboratorId: change.collaborator?.id,
              collaboratorEmail: change.collaborator?.email,
              mutation: change.mutation,
              userId: change.userId,
            },
            sentAt: new Date().toISOString(),
          };

          if (finalConfig.showInAppNotifications) {
            addNotification(notification);
          }

          if (finalConfig.showPushNotifications) {
            showLocalNotification({
              id: notification.id,
              title: notification.title,
              body: notification.message,
            });
          }
        }
      }
    }
  }, [collaboratorsChanged, addNotification, user?.id, finalConfig]);

  // Handle membership updates
  useEffect(() => {
    if (membershipUpdated?.myMembershipUpdated) {
      const update = membershipUpdated.myMembershipUpdated;

      if (update.mutation === MembershipMutationType.Created) {
        const notification = {
          id: `membership-${Date.now()}`,
          type: NotificationType.MembershipInvite,
          category: NotificationCategory.MEMBERSHIP,
          priority: NotificationPriority.HIGH,
          title: 'Home Invitation',
          message: `You've been invited to join ${update.node?.home.name}`,
          payload: {
            homeId: update.node?.homeId,
            homeName: update.node?.home.name,
            role: update.node?.role,
            membershipId: update.node?.id,
          },
          sentAt: new Date().toISOString(),
          requiresAction: true,
          actionType: 'ACCEPT_INVITE',
          actionData: {
            membershipId: update.node?.id,
            homeId: update.node?.homeId,
          },
        };

        if (finalConfig.showInAppNotifications) {
          addNotification(notification);
        }

        if (finalConfig.showPushNotifications) {
          showLocalNotification({
            id: notification.id,
            title: notification.title,
            body: notification.message,
          });
        }
      }
    }
  }, [membershipUpdated, addNotification, finalConfig]);

  // Handle new members joining
  useEffect(() => {
    if (memberJoined?.memberJoined) {
      const newMember = memberJoined.memberJoined;

      const notification = {
        id: `member-joined-${Date.now()}`,
        type: NotificationType.HomeJoined,
        category: NotificationCategory.MEMBERSHIP,
        priority: NotificationPriority.LOW,
        title: 'New Member Joined',
        message: `${
          newMember.node?.user?.profile?.displayName || 'Someone'
        } joined your home`,
        payload: {
          homeId: newMember.node?.homeId,
          userId: newMember.node?.userId,
          membershipId: newMember.userId,
        },
        sentAt: new Date().toISOString(),
      };

      if (finalConfig.showInAppNotifications) {
        addNotification(notification);
      }

      if (finalConfig.showPushNotifications) {
        showLocalNotification({
          id: notification.id,
          title: notification.title,
          body: notification.message,
        });
      }
    }
  }, [memberJoined, addNotification, finalConfig]);

  // Handle home invites (polling)
  useEffect(() => {
    if (invitesData?.myPendingInvites) {
      const pendingInvites = invitesData.myPendingInvites.filter(
        invite => invite.status === 'PENDING',
      );

      pendingInvites.forEach(invite => {
        const notificationId = `invite-${invite.id}`;
        const existingNotification = useStore
          .getState()
          .notifications.find(n => n.id === notificationId);

        if (!existingNotification) {
          const notification = {
            id: notificationId,
            type: NotificationType.MembershipInvite,
            category: NotificationCategory.MEMBERSHIP,
            priority: NotificationPriority.HIGH,
            title: 'Home Invitation',
            message: `You've been invited to join ${invite.home.name}`,
            payload: {
              inviteId: invite.id,
              homeId: invite.homeId,
              homeName: invite.home.name,
              role: invite.role,
              token: invite.token,
              inviterName: invite.inviter.profile?.displayName,
            },
            sentAt: invite.sentAt,
            requiresAction: true,
            actionType: 'ACCEPT_HOME_INVITE',
            actionData: {
              inviteId: invite.id,
              token: invite.token,
            },
            expiresAt: invite.expiresAt,
          };

          if (finalConfig.showInAppNotifications) {
            addNotification(notification);
          }

          if (finalConfig.showPushNotifications) {
            showLocalNotification({
              id: notification.id,
              title: notification.title,
              body: notification.message,
            });
          }
        }
      });
    }
  }, [invitesData, addNotification, finalConfig]);

  // Cleanup retry states when user changes or component unmounts
  useEffect(() => {
    return () => {
      clearAllRetryStates();
    };
  }, [user?.id]);

  return {
    notificationCount: useStore(
      state => state.notifications.filter(n => !n.readAt).length,
    ),
    notifications: useStore(state => state.notifications),
    config: finalConfig,
  };
};
