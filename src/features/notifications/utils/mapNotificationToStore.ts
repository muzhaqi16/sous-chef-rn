/**
 * Map a `useNotificationsOnLaunch_notification` fragment (server shape) into the
 * Zustand store's `NotificationItem` shape (minus `isRead`, which the store
 * derives from `readAt`). Shared by the launch fetch and the paginated history
 * fetch so the two can't drift.
 */

import {
  NotificationPriority,
  isNotificationPayload,
  type NotificationItem,
  type NotificationPayload,
} from '#store/slices/notificationSlice';
import {
  NotificationCategory,
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

export function mapNotificationToStore(
  n: UseNotificationsOnLaunch_NotificationFragment,
): Omit<NotificationItem, 'isRead'> {
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
    requiresAction,
    actionType,
    actionData: payload,
  };
}
