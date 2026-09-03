import { useNotificationStore } from '#features/notifications/store/notificationStore';
import React, { useState } from 'react';
import { useTranslation } from '#/i18n';
import { alertService } from '#/services/alertService';
import { toastService } from '#/services/toastService';
import { ExpirationAction } from '#/graphql/generated/schemaTypes';
import { InvitationAcceptanceModal } from './InvitationAcceptanceModal';
import type { InvitationData } from '#features/notifications/types';
import { ExpirationActionSheet } from './ExpirationActionSheet';
import type { DisplayNotification as NotificationItem } from '#features/notifications/utils/toDisplayNotification';
import { useAppNavigation } from '#hooks/navigation/useAppNavigation';
import { useAppStore } from '#store/useAppStore';
import { useNotificationActionData } from '#features/notifications/hooks/useNotificationActionData';
import { useExpirationNotificationSync } from '#features/notifications/hooks/useExpirationNotificationSync';
import { useNotificationSync } from '#features/notifications/hooks/useNotificationSync';

interface NotificationActionHandlerProps {
  children: (props: {
    showInvitationModal: (notification: NotificationItem) => void;
    handleNotificationAction: (notification: NotificationItem) => void;
    showExpirationActionSheet: (
      notification: NotificationItem,
    ) => Promise<void>;
  }) => React.ReactElement;
}

export const NotificationActionHandler: React.FC<
  NotificationActionHandlerProps
> = ({ children }) => {
  const { t } = useTranslation();
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
  const currentUserId = useAppStore(state => state.user?.id);
  const { resolveExpirationLink, removeNotification } =
    useNotificationActionData(currentUserId);
  const linkExpirationData = useNotificationStore(
    state => state.linkExpirationData,
  );
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
        // Prefer the server's source correlation (sourceId is the triggering
        // HomeInvite / Membership id; sourceType labels which). Fall back to the
        // JSON payload for notifications minted before the source fields existed.
        id:
          notification.sourceId ||
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

  // Resolves the ExpirationNotification behind a tapped EXPIRY_REMINDER
  // notification when the live subscription never linked it (e.g. loaded from
  const showExpirationActionSheet = async (notification: NotificationItem) => {
    if (notification.expirationNotificationId) {
      // State-driven: setting this triggers ExpirationActionSheet visible prop
      setSelectedExpirationNotification(notification);
      return;
    }

    const resolved = await resolveExpirationLink(notification);
    // No match (e.g. a synthetic test notification with no backing row) —
    // nothing to show. The tap already marked the notification read.
    if (!resolved) return;

    const enrichment = {
      expirationNotificationId: resolved.id,
      daysUntilExpiry: resolved.daysUntilExpiry,
      pantryItemName: resolved.pantryItem.item.name,
      pantryItemImageUrl: resolved.pantryItem.item.imageUrl,
    };
    linkExpirationData(notification.id, enrichment);
    setSelectedExpirationNotification({ ...notification, ...enrichment });
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
        showExpirationActionSheet(notification);
        break;

      default:
        // Unknown action, show alert
        alertService.alert(
          t('notifications.actionRequiredTitle'),
          t('notifications.actionRequiredBody', {
            action: notification.actionType,
          }),
          [
            { text: t('labels.ok') },
            {
              text: t('notifications.goToNotifications'),
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
      const acceptedHomeId = invitation.acceptedHomeId;

      if (acceptedHomeId) {
        setHomeAndPantry(acceptedHomeId, null);

        // Defer navigation until idle to allow Zustand store update to propagate
        requestIdleCallback(() => {
          toPantryMain();
        });
      } else {
        toastService.success(
          t('toasts.welcomeToEntity', { name: invitation.entityName }),
        );
        toPantryMain();
      }
    } else {
      toastService.success(
        t('toasts.canCollaborateOn', { name: invitation.entityName }),
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
