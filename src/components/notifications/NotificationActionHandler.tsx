import React, { useState } from 'react';
import { alertService } from '#/services/alertService';
import { ExpirationAction } from '#generated';
import {
  InvitationAcceptanceModal,
  InvitationData,
} from './InvitationAcceptanceModal';
import { ExpirationActionSheet } from './ExpirationActionSheet';
import { NotificationItem } from '#store/slices/notificationSlice';
import { useAppNavigation } from '#hooks/navigation/useAppNavigation';
import { useAppStore } from '#store/useAppStore';
import { useExpirationNotificationSync } from '#hooks/notifications/useExpirationNotificationSync';

interface NotificationActionHandlerProps {
  children: (props: {
    showInvitationModal: (notification: NotificationItem) => void;
    handleNotificationAction: (notification: NotificationItem) => void;
    showExpirationActionSheet: (notification: NotificationItem) => void;
  }) => React.ReactElement;
}

export const NotificationActionHandler: React.FC<
  NotificationActionHandlerProps
> = ({ children }) => {
  const [invitationModalVisible, setInvitationModalVisible] = useState(false);
  const [currentInvitation, setCurrentInvitation] =
    useState<InvitationData | null>(null);
  const [currentNotificationId, setCurrentNotificationId] = useState<
    string | null
  >(null);

  // Expiration action sheet — state-driven (no ref access during render)
  const [selectedExpirationNotification, setSelectedExpirationNotification] =
    useState<NotificationItem | null>(null);
  const { syncMarkAction, syncMarkRead } = useExpirationNotificationSync();

  const { navigateTo, navigate } = useAppNavigation();
  const setHomeAndPantry = useAppStore(state => state.setHomeAndPantry);
  const removeNotification = useAppStore(state => state.removeNotification);
  const showInvitationModal = (notification: NotificationItem) => {
    if (
      notification.actionType === 'ACCEPT_HOME_INVITE' ||
      notification.actionType === 'ACCEPT_SHOPPING_LIST_INVITE'
    ) {
      const invitationType =
        notification.actionType === 'ACCEPT_HOME_INVITE'
          ? 'HOME_INVITE'
          : 'SHOPPING_LIST_INVITE';

      const invitation: InvitationData = {
        type: invitationType,
        id: notification.payload.inviteId || notification.payload.membershipId,
        title: notification.title,
        description: notification.message,
        inviterName: notification.payload.inviterName,
        entityName:
          notification.payload.homeName || notification.payload.listName,
        token: notification.payload.token,
        payload: notification.payload,
      };

      setCurrentInvitation(invitation);
      setCurrentNotificationId(notification.id);
      setInvitationModalVisible(true);
    }
  };

  const showExpirationActionSheet = (notification: NotificationItem) => {
    if (notification.expirationNotificationId) {
      // State-driven: setting this triggers ExpirationActionSheet visible prop
      setSelectedExpirationNotification(notification);
    } else {
      // Fallback: navigate to pantry if expiration data not yet linked
      navigate('Pantry');
    }
  };

  const handleExpirationAction = (
    notification: NotificationItem,
    action: ExpirationAction,
  ) => {
    if (notification.expirationNotificationId) {
      syncMarkAction(
        notification.id,
        notification.expirationNotificationId,
        action,
      );
      // Also mark the expiration notification as read on the server
      syncMarkRead(notification.expirationNotificationId);
    }
    setSelectedExpirationNotification(null);
  };

  const handleNotificationAction = (notification: NotificationItem) => {
    if (!notification.requiresAction || !notification.actionType) {
      return;
    }

    switch (notification.actionType) {
      case 'ACCEPT_HOME_INVITE':
      case 'ACCEPT_SHOPPING_LIST_INVITE':
        showInvitationModal(notification);
        break;

      case 'VIEW_EXPIRING_ITEMS':
        // Show expiration action sheet if enriched data is available,
        // otherwise navigate to pantry as fallback
        showExpirationActionSheet(notification);
        break;

      default:
        // Unknown action, show alert
        alertService.alert(
          'Action Required',
          `This notification requires action: ${notification.actionType}`,
          [
            { text: 'OK' },
            {
              text: 'Go to Notifications',
              onPress: () => {
                navigateTo.notifications();
              },
            },
          ],
        );
    }
  };

  const handleInvitationAccept = async (invitation: InvitationData) => {
    // Remove the notification so the user can't re-open the modal
    if (currentNotificationId) {
      removeNotification(currentNotificationId);
    }

    // Handle successful acceptance
    if (invitation.type === 'HOME_INVITE') {
      // Set the newly accepted home as selected
      const acceptedHomeId = (invitation as any).acceptedHomeId;

      if (acceptedHomeId) {
        setHomeAndPantry(acceptedHomeId, null);

        // Defer navigation until idle to allow Zustand store update to propagate
        requestIdleCallback(() => {
          navigateTo.pantryMain();
        });
      } else {
        // Fallback if homeId not provided
        alertService.alert('Success', `Welcome to ${invitation.entityName}!`, [
          {
            text: 'OK',
            onPress: () => navigateTo.pantryMain(),
          },
        ]);
      }
    } else {
      // Shopping list invitation accepted
      alertService.alert(
        'Success',
        `You can now collaborate on ${invitation.entityName}`,
        [
          {
            text: 'View List',
            onPress: () => navigateTo.shoppingListMain,
          },
          { text: 'OK' },
        ],
      );
    }
  };

  const handleInvitationReject = () => {
    if (currentNotificationId) {
      removeNotification(currentNotificationId);
    }
    alertService.alert(
      'Invitation Rejected',
      'The invitation has been declined.',
    );
  };

  return (
    <>
      {children({
        showInvitationModal,
        handleNotificationAction,
        showExpirationActionSheet,
      })}

      <InvitationAcceptanceModal
        visible={invitationModalVisible}
        invitation={currentInvitation}
        onClose={() => {
          setInvitationModalVisible(false);
          setCurrentInvitation(null);
          setCurrentNotificationId(null);
        }}
        onAccept={handleInvitationAccept}
        onReject={handleInvitationReject}
      />

      <ExpirationActionSheet
        visible={selectedExpirationNotification != null}
        notification={selectedExpirationNotification}
        onActionSelected={handleExpirationAction}
        onDismiss={() => setSelectedExpirationNotification(null)}
      />
    </>
  );
};
