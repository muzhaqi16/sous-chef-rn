/**
 * Derives the on-screen fields the server does not send. A projection, NOT a
 * second copy: it runs at read time, since notifications live only in the
 * Apollo cache.
 */

import {
  isNotificationPayload,
  type ExpirationLinkData,
  type NotificationPayload,
} from '#features/notifications/types';
import type {
  NotificationType,
  Priority,
} from '#/graphql/generated/schemaTypes';
import {
  NotificationCategory,
  NotificationStatus,
} from '#/graphql/generated/schemaTypes';
import { getNotificationAction } from '#features/notifications/utils/notificationHelpers';
import type { UseNotificationsOnLaunch_NotificationFragment } from '#features/notifications/hooks/useNotificationsOnLaunch.generated';

/**
 * Mirrors the server's definition behind `notificationSummary.unreadCount` and
 * `unreadOnly`, so the local badge agrees. Listed POSITIVELY: a status added
 * later reads as terminal rather than inflating every badge.
 */
const UNREAD_STATUSES: readonly NotificationStatus[] = [
  NotificationStatus.Pending,
  NotificationStatus.Sent,
];

/**
 * The server's fields plus the derived ones; nothing holds it. `title` and
 * `message` reach the screen only when `isAuthoredContent` says a person wrote
 * them; otherwise the words come from `getNotificationCopy` at render.
 */
export interface DisplayNotification {
  id: string;
  type: NotificationType;
  isAuthoredContent: boolean;
  title?: string | null;
  message?: string | null;
  category: NotificationCategory;
  priority: Priority;
  payload: NotificationPayload;
  sentAt: string;
  expiresAt?: string | null;
  sourceId?: string | null;
  sourceType?: string | null;
  /**
   * The pantry stack the server names for this notification NOW: it follows a
   * merge, and null says there is none. Absent only on a notification built
   * before the field existed.
   */
  pantryItemId?: string | null;
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
  expiresOn?: string | null;
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
  const { requiresAction, actionType } = getNotificationAction(
    type,
    n.pantryItemId,
  );

  return {
    id: n.id,
    type,
    isAuthoredContent: n.isAuthoredContent,
    title: n.title,
    message: n.message,
    category: n.category ?? NotificationCategory.System,
    priority: n.priority,
    payload,
    sentAt: n.sentAt,
    expiresAt: n.expiresAt,
    sourceId: n.sourceId,
    sourceType: n.sourceType,
    pantryItemId: n.pantryItemId,
    actionUrl: n.actionUrl,
    readAt: n.readAt,
    isRead: !UNREAD_STATUSES.includes(n.status),
    requiresAction,
    actionType,
    actionData: payload,
    ...expirationLink,
  };
}
