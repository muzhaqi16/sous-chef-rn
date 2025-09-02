import {NotificationType} from '#generated';
import Icon from '@react-native-vector-icons/material-icons';

type IconProps = React.ComponentProps<typeof Icon>;

export const getNotificationIcon = (
  type: NotificationType,
): IconProps['name'] => {
  switch (type) {
    case NotificationType.ExpiryReminder:
      return 'schedule';
    case NotificationType.LowStock:
      return 'inventory-2';
    case NotificationType.NewItemAdded:
      return 'add-circle';
    case NotificationType.ItemUpdated:
      return 'edit';
    case NotificationType.ItemDeleted:
      return 'delete';
    case NotificationType.MembershipInvite:
      return 'home';
    case NotificationType.CollaborationInvite:
      return 'group-add';
    case NotificationType.ListUpdated:
      return 'list';
    case NotificationType.HomeJoined:
      return 'people';
    default:
      return 'notifications';
  }
};

export const getNotificationColor = (type: NotificationType): string => {
  switch (type) {
    case NotificationType.ExpiryReminder:
      return '#FF9800'; // Warning orange
    case NotificationType.LowStock:
      return '#FFC107'; // Amber
    case NotificationType.MembershipInvite:
    case NotificationType.CollaborationInvite:
      return '#2196F3'; // Blue
    case NotificationType.ItemDeleted:
      return '#F44336'; // Red
    default:
      return '#4CAF50'; // Green
  }
};

export const getNotificationActionText = (
  type: NotificationType,
): string | null => {
  switch (type) {
    case NotificationType.MembershipInvite:
      return 'View Invitation';
    case NotificationType.CollaborationInvite:
      return 'View List';
    case NotificationType.ExpiryReminder:
      return 'View Items';
    case NotificationType.LowStock:
      return 'Add to Shopping List';
    case NotificationType.ListUpdated:
      return 'View List';
    default:
      return null;
  }
};
