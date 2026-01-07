import React, { useState } from 'react';
import { Alert } from 'react-native';
import {
  InvitationAcceptanceModal,
  InvitationData,
} from './InvitationAcceptanceModal';
import { NotificationItem } from '#store/slices/notificationSlice';
import { useAppNavigation } from '#/hooks';
import { useStore } from '#store';

interface NotificationActionHandlerProps {
  children: (props: {
    showInvitationModal: (notification: NotificationItem) => void;
    handleNotificationAction: (notification: NotificationItem) => void;
  }) => React.ReactElement;
}

export const NotificationActionHandler: React.FC<
  NotificationActionHandlerProps
> = ({ children }) => {
  const [invitationModalVisible, setInvitationModalVisible] = useState(false);
  const [currentInvitation, setCurrentInvitation] =
    useState<InvitationData | null>(null);
  const { navigateTo, navigate } = useAppNavigation();
  const setSelectedHomeId = useStore(state => state.setSelectedHomeId);
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
      setInvitationModalVisible(true);
    }
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

      case 'ADD_TO_SHOPPING_LIST':
        // Navigate to shopping list and pre-fill the item
        try {
          // navigateTo.shoppingListMain({
          //   prefilledItem: {
          //     name: notification.payload.itemName,
          //     itemId: notification.payload.itemId,
          //   },
          // });
        } catch (error) {
          Alert.alert(
            'Navigation Error',
            'Could not navigate to shopping list.',
          );
        }
        break;

      case 'VIEW_EXPIRING_ITEMS':
        // Navigate to main pantry - expired items now shown inline
        try {
          navigate('Pantry');
        } catch (error) {
          Alert.alert(
            'Navigation Error',
            'Could not navigate to pantry.',
          );
        }
        break;

      case 'VIEW_LIST':
        // Navigate to specific shopping list
        try {
          // navigateTo.shoppingListMain({
          //   listId: notification.payload.listId,
          // });
        } catch (error) {
          Alert.alert(
            'Navigation Error',
            'Could not navigate to shopping list.',
          );
        }
        break;

      case 'REVIEW_SECURITY':
        // Navigate to security settings
        try {
          navigateTo.profile();
        } catch (error) {
          Alert.alert('Navigation Error', 'Could not navigate to settings.');
        }
        break;

      default:
        // Unknown action, show alert
        Alert.alert(
          'Action Required',
          `This notification requires action: ${notification.actionType}`,
          [
            { text: 'OK' },
            {
              text: 'Go to Notifications',
              onPress: () => {
                try {
                  navigateTo.notifications();
                } catch (error) {
                  console.log('Could not navigate to notifications');
                }
              },
            },
          ],
        );
    }
  };

  const handleInvitationAccept = async (invitation: InvitationData) => {
    // Handle successful acceptance
    if (invitation.type === 'HOME_INVITE') {
      // Set the newly accepted home as selected
      const acceptedHomeId = (invitation as any).acceptedHomeId;

      if (acceptedHomeId) {
        setSelectedHomeId(acceptedHomeId);

        // Wait briefly for GetHomes refetch to complete
        // (refetch is already configured in the acceptHomeInvite mutation)
        await new Promise(resolve => setTimeout(resolve, 500));

        // Navigate to pantry - it will auto-select the default pantry for this home
        navigateTo.pantryMain();
      } else {
        // Fallback if homeId not provided
        Alert.alert('Success', `Welcome to ${invitation.entityName}!`, [
          {
            text: 'OK',
            onPress: () => navigateTo.pantryMain(),
          },
        ]);
      }
    } else {
      // Shopping list invitation accepted
      Alert.alert(
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
    // Handle rejection
    Alert.alert('Invitation Rejected', 'The invitation has been declined.');
  };

  return (
    <>
      {children({
        showInvitationModal,
        handleNotificationAction,
      })}

      <InvitationAcceptanceModal
        visible={invitationModalVisible}
        invitation={currentInvitation}
        onClose={() => {
          setInvitationModalVisible(false);
          setCurrentInvitation(null);
        }}
        onAccept={handleInvitationAccept}
        onReject={handleInvitationReject}
      />
    </>
  );
};
