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

export interface NotificationItem {
  id: string;
  type: NotificationType;
  category: NotificationCategory;
  priority: NotificationPriority;
  title: string;
  message: string;
  // GraphQL JSON scalar — generated as `any`; consumers (NotificationActionHandler,
  // InvitationAcceptanceModal) read dynamic keys without narrowing, so a stricter
  // type would require a cross-module refactor of those non-editable files.
  payload: any;
  sentAt: string;
  readAt?: string | null;
  isRead: boolean;
  requiresAction?: boolean;
  actionType?: string;
  actionData?: Record<string, unknown>;
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

      state.unreadCount = state.notifications.filter(n => !n.isRead).length;
      state.urgentCount = state.notifications.filter(
        n => !n.isRead && n.priority === NotificationPriority.URGENT,
      ).length;
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

      state.unreadCount = state.notifications.filter(n => !n.isRead).length;
      state.urgentCount = state.notifications.filter(
        n => !n.isRead && n.priority === NotificationPriority.URGENT,
      ).length;
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
      draft.unreadCount = draft.notifications.filter(n => !n.isRead).length;
      draft.urgentCount = draft.notifications.filter(
        n => !n.isRead && n.priority === NotificationPriority.URGENT,
      ).length;
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
        state.unreadCount = Math.max(0, state.unreadCount - 1);
        if (notification.priority === NotificationPriority.URGENT) {
          state.urgentCount = Math.max(0, state.urgentCount - 1);
        }
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
        state.unreadCount += 1;
        if (notification.priority === NotificationPriority.URGENT) {
          state.urgentCount += 1;
        }
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
      state.unreadCount = 0;
      state.urgentCount = 0;
    });
  },

  removeNotification: notificationId => {
    set(state => {
      const index = state.notifications.findIndex(n => n.id === notificationId);
      if (index !== -1) {
        const notification = state.notifications[index];
        const wasUnread = !notification.isRead;
        const wasUrgent = notification.priority === NotificationPriority.URGENT;

        state.notifications.splice(index, 1);

        if (wasUnread) {
          state.unreadCount = Math.max(0, state.unreadCount - 1);
          if (wasUrgent) {
            state.urgentCount = Math.max(0, state.urgentCount - 1);
          }
        }
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
      state.unreadCount = state.notifications.filter(n => !n.isRead).length;
      state.urgentCount = state.notifications.filter(
        n => !n.isRead && n.priority === NotificationPriority.URGENT,
      ).length;
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
