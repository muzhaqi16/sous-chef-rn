import { StateCreator } from 'zustand';
import { RootState } from '../index';
import {
  NotificationType,
  NotificationCategory,
} from '#/graphql/generated/schemaTypes';
import { safeParseDate } from '#utils/dateUtils';

// Helper to check if a notification is an invitation (should always show)
// These notification types ask user to join something - they shouldn't require
// the user to already have that context (home, list) selected
const isInvitationNotification = (type: NotificationType): boolean =>
  type === NotificationType.HomeInvitation ||
  type === NotificationType.MembershipInvite ||
  type === NotificationType.CollaborationInvite;

export enum NotificationPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  URGENT = 'URGENT',
}

/** Category values derived from the server enum — used by filter UI */
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

export interface NotificationItem {
  id: string;
  type: NotificationType;
  category: NotificationCategory;
  priority: NotificationPriority;
  title: string;
  message: string;
  // The notification's JSON payload, typed via NotificationPayload (the server
  // delivers it as an untyped JSON scalar; it's narrowed at the ingestion
  // boundary via isNotificationPayload).
  payload: NotificationPayload;
  sentAt: string;
  readAt?: string | null;
  isRead: boolean;
  // Server source-correlation (see Notification.sourceId/sourceType): sourceId
  // is the triggering entity's id (e.g. a HomeInvite id); sourceType is its
  // label (HOME_INVITE / MEMBERSHIP_INVITE / COLLABORATION_INVITE). Preferred
  // over digging the JSON payload for the entity id.
  sourceId?: string | null;
  sourceType?: string | null;
  // Deep-link / CTA destination supplied by the server.
  actionUrl?: string | null;
  requiresAction?: boolean;
  actionType?: string;
  // Carries the notification's JSON payload for action handling. Write-only in
  // practice (no current readers).
  actionData?: NotificationPayload;
  expiresAt?: string | null;
  // Expiration notification enrichment (linked from expirationNotificationChanged subscription)
  expirationNotificationId?: string | null;
  expirationAction?: string | null;
  daysUntilExpiry?: number | null;
  pantryItemName?: string | null;
  pantryItemImageUrl?: string | null;
}

/** Data passed from the expirationNotificationChanged subscription to enrich a generic notification. */
export interface ExpirationLinkData {
  expirationNotificationId: string;
  expirationAction?: string | null;
  daysUntilExpiry?: number | null;
  pantryItemName?: string | null;
  pantryItemImageUrl?: string | null;
}

export interface NotificationState {
  notifications: NotificationItem[];
  unreadCount: number;
  urgentCount: number;
  lastFetchedAt: string | null;
  // Buffers enrichment data when expirationNotificationChanged fires before notificationChanged
  pendingExpirationLinks: Record<string, ExpirationLinkData>;

  // Actions
  addNotification: (notification: Omit<NotificationItem, 'isRead'>) => void;
  addMultipleNotifications: (
    notifications: Omit<NotificationItem, 'isRead'>[],
  ) => void;
  markAsRead: (notificationId: string) => void;
  markAsUnread: (notificationId: string) => void;
  markAsReadWithSync: (
    notificationId: string,
    callback?: (success: boolean) => void,
  ) => void;
  markAllAsRead: () => void;
  removeNotification: (notificationId: string) => void;
  clearAll: () => void;
  updateUnreadCount: () => void;
  /**
   * Seed the badge counts from the server's authoritative totals (`me`).
   * Overrides the list-derived recompute so the badge is correct even when
   * more unread exist than the feed page loads, or after a cache clear.
   */
  setServerNotificationCounts: (
    unreadCount: number,
    hasUrgent: boolean,
  ) => void;
  setLastFetchedAt: (timestamp: string) => void;
  cleanupOrphanedSubscriptions: () => void;
  // Expiration actions
  setExpirationAction: (notificationId: string, action: string) => void;
  linkExpirationData: (
    genericNotificationId: string,
    expirationData: ExpirationLinkData,
  ) => void;

