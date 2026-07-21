/**
 * Map a `useNotificationsOnLaunch_notification` fragment (server shape) into the
 * Zustand store's `NotificationItem` shape. Shared by the launch fetch and the
 * paginated history fetch so the two can't drift.
 */

import {
  NotificationPriority,
  isNotificationPayload,
  type NotificationItem,
  type NotificationPayload,
} from '#store/slices/notificationSlice';
import {
  NotificationCategory,
  NotificationStatus,
  Priority,
} from '#/graphql/generated/schemaTypes';
import {
  getNotificationAction,
  getNotificationTitle,
} from '#utils/notifications/notificationHelpers';
import type { UseNotificationsOnLaunch_NotificationFragment } from '#features/notifications/hooks/useNotificationsOnLaunch.generated';

function toStorePriority(p: Priority | null | undefined): NotificationPriority {
  return p === Priority.High
    ? NotificationPriority.HIGH
    : p === Priority.Urgent
    ? NotificationPriority.URGENT
    : p === Priority.Low
    ? NotificationPriority.LOW
    : NotificationPriority.MEDIUM;
}

/**
 * A notification is awaiting the user only while PENDING or SENT; READ,
 * CLICKED, DISMISSED, EXPIRED, and FAILED are all terminal. This mirrors the
 * server's definition, which drives `unreadNotificationCount` and the
 * `unreadOnly` feed filter, so the locally recomputed badge agrees with the
 * seeded one.
 *
 * Listed positively so a status added to the enum later reads as terminal
 * rather than silently inflating every badge — the same reason the server
 * expresses it this way.
 */
const UNREAD_STATUSES: readonly NotificationStatus[] = [
  NotificationStatus.Pending,
  NotificationStatus.Sent,
];

export function mapNotificationToStore(
  n: UseNotificationsOnLaunch_NotificationFragment,
): Omit<NotificationItem, 'isRead'> & { isRead: boolean } {
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
    priority: toStorePriority(n.priority),
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
  };
}
