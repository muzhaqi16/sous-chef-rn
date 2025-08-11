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

  addNotification: notification => {
    set(state => {
      const newNotification = {...notification, isRead: false};
      state.notifications.unshift(newNotification);
      state.unreadCount = state.notifications.filter(n => !n.isRead).length;
      state.urgentCount = state.notifications.filter(
        n => !n.isRead && n.priority === NotificationPriority.URGENT,
      ).length;
    });
  },

  addMultipleNotifications: notifications => {
    set(state => {
      const newNotifications = notifications.map(n => ({...n, isRead: false}));
      state.notifications.unshift(...newNotifications);
      state.unreadCount = state.notifications.filter(n => !n.isRead).length;
      state.urgentCount = state.notifications.filter(
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

  addSubscribedList: listId => {
    set(state => {
      if (!state.subscribedLists.includes(listId)) {
        state.subscribedLists.push(listId);
      }
    });
  },

  removeSubscribedList: listId => {
    set(state => {
      state.subscribedLists = state.subscribedLists.filter(id => id !== listId);
    });
  },

  addSubscribedPantry: pantryId => {
    set(state => {
      if (!state.subscribedPantries.includes(pantryId)) {
        state.subscribedPantries.push(pantryId);
      }
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