  // Selectors
  getUnreadNotifications: () => NotificationItem[];
  getNotificationsByCategory: (
    category: NotificationCategory,
  ) => NotificationItem[];
  getUrgentNotifications: () => NotificationItem[];
  getExpirationNotification: (
    genericNotificationId: string,
  ) => NotificationItem | undefined;

  // Reset
  resetNotifications: () => void;
}

/**
 * Maximum number of notifications to retain in the store.
 * When exceeded, oldest read notifications are evicted first.
 * Prevents unbounded memory growth from immer patches and persist serialization.
 */
const MAX_NOTIFICATIONS = 100;

/**
 * Recomputes `unreadCount` / `urgentCount` from the `notifications` list in a
 * single pass. This is the one source of truth for the derived counts — every
 * mutator routes through it instead of hand-maintaining `±1` deltas, which
 * removes the drift risk of keeping derived state in sync across many call
 * sites. Behavior is identical to the previous per-site recomputation; it just
 * lives in one place.
 */
const recomputeCounts = (state: {
  notifications: NotificationItem[];
  unreadCount: number;
  urgentCount: number;
}): void => {
  let unread = 0;
  let urgent = 0;
  for (const n of state.notifications) {
    if (n.isRead) continue;
    unread += 1;
    if (n.priority === NotificationPriority.URGENT) urgent += 1;
  }
  state.unreadCount = unread;
  state.urgentCount = urgent;
};

const initialNotificationState: Omit<
  NotificationState,
  | 'addNotification'
  | 'addMultipleNotifications'
  | 'markAsRead'
  | 'markAsUnread'
  | 'markAsReadWithSync'
  | 'markAllAsRead'
  | 'removeNotification'
  | 'clearAll'
  | 'updateUnreadCount'
  | 'setServerNotificationCounts'
  | 'setLastFetchedAt'
  | 'setExpirationAction'
  | 'linkExpirationData'
  | 'getUnreadNotifications'
  | 'getNotificationsByCategory'
  | 'getUrgentNotifications'
  | 'getExpirationNotification'
  | 'resetNotifications'
  | 'cleanupOrphanedSubscriptions'
> = {
  notifications: [],
  unreadCount: 0,
  urgentCount: 0,
  lastFetchedAt: null,
  pendingExpirationLinks: {},
};

export const createNotificationSlice: StateCreator<
  RootState,
  [['zustand/immer', never]],
  [],
  NotificationState
