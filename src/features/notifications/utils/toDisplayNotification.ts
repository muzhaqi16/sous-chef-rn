/**
 * Derive the fields a notification needs on screen but the server does not send.
 *
 * `isRead` collapses `status` to a boolean, and `requiresAction` / `actionType`
 * come from the notification's type. Everything else is passed straight
 * through, so this is a projection of the server fragment — NOT a second copy
 * of it. The notifications live only in the Apollo cache, so this runs at read
 * time.
 *
 * `priority` is the schema's own `Priority`, not renamed locally.
 */

import {
  isNotificationPayload,
  type ExpirationLinkData,
  type NotificationPayload,
} from '#store/slices/notificationSlice';
import {
  NotificationCategory,
  NotificationStatus,
  NotificationType,
  Priority,
} from '#/graphql/generated/schemaTypes';
import {
  getNotificationAction,
  getNotificationTitle,
} from '#utils/notifications/notificationHelpers';
import type { UseNotificationsOnLaunch_NotificationFragment } from '#features/notifications/hooks/useNotificationsOnLaunch.generated';

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
   * Expiration enrichment, merged in from the `expirationNotificationChanged`
   * subscription. Genuinely client-side: it arrives on a different event from
   * the notification it belongs to, sometimes BEFORE it, so it is buffered in
   * the store (`pendingExpirationLinks`) and applied here at read time. This is
   * the one part of a notification the server does not hand over whole.
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
   * The buffered `expirationNotificationChanged` enrichment for this id, if it
   * has arrived. Merged here rather than stored on the notification, because
   * the two events are independent and either can land first.
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
