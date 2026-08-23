/**
 * Client-side notification state: the expiration-enrichment buffer.
 *
 * This slice used to hold the notification feed itself — the rows, the unread
 * and urgent counts, a `lastFetchedAt`, and CRUD for all of it — beside the
 * Apollo cache that already held the same notifications from the same server
 * events. Two copies, written from one source, read independently, with no rule
 * for which was current. It is all gone: the feed, its read state and its counts
 * live in the Apollo cache (`notificationCacheWrites.ts`).
 *
 * What is left is genuinely the client's own, and could not live in the cache:
 * `expirationNotificationChanged` and `notificationChanged` are separate events
 * and can arrive in either order. When the enrichment lands first there is no
 * notification to attach it to and nothing to key it against, so it waits here
 * until its partner arrives and `toDisplayNotification` merges it at read time.
 */
import { StateCreator } from 'zustand';
import { RootState } from '../index';
import { NotificationCategory } from '#/graphql/generated/schemaTypes';

/** Data passed from the expirationNotificationChanged subscription to enrich a generic notification. */
export interface ExpirationLinkData {
  expirationNotificationId: string;
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

export interface NotificationState {
  /** Enrichment keyed by the generic notification id it belongs to. */
  pendingExpirationLinks: Record<string, ExpirationLinkData>;

  setExpirationAction: (notificationId: string, action: string) => void;
  linkExpirationData: (
    genericNotificationId: string,
    expirationData: ExpirationLinkData,
  ) => void;
  /** Drop one entry once its notification has been acted on. */
  clearExpirationLink: (genericNotificationId: string) => void;

  resetNotifications: () => void;
}

export const initialNotificationState = {
  pendingExpirationLinks: {} as Record<string, ExpirationLinkData>,
};

export const createNotificationSlice: StateCreator<
  RootState,
  [['zustand/immer', never]],
  [],
  NotificationState
> = set => ({
  ...initialNotificationState,

  setExpirationAction: (notificationId, action) =>
    set(state => {
      const existing = state.pendingExpirationLinks[notificationId];
      if (existing) {
        existing.expirationAction = action;
      } else {
        // The action can be taken before the enrichment event lands; hold it so
        // the merge below still sees it.
        state.pendingExpirationLinks[notificationId] = {
          expirationNotificationId: notificationId,
          expirationAction: action,
        };
      }
    }),

  linkExpirationData: (genericNotificationId, expirationData) =>
    set(state => {
      state.pendingExpirationLinks[genericNotificationId] = {
        ...state.pendingExpirationLinks[genericNotificationId],
        ...expirationData,
      };
    }),

  clearExpirationLink: genericNotificationId =>
    set(state => {
      delete state.pendingExpirationLinks[genericNotificationId];
    }),

  resetNotifications: () =>
    set(state => {
      Object.assign(state, initialNotificationState);
    }),
});
