import { useNotificationStore } from '#features/notifications/store/notificationStore';
import React, { useState } from 'react';
import { useTranslation } from '#/i18n';
import { alertService } from '#/services/alertService';
import { toastService } from '#/services/toastService';
import { errorService } from '#/services/errorService';
import type { ExpirationAction } from '#/graphql/generated/schemaTypes';
import { InvitationAcceptanceModal } from './InvitationAcceptanceModal';
import type { InvitationData } from '#features/notifications/types';
import { ExpirationActionSheet } from './ExpirationActionSheet';
import type { DisplayNotification as NotificationItem } from '#features/notifications/utils/toDisplayNotification';
import { useAppNavigation } from '#hooks/navigation/useAppNavigation';
import { useAppStore } from '#store/useAppStore';
import { useNotificationActionData } from '#features/notifications/hooks/useNotificationActionData';
import { useExpirationNotificationSync } from '#features/notifications/hooks/useExpirationNotificationSync';
import { useNotificationSync } from '#features/notifications/hooks/useNotificationSync';
import { firstNonBlank } from '#/utils/firstNonBlank';

/** What answering an invite reads from its notification; null for any other. */
const readInvite = (data: NotificationItem['data']) => {
  if (data?.__typename === 'HomeInvitationNotificationData') {
    return { ...data, entityName: data.homeName };
  }
  if (data?.__typename === 'CollaborationInviteNotificationData') {
    return { ...data, entityName: data.listName };
  }
  return null;
};

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
  const { syncMarkAction } = useExpirationNotificationSync();
  const { syncMarkAsRead } = useNotificationSync();
  const { toPantryMain, toShoppingListMain, toNotifications } =
    useAppNavigation();
  const setHomeAndPantry = useAppStore(state => state.setHomeAndPantry);
  const { resolveExpirationLink, removeNotification } =
    useNotificationActionData();
  const linkExpirationData = useNotificationStore(
    state => state.linkExpirationData,
  );
  const showInvitationModal = (notification: NotificationItem) => {
    if (
      notification.actionType === 'ACCEPT_HOME_INVITE' ||
      notification.actionType === 'ACCEPT_SHOPPING_LIST_INVITE'
    ) {
      const invitationType =
        notification.actionType === 'ACCEPT_HOME_INVITE'
          ? 'HOME_INVITE'
          : 'SHOPPING_LIST_INVITE';

      const invite = readInvite(notification.data);
      const invitation: InvitationData = {
        type: invitationType,
        // The server's source correlation names the invite; the notification's
        // own data names it for one minted before the source fields existed.
        id: firstNonBlank(notification.sourceId, invite?.inviteId) ?? '',
        inviteId: invite?.inviteId,
        inviterName: invite?.inviterName,
        entityName: invite?.entityName ?? '',
        token: invite?.token,
        data: notification.data,
      };

      setCurrentInvitation(invitation);
      setCurrentNotificationId(notification.id);
      setInvitationModalVisible(true);
    }
  };

  // Resolves the ExpirationNotification behind a tapped EXPIRY_REMINDER
  // notification when the live subscription never linked it — one restored from
  // the persisted feed carries no link.
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
      expiresOn: resolved.expiresOn,
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
      void syncMarkAction(
        notification.id,
        notification.expirationNotificationId,
        action,
      );
      // One read state: the server reads the reminders a feed notification
      // announced with it, and this response states the badge.
      void syncMarkAsRead(notification.id);
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
        void showExpirationActionSheet(notification).catch(error =>
          errorService.reportError(error, {
            operation: 'NotificationActionHandler.showExpirationActionSheet',
          }),
        );
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

  const closeInvitationModal = () => {
    setInvitationModalVisible(false);
    setCurrentInvitation(null);
    setCurrentNotificationId(null);
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
        onClose={closeInvitationModal}
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
