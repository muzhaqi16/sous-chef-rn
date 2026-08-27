import { NotificationCategory } from '#/graphql/generated/schemaTypes';

/** Data passed from the expirationNotificationChanged subscription to enrich a generic notification. */
export interface ExpirationLinkData {
  /** Absent until the enrichment event resolves the backing row. */
  expirationNotificationId?: string;
  expirationAction?: string | null;
  daysUntilExpiry?: number | null;
  pantryItemName?: string | null;
  pantryItemImageUrl?: string | null;
}

export const NOTIFICATION_CATEGORIES = Object.values(NotificationCategory);

/**
 * Typed shape of a notification's JSON payload. The server delivers this as a
 * `JSON` scalar (untyped), but every payload is an object map whose well-known
 * keys are read across the notification UI. Declaring those keys here gives the
 * consumers (NotificationActionHandler, InvitationAcceptanceModal,
 * NotificationDetailScreen) real types instead of `any`; the index signature
 * keeps room for notification-type-specific keys read dynamically.
 */
export interface NotificationPayload {
  inviteId?: string;
  membershipId?: string;
  inviterName?: string;
  homeName?: string;
  listName?: string;
  token?: string;
  message?: string;
  details?: string;
  [key: string]: unknown;
}

/**
 * Runtime guard that narrows an untyped JSON scalar value to NotificationPayload
 * at the ingestion boundary — no cast required. Any non-null, non-array object
 * is a valid payload (all typed keys are optional); primitives/arrays/null
 * collapse to an empty payload at the call site.
 */
export function isNotificationPayload(
  value: unknown,
): value is NotificationPayload {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
