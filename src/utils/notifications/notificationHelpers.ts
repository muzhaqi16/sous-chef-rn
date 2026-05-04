import { NotificationType } from '#/graphql/generated/schemaTypes';
import { Icon } from '#utils/iconUtils';

type IconProps = React.ComponentProps<typeof Icon>;

export const getNotificationAction = (
  type: NotificationType,
): { requiresAction: boolean; actionType?: string } => {
  switch (type) {
    case NotificationType.HomeInvitation:
    case NotificationType.MembershipInvite:
      return { requiresAction: true, actionType: 'ACCEPT_HOME_INVITE' };
    case NotificationType.CollaborationInvite:
      return {
        requiresAction: true,
        actionType: 'ACCEPT_SHOPPING_LIST_INVITE',
      };
    case NotificationType.ExpiryReminder:
      return { requiresAction: true, actionType: 'VIEW_EXPIRING_ITEMS' };
    default:
      return { requiresAction: false };
  }
};

// Per-type label fallback for when the server sends a null `title`.
// Server-generated `title` is always preferred — this only fills the gap so
// list rows don't read literally "Notification". Sentence-level message text
// (e.g. "Tani invited you to Weekly Groceries") is intentionally NOT mirrored
// here: that belongs on the server alongside push/email payloads.
export const getNotificationTitle = (type: NotificationType): string => {
  switch (type) {
    case NotificationType.HomeInvitation:
    case NotificationType.MembershipInvite:
      return 'Home Invitation';
    case NotificationType.HomeJoined:
      return 'Joined Home';
    case NotificationType.CollaborationInvite:
      return 'Shopping List Invitation';
    case NotificationType.CollaborationAccepted:
      return 'Invitation Accepted';
    case NotificationType.CollaborationDeclined:
      return 'Invitation Declined';
    case NotificationType.CollaboratorRemoved:
      return 'Collaborator Removed';
    case NotificationType.CollaboratorRoleChanged:
      return 'Role Changed';
    case NotificationType.CollaboratorPermissionsUpdated:
      return 'Permissions Updated';
    case NotificationType.ExpiryReminder:
      return 'Items Expiring Soon';
    case NotificationType.LowStock:
      return 'Low Stock';
    case NotificationType.NewItemAdded:
      return 'New Item Added';
    case NotificationType.ItemUpdated:
      return 'Item Updated';
    case NotificationType.ItemDeleted:
      return 'Item Removed';
    case NotificationType.ListUpdated:
      return 'Shopping List Updated';
    case NotificationType.RecipeCooked:
      return 'Recipe Cooked';
    case NotificationType.RecipeSaved:
      return 'Recipe Saved';
    default:
      return 'Notification';
  }
};

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
