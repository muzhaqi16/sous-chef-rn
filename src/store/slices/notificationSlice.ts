import {StateCreator} from 'zustand';
import {RootState} from '../index';
import {NotificationType} from '#/graphql/generated';
import {safeParseDate} from '#utils/dateUtils';

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

export enum NotificationCategory {
  SHOPPING_LIST = 'SHOPPING_LIST',
  PANTRY = 'PANTRY',
  COLLABORATION = 'COLLABORATION',
  MEMBERSHIP = 'MEMBERSHIP',
  SECURITY = 'SECURITY',
  ACCOUNT = 'ACCOUNT',
  SYSTEM = 'SYSTEM',
}

export interface NotificationItem {
  id: string;
  type: NotificationType;
  category: NotificationCategory;
  priority: NotificationPriority;
  title: string;
  message: string;
  payload: any;
  sentAt: string;
  readAt?: string | null;
  isRead: boolean;
  requiresAction?: boolean;
  actionType?: string;
  actionData?: any;
  expiresAt?: string | null;
  source?: 'server' | 'local'; // Track notification source
}

export interface NotificationState {
  notifications: NotificationItem[];
  unreadCount: number;
  urgentCount: number;
  lastFetchedAt: string | null;
  subscribedLists: string[]; // Shopping list IDs to subscribe to
  subscribedPantries: string[]; // Pantry IDs to subscribe to

  // Actions
  addNotification: (notification: Omit<NotificationItem, 'isRead'>) => void;
  addMultipleNotifications: (
    notifications: Omit<NotificationItem, 'isRead'>[],
  ) => void;
  syncNotificationsFromServer: (
    serverNotifications: NotificationItem[],
  ) => void;
  markAsRead: (notificationId: string) => void;
  markAsReadWithSync: (
    notificationId: string,
    callback?: (success: boolean) => void,
  ) => void;
  markAllAsRead: () => void;
  removeNotification: (notificationId: string) => void;
  clearAll: () => void;
  clearExpired: () => void;
  updateUnreadCount: () => void;
  setLastFetchedAt: (timestamp: string) => void;
  addSubscribedList: (listId: string) => void;
  removeSubscribedList: (listId: string) => void;
  addSubscribedPantry: (pantryId: string) => void;
  removeSubscribedPantry: (pantryId: string) => void;
  cleanupOrphanedSubscriptions: () => void;
  // Selectors
  getUnreadNotifications: () => NotificationItem[];
  getNotificationsByCategory: (
    category: NotificationCategory,
  ) => NotificationItem[];
  getUrgentNotifications: () => NotificationItem[];
  getActionableNotifications: () => NotificationItem[];

  // Reset
  resetNotifications: () => void;
}

const initialNotificationState: Omit<
  NotificationState,
  | 'addNotification'
  | 'addMultipleNotifications'
  | 'syncNotificationsFromServer'
  | 'markAsRead'
  | 'markAsReadWithSync'
  | 'markAllAsRead'
  | 'removeNotification'
  | 'clearAll'
  | 'clearExpired'
  | 'updateUnreadCount'
  | 'setLastFetchedAt'
  | 'addSubscribedList'
  | 'removeSubscribedList'
  | 'addSubscribedPantry'
  | 'removeSubscribedPantry'
  | 'getUnreadNotifications'
  | 'getNotificationsByCategory'
  | 'getUrgentNotifications'
  | 'getActionableNotifications'
  | 'resetNotifications'
  | 'cleanupOrphanedSubscriptions'
