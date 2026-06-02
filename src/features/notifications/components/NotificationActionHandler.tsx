import React, { useState } from 'react';
import { alertService } from '#/services/alertService';
import { toastService } from '#/services/toastService';
import { ExpirationAction } from '#/graphql/generated/schemaTypes';
import {
  InvitationAcceptanceModal,
  InvitationData,
} from './InvitationAcceptanceModal';
import { ExpirationActionSheet } from './ExpirationActionSheet';
import { NotificationItem } from '#store/slices/notificationSlice';
import { useAppNavigation } from '#hooks/navigation/useAppNavigation';
import { useAppStore } from '#store/useAppStore';
import { useExpirationNotificationSync } from '#features/notifications/hooks/useExpirationNotificationSync';
import { useNotificationSync } from '#features/notifications/hooks/useNotificationSync';

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

  const { toPantryMain, toShoppingListMain, toNotifications } =
    useAppNavigation();
  const setHomeAndPantry = useAppStore(state => state.setHomeAndPantry);
  const removeNotification = useAppStore(state => state.removeNotification);
  const { syncDelete } = useNotificationSync();
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
        id:
          notification.payload.inviteId ||
          notification.payload.membershipId ||
          '',
        title: notification.title,
        description: notification.message,
        inviterName: notification.payload.inviterName,
        entityName:
          notification.payload.homeName || notification.payload.listName || '',
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
      toPantryMain();
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
                toNotifications();
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
      const acceptedHomeId = (invitation as { acceptedHomeId?: string })
        .acceptedHomeId;

      if (acceptedHomeId) {
        setHomeAndPantry(acceptedHomeId, null);

        // Defer navigation until idle to allow Zustand store update to propagate
        requestIdleCallback(() => {
          toPantryMain();
        });
      } else {
        toastService.success(`Welcome to ${invitation.entityName}!`);
        toPantryMain();
      }
    } else {
      toastService.success(
        `You can now collaborate on ${invitation.entityName}`,
      );
      toShoppingListMain();
    }
  };

  const handleInvitationReject = () => {
    if (currentNotificationId) {
      removeNotification(currentNotificationId);
    }
  };

  const handleInvitationInvalidate = () => {
    // Underlying server invite is gone — permanently delete the notification
    // (server delete + optimistic local removal) so it stops reappearing on
    // every cold start / foreground refresh.
    if (currentNotificationId) {
      syncDelete(currentNotificationId);
    }
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
        onInvalidate={handleInvitationInvalidate}
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
