/**
 * Derives the fields a notification needs on screen but the server does not
 * send. A projection of the server fragment, NOT a second copy: everything else
 * passes straight through, and it runs at read time because the notifications
 * live only in the Apollo cache.
 */

import {
  isNotificationPayload,
  type ExpirationLinkData,
  type NotificationPayload,
} from '#features/notifications/types';
import {
  NotificationCategory,
  NotificationStatus,
  NotificationType,
  Priority,
} from '#/graphql/generated/schemaTypes';
import {
  getNotificationAction,
  getNotificationTitle,
} from '#features/notifications/utils/notificationHelpers';
import type { UseNotificationsOnLaunch_NotificationFragment } from '#features/notifications/hooks/useNotificationsOnLaunch.generated';

/**
 * Mirrors the server's definition, which drives `unreadNotificationCount` and
 * the `unreadOnly` filter, so the local badge agrees with the seeded one.
 * Listed POSITIVELY: a status added to the enum later must read as terminal
 * rather than silently inflating every badge.
 */
const UNREAD_STATUSES: readonly NotificationStatus[] = [
  NotificationStatus.Pending,
  NotificationStatus.Sent,
];

/**
 * A notification as the UI needs it: the server's fields plus the four derived
 * ones. Declared here rather than in a store slice, because it describes a
 * projection for rendering — nothing holds it.
 */
export interface DisplayNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  category: NotificationCategory;
  priority: Priority;
  payload: NotificationPayload;
  sentAt: string;
  expiresAt?: string | null;
  sourceId?: string | null;
  sourceType?: string | null;
  actionUrl?: string | null;
  readAt?: string | null;
  isRead: boolean;
  requiresAction: boolean;
  actionType?: string | null;
  actionData: NotificationPayload;

  /**
   * Expiration enrichment from `PantryEvents`. It arrives on a different event
   * from the notification it belongs to, sometimes first, so it is buffered in
   * `pendingExpirationLinks` and applied here at read time.
   */
  expirationNotificationId?: string | null;
  expirationAction?: string | null;
  daysUntilExpiry?: number | null;
  pantryItemName?: string | null;
  pantryItemImageUrl?: string | null;
}

export function toDisplayNotification(
  n: UseNotificationsOnLaunch_NotificationFragment,
  /**
   * The buffered `PantryEvents` enrichment for this id, if it has arrived.
   * Merged here rather than stored, because either event can land first.
   */
  expirationLink?: ExpirationLinkData,
): DisplayNotification {
  const type = n.type;
  const payload: NotificationPayload = isNotificationPayload(n.payload)
    ? n.payload
    : {};
  const { requiresAction, actionType } = getNotificationAction(type);

  return {
    id: n.id,
    type,
    title: n.title ?? getNotificationTitle(type),
    message: n.message ?? '',
    category: n.category ?? NotificationCategory.System,
    priority: n.priority ?? Priority.Normal,
    payload,
    sentAt: n.sentAt,
    expiresAt: n.expiresAt,
    sourceId: n.sourceId,
    sourceType: n.sourceType,
    actionUrl: n.actionUrl,
    readAt: n.readAt,
    isRead: !UNREAD_STATUSES.includes(n.status),
    requiresAction,
    actionType,
    actionData: payload,
    ...expirationLink,
  };
}
