import {useEffect, useState} from 'react';
import {AppState} from 'react-native';
import {
  useNotificationReceivedSubscription,
  useShoppingListItemsChangedSubscription,
  useUrgentNotificationReceivedSubscription,
  useMyMembershipUpdatedSubscription,
  useShoppingListCollaboratorsChangedSubscription,
  useMemberJoinedSubscription,
  useGetHomeInvitesQuery,
  useMyShoppingListsUpdatedSubscription,
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

export const useNotificationSubscriptions = (
  userId: string | undefined,
  currentShoppingListId?: string | null,
  currentUserId?: string,
) => {
  const [appState, setAppState] = useState(AppState.currentState);
  const addNotification = useStore(state => state.addNotification);
  const selectedHomeId = useStore(state => state.selectedHomeId);

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

  // Subscribe to ALL notifications
  const {data: notificationData} = useNotificationReceivedSubscription({
    skip: !userId,
  });

  // Subscribe to urgent notifications
  const {data: urgentNotificationData} =
    useUrgentNotificationReceivedSubscription({
      skip: !userId,
    });

  // Subscribe to membership updates
  const {data: membershipData} = useMyMembershipUpdatedSubscription({
    skip: !userId,
  });

  // Subscribe to member joined events
  const {data: memberJoinedData} = useMemberJoinedSubscription({
    variables: {homeId: selectedHomeId || ''},
    skip: !userId || !selectedHomeId,
  });

  // Subscribe to shopping list updates (general)
  const {data: shoppingListData} = useMyShoppingListsUpdatedSubscription({
    skip: !userId,
  });

  // Subscribe to collaboration changes for current list
  const {data: collaborationData} =
    useShoppingListCollaboratorsChangedSubscription({
      variables: {listId: currentShoppingListId || ''},
      skip: !userId || !currentShoppingListId,
    });

  // Subscribe to shopping list items changes for current list
  const {data: itemsChangedData} = useShoppingListItemsChangedSubscription({
    variables: {listId: currentShoppingListId || ''},
    skip: !userId || !currentShoppingListId,
  });

  // Poll for home invites
  const {data: invitesData} = useGetHomeInvitesQuery({
    variables: {homeId: selectedHomeId || ''},
    skip: !userId || !selectedHomeId,
    pollInterval: 30000,
  });
  // Handle app state changes
  useEffect(() => {
    const subscription = AppState.addEventListener('change', setAppState);
    return () => subscription.remove();
  }, []);

  // Handle general notifications
  useEffect(() => {
    if (notificationData?.notificationReceived) {
      const {notification, mutation, timestamp} =
        notificationData.notificationReceived;

      if (notification && mutation !== MutationType.Deleted) {
        const parsed = parseNotificationPayload(notification.payload);
        const notificationType = notification.type as NotificationType;

        const newNotification = {
          id: notification.id,
          type: notificationType,
          category: getCategoryFromType(notificationType),
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

        addNotification(newNotification);

        if (notification.status !== NotificationStatus.Read) {
          showLocalNotification({
            id: notification.id,
            title: parsed.title,
            body: parsed.message,
          });
        }
      }
    }
  }, [notificationData, addNotification]);

  // Handle urgent notifications
  useEffect(() => {
    if (urgentNotificationData?.urgentNotificationReceived) {
      const {notification, timestamp} =
        urgentNotificationData.urgentNotificationReceived;

      if (notification) {
        const parsed = parseNotificationPayload(notification.payload);

        showLocalNotification({
          id: notification.id,
          title: `🚨 ${parsed.title}`,
          body: parsed.message,
          priority: 'high',
        });
      }
    }
  }, [urgentNotificationData]);

  // Handle membership updates
  useEffect(() => {
    if (membershipData?.myMembershipUpdated) {
      const update = membershipData.myMembershipUpdated;

      if (update.mutation === MembershipMutationType.Created) {
        const notification = {
          id: `membership-${Date.now()}`,
          type: NotificationType.MembershipInvite,
          category: NotificationCategory.MEMBERSHIP,
          priority: NotificationPriority.HIGH,
          title: 'New Home Invitation',
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

        addNotification(notification);
        showLocalNotification({
          id: notification.id,
          title: notification.title,
          body: notification.message,
        });
      }
    }
  }, [membershipData, addNotification]);

  // Handle collaboration updates
  useEffect(() => {
    if (collaborationData?.shoppingListCollaboratorsChanged) {
      const change = collaborationData.shoppingListCollaboratorsChanged;

      if (
        change.mutation === MutationType.CollaboratorAdded &&
        change.userId !== currentUserId
      ) {
        const notification = {
          id: `collab-${Date.now()}`,
          type: NotificationType.CollaborationInvite,
          category: NotificationCategory.COLLABORATION,
          priority: NotificationPriority.HIGH,
          title: 'Added to Shopping List',
          message: `You've been added as a collaborator`,
          payload: {
            listId: change.listId,
            role: change.collaborator?.role,
            collaboratorId: change.collaborator?.id,
          },
          sentAt: new Date().toISOString(),
          requiresAction: true,
          actionType: 'VIEW_LIST',
          actionData: {
            listId: change.listId,
          },
        };

        addNotification(notification);
        showLocalNotification({
          id: notification.id,
          title: notification.title,
          body: notification.message,
        });
      }
    }
  }, [collaborationData, addNotification, currentUserId]);

  // Handle shopping list item changes
  useEffect(() => {
    if (itemsChangedData?.shoppingListItemsChanged) {
      const change = itemsChangedData.shoppingListItemsChanged;

      // Only notify if change was made by someone else
      if (change.userId !== currentUserId) {
        let title = '';
        let message = '';

        switch (change.mutation) {
          case MutationType.ItemAdded:
            title = 'Item Added';
            message = `${change.item?.itemName} was added by ${change.item?.addedBy?.profile?.displayName || 'someone'}`;
            break;
          case MutationType.ItemRemoved:
            title = 'Item Removed';
            message = `${change.item?.itemName} was removed`;
            break;
          case MutationType.ItemCompleted:
            title = 'Item Purchased';
            message = `${change.item?.itemName} was marked as purchased`;
            break;
          case MutationType.ItemUpdated:
            title = 'Item Updated';
            message = `${change.item?.itemName} was updated`;
            break;
        }

        if (title && message) {
          const notification = {
            id: `item-change-${Date.now()}`,
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

          addNotification(notification);

          // Only show notification if app is in background
          if (appState === 'background' || appState === 'inactive') {
            showLocalNotification({
              id: notification.id,
              title: notification.title,
              body: notification.message,
            });
          }
        }
      }
    }
  }, [itemsChangedData, addNotification, currentUserId]);

  // Handle home invites (polling)
  useEffect(() => {
    if (invitesData?.homeInvites) {
      const pendingInvites = invitesData.homeInvites.filter(
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

          addNotification(notification);
          showLocalNotification({
            id: notification.id,
            title: notification.title,
            body: notification.message,
          });
        }
      });
    }
  }, [invitesData, addNotification]);

  return {
    notificationCount: useStore(
      state => state.notifications.filter(n => !n.readAt).length,
    ),
    notifications: useStore(state => state.notifications),
  };
};
