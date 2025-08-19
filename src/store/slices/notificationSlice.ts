import {StateCreator} from 'zustand';
import {RootState} from '../index';
import {NotificationType} from '#/graphql/generated';

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
  markAsRead: (notificationId: string) => void;
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
  | 'markAsRead'
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
      console.log('Skipping notification - user not verified');
      return;
    }

    // Safety check: Don't add pantry notifications without pantry
    if (
      notification.category === NotificationCategory.PANTRY &&
      !state.selectedPantryId
    ) {
      console.log('Skipping pantry notification - no pantry selected');
      return;
    }

    // Safety check: Don't add home notifications without home
    if (
      notification.category === NotificationCategory.MEMBERSHIP &&
      !state.selectedHomeId
    ) {
      console.log('Skipping home notification - no home selected');
      return;
    }

    // Safety check: Don't add shopping list notifications without list
    if (
      notification.category === NotificationCategory.SHOPPING_LIST &&
      !state.selectedShoppingListId
    ) {
      console.log('Skipping shopping list notification - no list selected');
      return;
    }

    set(state => {
      const newNotification = {...notification, isRead: false};
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
      console.log('Skipping all notifications - user not verified');
      return;
    }

    // Filter notifications based on current state
    const validNotifications = notifications.filter(notification => {
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
      console.log('No valid notifications to add');
      return;
    }

    console.log(
      `Adding ${validNotifications.length} of ${notifications.length} notifications`,
    );

    set(state => {
      const newNotifications = validNotifications.map(n => ({
        ...n,
        isRead: false,
      }));
      state.notifications.unshift(...newNotifications);
      state.unreadCount = state.notifications.filter(n => !n.isRead).length;
      state.urgentCount = state.notifications.filter(
        n => !n.isRead && n.priority === NotificationPriority.URGENT,
      ).length;
    });
  },

  // Enhanced subscription management with validation
  addSubscribedList: listId => {
    const state = get();
    if (!state.selectedShoppingListId) {
      console.log('Not adding list subscription - no shopping list selected');
      return;
    }

    set(state => {
      if (!state.subscribedLists.includes(listId)) {
        state.subscribedLists.push(listId);
        console.log('Added shopping list subscription:', listId);
      }
    });
  },

  addSubscribedPantry: pantryId => {
    const state = get();
    if (!state.selectedPantryId) {
      console.log('Not adding pantry subscription - no pantry selected');
      return;
    }

    set(state => {
      if (!state.subscribedPantries.includes(pantryId)) {
        state.subscribedPantries.push(pantryId);
        console.log('Added pantry subscription:', pantryId);
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

      // Remove notifications for entities that no longer exist
      draft.notifications = draft.notifications.filter(notification => {
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
