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
  type: string | NotificationType,
): NotificationCategory => {
  const typeStr = type.toString();

  if (typeStr.includes('ShoppingList') || typeStr.includes('List')) {
    return NotificationCategory.SHOPPING_LIST;
  }
  if (
    typeStr.includes('Pantry') ||
    typeStr.includes('Expir') ||
    typeStr.includes('Stock')
  ) {
    return NotificationCategory.PANTRY;
  }
  if (typeStr.includes('Collaboration') || typeStr.includes('Collaborator')) {
    return NotificationCategory.COLLABORATION;
  }
  if (
    typeStr.includes('Membership') ||
    typeStr.includes('Member') ||
    typeStr.includes('Home')
  ) {
    return NotificationCategory.MEMBERSHIP;
  }
  if (
    typeStr.includes('Login') ||
    typeStr.includes('Security') ||
    typeStr.includes('Device')
  ) {
    return NotificationCategory.SECURITY;
  }
  if (typeStr.includes('User') || typeStr.includes('Account')) {
    return NotificationCategory.ACCOUNT;
  }

  return NotificationCategory.SYSTEM;
};

export const getNotificationPriority = (
  type: string | NotificationType,
): NotificationPriority => {
  const typeStr = type.toString();

  // Urgent priorities
  if (
    typeStr.includes('Expir') ||
    typeStr.includes('Security') ||
    typeStr.includes('Suspicious') ||
    typeStr.includes('Banned') ||
    typeStr.includes('Suspended')
  ) {
    return NotificationPriority.URGENT;
  }

  // High priorities
  if (
    typeStr.includes('LowStock') ||
    typeStr.includes('Invite') ||
    typeStr.includes('Failed') ||
    typeStr.includes('Warning')
  ) {
    return NotificationPriority.HIGH;
  }

  // Low priorities
  if (
    typeStr.includes('ItemAdded') ||
    typeStr.includes('ItemUpdated') ||
    typeStr.includes('Settings')
  ) {
    return NotificationPriority.LOW;
  }

  // Default to medium
  return NotificationPriority.MEDIUM;
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
    case NotificationType.ListUpdated:
      return '🛒 Shopping List Updated';
    case NotificationType.HomeJoined:
      return '👋 New Member Joined';
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
    default:
      return payload?.message || 'You have a new notification';
  }
};
