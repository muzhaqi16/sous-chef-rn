import {NotificationType} from '#generated';
import {Icon} from '#utils/iconUtils';

type IconProps = React.ComponentProps<typeof Icon>;

export const getNotificationIcon = (
  type: NotificationType,
): IconProps['name'] => {
  switch (type) {
    case NotificationType.ExpiryReminder:
      return 'time';
    case NotificationType.LowStock:
      return 'cube';
    case NotificationType.NewItemAdded:
      return 'add-circle';
    case NotificationType.ItemUpdated:
      return 'create';
    case NotificationType.ItemDeleted:
      return 'trash';
    case NotificationType.MembershipInvite:
      return 'home';
    case NotificationType.CollaborationInvite:
      return 'person-add';
    case NotificationType.ListUpdated:
      return 'list';
    case NotificationType.HomeJoined:
      return 'people';
    default:
      return 'notifications';
  }
};