> = {
  notifications: [],
  unreadCount: 0,
  urgentCount: 0,
  lastFetchedAt: null,
  subscribedLists: [],
  subscribedPantries: [],
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
      notification.category === NotificationCategory.PANTRY &&
      !state.selectedPantryId
    ) {
      return;
    }

    // Safety check: Don't add home notifications without home (except invitations)
    if (
      notification.category === NotificationCategory.MEMBERSHIP &&
      !state.selectedHomeId &&
      !isInvitation
    ) {
      return;
    }

    // Safety check: Don't add shopping list notifications without list
    if (
      notification.category === NotificationCategory.SHOPPING_LIST &&
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
      const newNotification = {
        ...notification,
        isRead: false,
        source: notification.source || ('local' as const), // Mark as local by default
        // Ensure sentAt is always a valid ISO string
        sentAt:
          safeParseDate(notification.sentAt)?.toISOString() ||
          new Date().toISOString(),
      };
      state.notifications.unshift(newNotification);
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
        notification.category === NotificationCategory.PANTRY &&
        !state.selectedPantryId
      ) {
        return false;
      }
      if (
        notification.category === NotificationCategory.MEMBERSHIP &&
        !state.selectedHomeId
      ) {
        return false;
      }
      if (
        notification.category === NotificationCategory.SHOPPING_LIST &&
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
          source: n.source || ('local' as const), // Mark as local by default
          // Ensure sentAt is always a valid ISO string
          sentAt:
            safeParseDate(n.sentAt)?.toISOString() || new Date().toISOString(),
        }));

      if (newNotifications.length > 0) {
        state.notifications.unshift(...newNotifications);
      }

      state.unreadCount = state.notifications.filter(n => !n.isRead).length;
      state.urgentCount = state.notifications.filter(
        n => !n.isRead && n.priority === NotificationPriority.URGENT,
      ).length;
    });
  },

  // Sync notifications from server - replaces existing with server truth while preserving newer local ones
  syncNotificationsFromServer: serverNotifications => {
    const state = get();

    if (!state.user?.emailVerified) {
      return;
    }

    set(state => {
      // Keep track of local notifications that are newer than last fetch (real-time additions)
      const lastFetch = state.lastFetchedAt
        ? new Date(state.lastFetchedAt)
        : new Date(0);
      const localRealtimeNotifications = state.notifications.filter(n => {
        const notifDate = new Date(n.sentAt);
        return (
          notifDate > lastFetch &&
          !serverNotifications.find(sn => sn.id === n.id)
        );
      });

      // Merge server notifications with preserved local ones
      const allNotifications = [
        ...serverNotifications,
        ...localRealtimeNotifications,
      ];

      // Sort by sentAt (newest first)
      allNotifications.sort(
        (a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime(),
      );

      // Update state
      state.notifications = allNotifications;
      state.unreadCount = allNotifications.filter(n => !n.isRead).length;
      state.urgentCount = allNotifications.filter(
        n => !n.isRead && n.priority === NotificationPriority.URGENT,
      ).length;
      state.lastFetchedAt = new Date().toISOString();
    });
  },

  // Enhanced subscription management with validation
  addSubscribedList: listId => {
    const state = get();
    if (!state.selectedShoppingListId) {
      return;
    }

    set(state => {
      if (!state.subscribedLists.includes(listId)) {
        state.subscribedLists.push(listId);
      }
    });
  },

  addSubscribedPantry: pantryId => {
    const state = get();
    if (!state.selectedPantryId) {
      return;
    }

    set(state => {
      if (!state.subscribedPantries.includes(pantryId)) {
        state.subscribedPantries.push(pantryId);
      }
    });
  },

  // Clean up subscriptions when entities are removed
  cleanupOrphanedSubscriptions: () => {
    const state = get();

    set(draft => {
      // Remove subscriptions for entities that no longer exist
      if (!state.selectedPantryId) {
        draft.subscribedPantries = [];
      }

      if (!state.selectedShoppingListId) {
        draft.subscribedLists = [];
      }

      // Remove notifications for entities that no longer exist (but always keep invitations)
      draft.notifications = draft.notifications.filter(notification => {
        // Always keep invitations - user needs them to join homes/lists
        if (isInvitationNotification(notification.type)) {
          return true;
        }

        if (
          notification.category === NotificationCategory.PANTRY &&
          !state.selectedPantryId
        ) {
          return false;
        }
        if (
          notification.category === NotificationCategory.SHOPPING_LIST &&
          !state.selectedShoppingListId
        ) {
          return false;
        }
        if (
          notification.category === NotificationCategory.MEMBERSHIP &&
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

  markAsReadWithSync: (notificationId, callback) => {
    // First mark as read locally for immediate UI feedback
    get().markAsRead(notificationId);

    // TODO: Add server sync call here when GraphQL mutation is available
    // This would call a mutation like `markNotificationAsRead(id: $id)`
    // For now, we'll just mark locally and rely on periodic sync
    if (callback) {
      callback(true); // Assume success for now
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

  clearExpired: () => {
    set(state => {
      const now = new Date().toISOString();
      state.notifications = state.notifications.filter(n => {
        if (!n.expiresAt) return true;
        return n.expiresAt > now;
      });
      state.unreadCount = state.notifications.filter(n => !n.isRead).length;
      state.urgentCount = state.notifications.filter(
        n => !n.isRead && n.priority === NotificationPriority.URGENT,
      ).length;
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
    set({lastFetchedAt: timestamp});
  },

  removeSubscribedList: listId => {
    set(state => {
      state.subscribedLists = state.subscribedLists.filter(id => id !== listId);
    });
  },

  removeSubscribedPantry: pantryId => {
    set(state => {
      state.subscribedPantries = state.subscribedPantries.filter(
        id => id !== pantryId,
      );
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

  getActionableNotifications: () => {
    return get().notifications.filter(n => n.requiresAction && !n.isRead);
  },

  resetNotifications: () => {
    set(initialNotificationState);
  },
});
