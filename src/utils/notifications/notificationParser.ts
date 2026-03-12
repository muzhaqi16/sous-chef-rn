import {NotificationType} from '#generated';
import {
  NotificationCategory,
  NotificationPriority,
} from '#store/slices/notificationSlice';

export const parseNotificationPayload = (
  payload: any,
): {
  title: string;
  message: string;
  details?: string;
} => {
  if (typeof payload === 'string') {
    try {
      const parsed = JSON.parse(payload);
      return {
        title: parsed.title || 'Notification',
        message: parsed.message || parsed.body || 'You have a new notification',
        details: parsed.details,
      };
    } catch {
      return {
        title: 'Notification',
        message: payload,
      };
    }
  }

  return {
    title: payload.title || 'Notification',
    message: payload.message || payload.body || 'You have a new notification',
    details: payload.details,
  };
};

export const getNotificationCategory = (
  type: NotificationType,
): NotificationCategory => {
  switch (type) {
    case NotificationType.ListUpdated:
      return NotificationCategory.SHOPPING_LIST;

    case NotificationType.ExpiryReminder:
    case NotificationType.LowStock:
    case NotificationType.NewItemAdded:
    case NotificationType.ItemUpdated:
    case NotificationType.ItemDeleted:
      return NotificationCategory.PANTRY;

    case NotificationType.CollaborationInvite:
    case NotificationType.CollaborationAccepted:
    case NotificationType.CollaborationDeclined:
    case NotificationType.CollaboratorRemoved:
    case NotificationType.CollaboratorRoleChanged:
    case NotificationType.CollaboratorPermissionsUpdated:
      return NotificationCategory.COLLABORATION;

    case NotificationType.MembershipInvite:
    case NotificationType.HomeInvitation:
    case NotificationType.HomeJoined:
      return NotificationCategory.MEMBERSHIP;

    case NotificationType.RecipeCooked:
    case NotificationType.RecipeSaved:
      return NotificationCategory.RECIPE;

    default:
      return NotificationCategory.SYSTEM;
  }
};

export const getNotificationPriority = (
  type: NotificationType,
): NotificationPriority => {
  switch (type) {
    case NotificationType.ExpiryReminder:
      return NotificationPriority.URGENT;

    case NotificationType.LowStock:
    case NotificationType.CollaboratorRemoved:
      return NotificationPriority.HIGH;

    case NotificationType.NewItemAdded:
    case NotificationType.ItemUpdated:
    case NotificationType.ItemDeleted:
    case NotificationType.CollaborationAccepted:
    case NotificationType.CollaborationDeclined:
    case NotificationType.RecipeCooked:
    case NotificationType.RecipeSaved:
      return NotificationPriority.LOW;

    default:
      return NotificationPriority.MEDIUM;
  }
};

export const getNotificationTitle = (
  type: NotificationType,
  payload?: any,
): string => {
  switch (type) {
    case NotificationType.ExpiryReminder:
      return '⚠️ Items Expiring Soon';
    case NotificationType.LowStock:
      return '📦 Low Stock Alert';
    case NotificationType.NewItemAdded:
      return 'New Item Added';
    case NotificationType.ItemUpdated:
      return 'Item Updated';
    case NotificationType.ItemDeleted:
      return 'Item Removed';
    case NotificationType.MembershipInvite:
    case NotificationType.HomeInvitation:
      return '🏠 Home Invitation';
    case NotificationType.CollaborationInvite:
      return '👥 List Invitation';
    case NotificationType.CollaborationAccepted:
      return 'Invitation Accepted';
    case NotificationType.CollaborationDeclined:
      return 'Invitation Declined';
    case NotificationType.CollaboratorRemoved:
      return 'Removed from List';
    case NotificationType.CollaboratorRoleChanged:
      return 'Role Changed';
    case NotificationType.CollaboratorPermissionsUpdated:
      return 'Permissions Updated';
    case NotificationType.ListUpdated:
      return '🛒 Shopping List Updated';
    case NotificationType.HomeJoined:
      return '👋 New Member Joined';
    case NotificationType.RecipeCooked:
      return 'Recipe Cooked';
    case NotificationType.RecipeSaved:
      return 'Recipe Saved';
    default:
      return payload?.title || 'Notification';
  }
};

export const getNotificationMessage = (
  type: NotificationType,
  payload?: any,
): string => {
  switch (type) {
    case NotificationType.ExpiryReminder:
      const count = payload?.items?.length || 0;
      return `${count} item${count !== 1 ? 's' : ''} expiring soon`;
    case NotificationType.LowStock:
      const stockCount = payload?.items?.length || 0;
      return `${stockCount} item${stockCount !== 1 ? 's' : ''} running low`;
    case NotificationType.MembershipInvite:
    case NotificationType.HomeInvitation:
      return `${payload?.inviterName || 'Someone'} invited you to join "${payload?.homeName || 'a home'}"`;
    case NotificationType.CollaborationInvite:
      return `You've been added to ${payload?.listName || 'a shopping list'}`;
    case NotificationType.CollaborationAccepted:
      return `${payload?.collaboratorName || 'Someone'} accepted your invitation to "${payload?.listName || 'a shopping list'}"`;
    case NotificationType.CollaborationDeclined:
      return `${payload?.collaboratorName || 'Someone'} declined your invitation to "${payload?.listName || 'a shopping list'}"`;
    case NotificationType.CollaboratorRemoved:
      return `You have been removed from "${payload?.listName || 'a shopping list'}"`;
    case NotificationType.CollaboratorRoleChanged:
      return `Your role on "${payload?.listName || 'a shopping list'}" was changed to ${payload?.newRole || 'a new role'}`;
    case NotificationType.CollaboratorPermissionsUpdated:
      return `Your permissions on "${payload?.listName || 'a shopping list'}" were updated`;
    case NotificationType.RecipeCooked:
      return `${payload?.recipeName || 'A recipe'} was marked as cooked`;
    case NotificationType.RecipeSaved:
      return `${payload?.recipeName || 'A recipe'} was saved to your collection`;
    default:
      return payload?.message || 'You have a new notification';
  }
};
