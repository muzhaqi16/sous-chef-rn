import {NotificationType} from '#store/slices/notificationSlice';
import Icon from '@react-native-vector-icons/material-icons';

type IconProps = React.ComponentProps<typeof Icon>;

export const getNotificationIcon = (
  type: NotificationType,
): IconProps['name'] => {
  switch (type) {
    case NotificationType.EXPIRY_REMINDER:
      return 'schedule';
    case NotificationType.LOW_STOCK:
      return 'inventory-2';
    case NotificationType.NEW_ITEM_ADDED:
      return 'add-circle';
    case NotificationType.ITEM_UPDATED:
      return 'edit';
    case NotificationType.ITEM_DELETED:
      return 'delete';
    case NotificationType.MEMBERSHIP_INVITE:
      return 'home';
    case NotificationType.COLLABORATION_INVITE:
      return 'group-add';
    case NotificationType.LIST_UPDATED:
      return 'list';
    case NotificationType.HOME_JOINED:
      return 'people';
    default:
      return 'notifications';
  }
};

export const getNotificationColor = (type: NotificationType): string => {
  switch (type) {
    case NotificationType.EXPIRY_REMINDER:
      return '#FF9800'; // Warning orange
    case NotificationType.LOW_STOCK:
      return '#FFC107'; // Amber
    case NotificationType.MEMBERSHIP_INVITE:
    case NotificationType.COLLABORATION_INVITE:
      return '#2196F3'; // Blue
    case NotificationType.ITEM_DELETED:
      return '#F44336'; // Red
    default:
      return '#4CAF50'; // Green
  }
};

export const getNotificationActionText = (
  type: NotificationType,
): string | null => {
  switch (type) {
    case NotificationType.MEMBERSHIP_INVITE:
      return 'View Invitation';
    case NotificationType.COLLABORATION_INVITE:
      return 'View List';
    case NotificationType.EXPIRY_REMINDER:
      return 'View Items';
    case NotificationType.LOW_STOCK:
      return 'Add to Shopping List';
    case NotificationType.LIST_UPDATED:
      return 'View List';
    default:
      return null;
  }
};
