import { NotificationType } from '#/graphql/generated/schemaTypes';
import { Icon } from '#utils/iconUtils';
import { format } from 'date-fns/format';
import { safeParseDate } from '#utils/dateUtils';
import { getDateFnsLocale } from '#utils/dateLocale';
import type { NotificationPayload } from '#features/notifications/types';
import type { Translate } from '#/i18n/types';

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

/**
 * Structured fields the server attaches to EXPIRY_REMINDER notification
 * payloads. The payload arrives as an untyped JSON scalar, so each field is
 * read defensively — a legacy payload missing them yields `null`.
 */
export interface ExpiryReminderFields {
  itemName: string;
  daysUntilExpiry: number;
  isMultiBatch: boolean;
  batchOpenedAt: string | null;
  batchAddedAt: string | null;
  // Always set by the server (see expirationCheckProcessor) for both the
  // batch-level and item-level reminder paths — unlike sourceId/sourceType,
  // which alias either PantryItem or PantryItemBatch depending on which path
  // fired, this is unambiguously the pantry item id.
  pantryItemId: string | null;
}

export const readExpiryReminderFields = (
  payload: NotificationPayload,
): ExpiryReminderFields | null => {
  const { itemName, daysUntilExpiry, pantryItemId } = payload;
  if (typeof itemName !== 'string' || typeof daysUntilExpiry !== 'number') {
    return null;
  }
  return {
    itemName,
    daysUntilExpiry,
    isMultiBatch: payload.isMultiBatch === true,
    batchOpenedAt:
      typeof payload.batchOpenedAt === 'string' ? payload.batchOpenedAt : null,
    batchAddedAt:
      typeof payload.batchAddedAt === 'string' ? payload.batchAddedAt : null,
    pantryItemId: typeof pantryItemId === 'string' ? pantryItemId : null,
  };
};

// Only qualify the item name when more than one active batch exists — otherwise
// the name alone is unambiguous. The qualifier uses the batch's opened date (or
// added date as a fallback), parsed and formatted in the device's local time so
// it isn't off by a day like the server's UTC-formatted plain-text message.
const buildExpiryName = (
  fields: ExpiryReminderFields,
  t: Translate,
): string => {
  if (!fields.isMultiBatch) {
    return fields.itemName;
  }
  const openedAt = fields.batchOpenedAt;
  const parsed = safeParseDate(openedAt ?? fields.batchAddedAt);
  if (!parsed) {
    return fields.itemName;
  }
  const date = format(parsed, 'MMM d', { locale: getDateFnsLocale() });
  return openedAt
    ? t('notifications.expiry.qualifierOpened', { name: fields.itemName, date })
    : t('notifications.expiry.qualifierAdded', { name: fields.itemName, date });
};

const buildExpiryReminderMessage = (
  payload: NotificationPayload,
  t: Translate,
): string | null => {
  const fields = readExpiryReminderFields(payload);
  if (!fields) {
    return null;
  }
  const name = buildExpiryName(fields, t);
  if (fields.daysUntilExpiry <= 0) {
    return t('notifications.expiry.expiresToday', { name });
  }
  if (fields.daysUntilExpiry === 1) {
    return t('notifications.expiry.expiresTomorrow', { name });
  }
  return t('notifications.expiry.expiresInDays', {
    name,
    days: fields.daysUntilExpiry,
  });
};

/**
 * EXPIRY_REMINDER messages are rebuilt from the structured payload so the batch
 * qualifier date renders in the user's locale and timezone. Every other type —
 * and an expiry payload without those fields — uses the server's `message`.
 */
export const getNotificationDisplayMessage = (
  notification: {
    type: NotificationType;
    message: string;
    payload: NotificationPayload;
  },
  t: Translate,
): string => {
  if (notification.type === NotificationType.ExpiryReminder) {
    const built = buildExpiryReminderMessage(notification.payload, t);
    if (built) {
      return built;
    }
  }
  return notification.message;
};