> = (set, get) => ({
  ...initialNotificationState,
  // Enhanced addNotification with safety checks
  addNotification: notification => {
    const state = get();

    // Safety check: Don't add notifications if user can't receive them
    if (!state.user?.emailVerified) {
      return;
    }

    // Invitations should always be shown - user needs them to join homes/lists
    const isInvitation = isInvitationNotification(notification.type);

    // Safety check: Don't add pantry notifications without pantry
    if (
      notification.category === NotificationCategory.Pantry &&
      !state.selectedPantryId
    ) {
      return;
    }

    // Safety check: Don't add home notifications without home (except invitations)
    if (
      notification.category === NotificationCategory.Home &&
      !state.selectedHomeId &&
      !isInvitation
    ) {
      return;
    }

    // Safety check: Don't add shopping list notifications without list
    if (
      notification.category === NotificationCategory.Shopping &&
      !state.selectedShoppingListId
    ) {
      return;
    }

    // Check for duplicates before adding
    const existingNotification = get().notifications.find(
      n => n.id === notification.id,
    );
    if (existingNotification) {
      return;
    }

    set(state => {
      const newNotification: NotificationItem = {
        ...notification,
        isRead: false,
        // Ensure sentAt is always a valid ISO string
        sentAt:
          safeParseDate(notification.sentAt)?.toISOString() ||
          new Date().toISOString(),
      };

      // Apply any buffered expiration enrichment data (race condition handling:
      // expirationNotificationChanged may have fired before this generic notification)
      const pendingLink = state.pendingExpirationLinks[newNotification.id];
      if (pendingLink) {
        newNotification.expirationNotificationId =
          pendingLink.expirationNotificationId;
        newNotification.daysUntilExpiry = pendingLink.daysUntilExpiry;
        newNotification.pantryItemName = pendingLink.pantryItemName;
        newNotification.pantryItemImageUrl = pendingLink.pantryItemImageUrl;
        if (pendingLink.expirationAction) {
          newNotification.expirationAction = pendingLink.expirationAction;
        }
        delete state.pendingExpirationLinks[newNotification.id];
      }

      state.notifications.unshift(newNotification);

      // Evict oldest read notifications when over the cap
      if (state.notifications.length > MAX_NOTIFICATIONS) {
        const keep: NotificationItem[] = [];
        const readOverflow: NotificationItem[] = [];
        for (const n of state.notifications) {
          if (!n.isRead || keep.length < MAX_NOTIFICATIONS) {
            keep.push(n);
          } else {
            readOverflow.push(n);
          }
        }
        state.notifications = keep.slice(0, MAX_NOTIFICATIONS);
      }

      recomputeCounts(state);
    });
  },

  // Safe batch add with filtering
  addMultipleNotifications: notifications => {
    const state = get();

    if (!state.user?.emailVerified) {
      return;
    }

    // Filter notifications based on current state
    const validNotifications = notifications.filter(notification => {
      // Invitations should always be shown - user needs them to join homes/lists
      if (isInvitationNotification(notification.type)) {
        return true;
      }

      if (
        notification.category === NotificationCategory.Pantry &&
        !state.selectedPantryId
      ) {
        return false;
      }
      if (
        notification.category === NotificationCategory.Home &&
        !state.selectedHomeId
      ) {
        return false;
      }
      if (
        notification.category === NotificationCategory.Shopping &&
        !state.selectedShoppingListId
      ) {
        return false;
      }
      return true;
    });

    if (validNotifications.length === 0) {
      return;
    }

    set(state => {
      // Get existing notification IDs to prevent duplicates
      const existingIds = new Set(state.notifications.map(n => n.id));

      const newNotifications = validNotifications
        .filter(n => !existingIds.has(n.id)) // Only add notifications that don't exist
        .map(n => ({
          ...n,
          isRead: false,
          // Ensure sentAt is always a valid ISO string
          sentAt:
            safeParseDate(n.sentAt)?.toISOString() || new Date().toISOString(),
        }));

      if (newNotifications.length > 0) {
        state.notifications.unshift(...newNotifications);
      }

      // Evict oldest read notifications when over the cap
      if (state.notifications.length > MAX_NOTIFICATIONS) {
        const keep: NotificationItem[] = [];
        for (const n of state.notifications) {
          if (!n.isRead || keep.length < MAX_NOTIFICATIONS) {
            keep.push(n);
          }
        }
        state.notifications = keep.slice(0, MAX_NOTIFICATIONS);
      }

      recomputeCounts(state);
    });
  },

  cleanupOrphanedSubscriptions: () => {
    const state = get();

    set(draft => {
      // Remove notifications for entities that no longer exist (but always keep invitations)
      draft.notifications = draft.notifications.filter(notification => {
        // Always keep invitations - user needs them to join homes/lists
        if (isInvitationNotification(notification.type)) {
          return true;
        }

        if (
          notification.category === NotificationCategory.Pantry &&
          !state.selectedPantryId
        ) {
          return false;
        }
        if (
          notification.category === NotificationCategory.Shopping &&
          !state.selectedShoppingListId
        ) {
          return false;
        }
        if (
          notification.category === NotificationCategory.Home &&
          !state.selectedHomeId
        ) {
          return false;
        }
        return true;
      });

      // Recalculate counts
      recomputeCounts(draft);
    });
  },

  markAsRead: notificationId => {
    set(state => {
      const notification = state.notifications.find(
        n => n.id === notificationId,
      );
      if (notification && !notification.isRead) {
        notification.isRead = true;
        notification.readAt = new Date().toISOString();
        recomputeCounts(state);
      }
    });
  },

  markAsUnread: notificationId => {
    set(state => {
      const notification = state.notifications.find(
        n => n.id === notificationId,
      );
      if (notification && notification.isRead) {
        notification.isRead = false;
        notification.readAt = undefined;
        recomputeCounts(state);
      }
    });
  },

  markAsReadWithSync: (notificationId, callback) => {
    // Mark as read locally for immediate UI feedback.
    // Server sync is handled by useNotificationSync hook (syncMarkAsRead).
    get().markAsRead(notificationId);

    if (callback) {
      callback(true);
    }
  },

  markAllAsRead: () => {
    set(state => {
      const now = new Date().toISOString();
      state.notifications.forEach(n => {
        if (!n.isRead) {
          n.isRead = true;
          n.readAt = now;
        }
      });
      recomputeCounts(state);
    });
  },

  removeNotification: notificationId => {
    set(state => {
      const index = state.notifications.findIndex(n => n.id === notificationId);
      if (index !== -1) {
        state.notifications.splice(index, 1);
        recomputeCounts(state);
      }
    });
  },

  clearAll: () => {
    set(state => {
      state.notifications = [];
      state.unreadCount = 0;
      state.urgentCount = 0;
    });
  },

  updateUnreadCount: () => {
    set(state => {
      recomputeCounts(state);
    });
  },

  setServerNotificationCounts: (unreadCount, hasUrgent) => {
    set(state => {
      // Server truth wins for the badge total. `hasUrgentNotifications` is a
      // boolean, so keep any list-derived urgent count when it's true and clear
      // it when the server reports none outstanding.
      state.unreadCount = unreadCount;
      state.urgentCount = hasUrgent ? Math.max(state.urgentCount, 1) : 0;
    });
  },

  setLastFetchedAt: timestamp => {
    set({ lastFetchedAt: timestamp });
  },

  setExpirationAction: (notificationId, action) => {
    set(state => {
      const notification = state.notifications.find(
        n => n.id === notificationId,
      );
      if (notification) {
        notification.expirationAction = action;
      }
    });
  },

  linkExpirationData: (genericNotificationId, expirationData) => {
    set(state => {
      const notification = state.notifications.find(
        n => n.id === genericNotificationId,
      );
      if (notification) {
        // Generic notification already exists — enrich it in place
        notification.expirationNotificationId =
          expirationData.expirationNotificationId;
        notification.daysUntilExpiry =
          expirationData.daysUntilExpiry ?? notification.daysUntilExpiry;
        notification.pantryItemName =
          expirationData.pantryItemName ?? notification.pantryItemName;
        notification.pantryItemImageUrl =
          expirationData.pantryItemImageUrl ?? notification.pantryItemImageUrl;
        if (expirationData.expirationAction) {
          notification.expirationAction = expirationData.expirationAction;
        }
      } else {
        // Race condition: expiration subscription fired before general notification.
        // Buffer the enrichment data — addNotification will apply it when the
        // generic notification arrives.
        state.pendingExpirationLinks[genericNotificationId] = expirationData;
      }
    });
  },

  getUnreadNotifications: () => {
    return get().notifications.filter(n => !n.isRead);
  },

  getNotificationsByCategory: category => {
    return get().notifications.filter(n => n.category === category);
  },

  getUrgentNotifications: () => {
    return get().notifications.filter(
      n => n.priority === NotificationPriority.URGENT && !n.isRead,
    );
  },

  getExpirationNotification: genericNotificationId => {
    return get().notifications.find(
      n => n.id === genericNotificationId && n.expirationNotificationId,
    );
  },

  resetNotifications: () => {
    set(initialNotificationState);
  },
});
