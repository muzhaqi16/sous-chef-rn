import {useEffect} from 'react';
import {
  useNotificationCreatedSubscription,
  useNotificationUpdatedSubscription,
  useMyMembershipUpdatedSubscription,
  useShoppingListCollaboratorsChangedSubscription,
  useMemberJoinedSubscription,
  useHomeInvitesQuery,
  useShoppingListUpdatedSubscription,
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

// Helper function to get category from notification type
const getCategoryFromType = (type: NotificationType): NotificationCategory => {
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

// Helper function to get priority from notification type
const getPriorityFromType = (type: NotificationType): NotificationPriority => {
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

export const useNotificationSubscriptions = (userId: string | undefined) => {
  const addNotification = useStore(state => state.addNotification);
  const selectedHomeId = useStore(state => state.selectedHomeId);

  // Subscribe to notification creation
  const {data: notificationData} = useNotificationCreatedSubscription({
    variables: {userId: userId!},
    skip: !userId,
  });

  // Subscribe to notification updates
  const {data: notificationUpdateData} = useNotificationUpdatedSubscription({
    variables: {userId: userId!},
    skip: !userId,
  });

  // Subscribe to membership updates for the selected home
  const {data: membershipData} = useMyMembershipUpdatedSubscription({
    skip: !userId,
  });

  // Subscribe to member joined events
  const {data: memberJoinedData} = useMemberJoinedSubscription({
    variables: {homeId: selectedHomeId!},
    skip: !selectedHomeId,
  });

  // Subscribe to shopping list updates
  const {data: shoppingListData} = useMyShoppingListsUpdatedSubscription({
    skip: !userId,
  });

  // Subscribe to collaboration changes
  const {data: collaborationData} =
    useShoppingListCollaboratorsChangedSubscription({
      skip: !userId,
    });

  // Poll for home invites
  const {data: invitesData} = useHomeInvitesQuery({
    variables: {homeId: selectedHomeId!},
    skip: !selectedHomeId,
    pollInterval: 30000, // Poll every 30 seconds
  });

  // Handle notification creation
  useEffect(() => {
    if (notificationData?.notificationCreated) {
      const notification = notificationData.notificationCreated;
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
        sentAt: notification.sentAt,
        readAt: notification.readAt,
      };

      addNotification(newNotification);

      // Show local notification
      showLocalNotification({
        id: notification.id,
        title: parsed.title,
        body: parsed.message,
      });
    }
  }, [notificationData, addNotification]);

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

  // Handle new member joined
  useEffect(() => {
    if (memberJoinedData?.memberJoined) {
      const member = memberJoinedData.memberJoined;

      const notification = {
        id: `member-joined-${Date.now()}`,
        type: NotificationType.HomeJoined,
        category: NotificationCategory.MEMBERSHIP,
        priority: NotificationPriority.MEDIUM,
        title: 'New Member Joined',
        message: `${member.node?.user.profile?.displayName || 'Someone'} joined your home`,
        payload: {
          homeId: member?.node?.homeId,
          userId: member.userId,
          userName: member.node?.user.profile?.displayName,
        },
        sentAt: new Date().toISOString(),
      };

      addNotification(notification);
      showLocalNotification({
        id: notification.id,
        title: notification.title,
        body: notification.message,
      });
    }
  }, [memberJoinedData, addNotification]);

  // Handle shopping list updates
  useEffect(() => {
    if (shoppingListData?.myShoppingListsUpdated) {
      const update = shoppingListData.myShoppingListsUpdated;

      if (
        update.mutation === MutationType.ItemAdded ||
        update.mutation === MutationType.ItemUpdated
      ) {
        const notification = {
          id: `list-update-${Date.now()}`,
          type: NotificationType.ListUpdated,
          category: NotificationCategory.SHOPPING_LIST,
          priority: NotificationPriority.LOW,
          title: 'Shopping List Updated',
          message: `${update.node?.name || 'A shopping list'} has been updated`,
          payload: {
            listId: update.node?.id,
            listName: update.node?.name,
            mutation: update.mutation,
          },
          sentAt: new Date().toISOString(),
        };

        addNotification(notification);
        showLocalNotification({
          id: notification.id,
          title: notification.title,
          body: notification.message,
        });
      }
    }
  }, [shoppingListData, addNotification]);

  // Handle collaboration updates
  useEffect(() => {
    if (collaborationData?.shoppingListCollaboratorsChanged) {
      const change = collaborationData.shoppingListCollaboratorsChanged;

      if (change.mutation === MutationType.CollaboratorAdded) {
        const notification = {
          id: `collab-${Date.now()}`,
          type: NotificationType.CollaborationInvite,
          category: NotificationCategory.COLLABORATION,
          priority: NotificationPriority.HIGH,
          title: 'Shopping List Invitation',
          message: `You've been added to a shopping list`,
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
  }, [collaborationData, addNotification]);

  // Handle home invites
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
            expiresAt: invite.expiresAt, // Add expiration from invite
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
};
