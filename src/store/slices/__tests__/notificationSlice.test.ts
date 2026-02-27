import { createTestStore } from '#/test-utils/createTestStore';
import {
  NotificationCategory,
  NotificationPriority,
  NotificationItem,
} from '../notificationSlice';
import { NotificationType } from '#/graphql/generated';

// Mock authSlice dependencies
jest.mock('../../../apollo/links/tokenScheduler', () => ({
  scheduleTokenRefresh: jest.fn(),
  cancelTokenRefresh: jest.fn(),
}));
jest.mock('../../../apollo/links/refreshToken', () => ({
  proactiveTokenRefresh: jest.fn(),
}));

const testUser = {
  id: 'user-1',
  email: 'test@example.com',
  emailVerified: true,
  onBoarded: true,
};

function createNotification(
  overrides: Partial<Omit<NotificationItem, 'isRead'>> = {},
): Omit<NotificationItem, 'isRead'> {
  return {
    id: `notif-${Date.now()}-${Math.random()}`,
    type: NotificationType.NewItemAdded,
    category: NotificationCategory.SYSTEM,
    priority: NotificationPriority.MEDIUM,
    title: 'Test',
    message: 'Test message',
    payload: {},
    sentAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('notificationSlice', () => {
  function createAuthenticatedStore(overrides?: any) {
    const store = createTestStore(overrides);
    store.getState().setAuth(testUser as any, 'access', 'refresh');
    return store;
  }

  describe('addNotification', () => {
    it('adds a notification', () => {
      const store = createAuthenticatedStore();
      const notif = createNotification();
      store.getState().addNotification(notif);
      expect(store.getState().notifications).toHaveLength(1);
      expect(store.getState().unreadCount).toBe(1);
    });

    it('does not add if user email is not verified', () => {
      const store = createTestStore();
      store.getState().setAuth(
        { ...testUser, emailVerified: false } as any,
        'a',
        'r',
      );
      store.getState().addNotification(createNotification());
      expect(store.getState().notifications).toHaveLength(0);
    });

    it('prevents duplicates', () => {
      const store = createAuthenticatedStore();
      const notif = createNotification({ id: 'dup-1' });
      store.getState().addNotification(notif);
      store.getState().addNotification(notif);
      expect(store.getState().notifications).toHaveLength(1);
    });

    it('rejects pantry notifications without selectedPantryId', () => {
      const store = createAuthenticatedStore();
      store.getState().addNotification(
        createNotification({ category: NotificationCategory.PANTRY }),
      );
      expect(store.getState().notifications).toHaveLength(0);
    });

    it('allows pantry notifications with selectedPantryId', () => {
      const store = createAuthenticatedStore();
      store.getState().setSelectedPantryId('pantry-1');
      store.getState().addNotification(
        createNotification({ category: NotificationCategory.PANTRY }),
      );
      expect(store.getState().notifications).toHaveLength(1);
    });

    it('always allows invitation notifications even without context', () => {
      const store = createAuthenticatedStore();
      store.getState().addNotification(
        createNotification({
          type: NotificationType.HomeInvitation,
          category: NotificationCategory.MEMBERSHIP,
        }),
      );
      expect(store.getState().notifications).toHaveLength(1);
    });

    it('tracks urgent count', () => {
      const store = createAuthenticatedStore();
      store.getState().addNotification(
        createNotification({ priority: NotificationPriority.URGENT }),
      );
      expect(store.getState().urgentCount).toBe(1);
    });
  });

  describe('markAsRead', () => {
    it('marks notification as read', () => {
      const store = createAuthenticatedStore();
      const notif = createNotification({ id: 'read-1' });
      store.getState().addNotification(notif);
      store.getState().markAsRead('read-1');
      expect(store.getState().notifications[0].isRead).toBe(true);
      expect(store.getState().unreadCount).toBe(0);
    });

    it('decrements urgent count for urgent notifications', () => {
      const store = createAuthenticatedStore();
      store.getState().addNotification(
        createNotification({ id: 'u1', priority: NotificationPriority.URGENT }),
      );
      store.getState().markAsRead('u1');
      expect(store.getState().urgentCount).toBe(0);
    });

    it('does nothing for already-read notification', () => {
      const store = createAuthenticatedStore();
      store.getState().addNotification(createNotification({ id: 'r1' }));
      store.getState().markAsRead('r1');
      store.getState().markAsRead('r1'); // Second call
      expect(store.getState().unreadCount).toBe(0);
    });
  });

  describe('markAllAsRead', () => {
    it('marks all as read and resets counts', () => {
      const store = createAuthenticatedStore();
      store.getState().addNotification(createNotification({ id: 'n1' }));
      store.getState().addNotification(createNotification({ id: 'n2' }));
      store.getState().markAllAsRead();
      expect(store.getState().unreadCount).toBe(0);
      expect(store.getState().urgentCount).toBe(0);
      store.getState().notifications.forEach(n => {
        expect(n.isRead).toBe(true);
        expect(n.readAt).toBeTruthy();
      });
    });
  });

  describe('removeNotification', () => {
    it('removes notification and updates counts', () => {
      const store = createAuthenticatedStore();
      store.getState().addNotification(createNotification({ id: 'rm-1' }));
      store.getState().removeNotification('rm-1');
      expect(store.getState().notifications).toHaveLength(0);
      expect(store.getState().unreadCount).toBe(0);
    });
  });

  describe('clearAll', () => {
    it('clears all notifications', () => {
      const store = createAuthenticatedStore();
      store.getState().addNotification(createNotification({ id: 'c1' }));
      store.getState().addNotification(createNotification({ id: 'c2' }));
      store.getState().clearAll();
      expect(store.getState().notifications).toHaveLength(0);
      expect(store.getState().unreadCount).toBe(0);
    });
  });

  describe('clearExpired', () => {
    it('removes expired notifications', () => {
      const store = createAuthenticatedStore();
      store.getState().addNotification(
        createNotification({
          id: 'exp-1',
          expiresAt: new Date(Date.now() - 1000).toISOString(),
        }),
      );
      store.getState().addNotification(
        createNotification({ id: 'active-1' }),
      );
      store.getState().clearExpired();
      expect(store.getState().notifications).toHaveLength(1);
      expect(store.getState().notifications[0].id).toBe('active-1');
    });
  });

  describe('subscription management', () => {
    it('adds subscribed list', () => {
      const store = createAuthenticatedStore();
      store.getState().setSelectedShoppingListId('list-1');
      store.getState().addSubscribedList('list-1');
      expect(store.getState().subscribedLists).toContain('list-1');
    });

    it('does not add duplicate list subscription', () => {
      const store = createAuthenticatedStore();
      store.getState().setSelectedShoppingListId('list-1');
      store.getState().addSubscribedList('list-1');
      store.getState().addSubscribedList('list-1');
      expect(store.getState().subscribedLists).toHaveLength(1);
    });

    it('removes subscribed list', () => {
      const store = createAuthenticatedStore();
      store.getState().setSelectedShoppingListId('list-1');
      store.getState().addSubscribedList('list-1');
      store.getState().removeSubscribedList('list-1');
      expect(store.getState().subscribedLists).toHaveLength(0);
    });

    it('adds subscribed pantry', () => {
      const store = createAuthenticatedStore();
      store.getState().setSelectedPantryId('pantry-1');
      store.getState().addSubscribedPantry('pantry-1');
      expect(store.getState().subscribedPantries).toContain('pantry-1');
    });

    it('removes subscribed pantry', () => {
      const store = createAuthenticatedStore();
      store.getState().setSelectedPantryId('pantry-1');
      store.getState().addSubscribedPantry('pantry-1');
      store.getState().removeSubscribedPantry('pantry-1');
      expect(store.getState().subscribedPantries).toHaveLength(0);
    });
  });

  describe('selectors', () => {
    it('getUnreadNotifications returns only unread', () => {
      const store = createAuthenticatedStore();
      store.getState().addNotification(createNotification({ id: 's1' }));
      store.getState().addNotification(createNotification({ id: 's2' }));
      store.getState().markAsRead('s1');
      expect(store.getState().getUnreadNotifications()).toHaveLength(1);
    });

    it('getNotificationsByCategory filters correctly', () => {
      const store = createAuthenticatedStore();
      store.getState().setSelectedPantryId('p1');
      store.getState().addNotification(
        createNotification({ id: 'cat1', category: NotificationCategory.PANTRY }),
      );
      store.getState().addNotification(
        createNotification({ id: 'cat2', category: NotificationCategory.SYSTEM }),
      );
      expect(
        store.getState().getNotificationsByCategory(NotificationCategory.PANTRY),
      ).toHaveLength(1);
    });

    it('getUrgentNotifications returns only unread urgent', () => {
      const store = createAuthenticatedStore();
      store.getState().addNotification(
        createNotification({ id: 'urg1', priority: NotificationPriority.URGENT }),
      );
      store.getState().addNotification(
        createNotification({ id: 'urg2', priority: NotificationPriority.LOW }),
      );
      expect(store.getState().getUrgentNotifications()).toHaveLength(1);
    });

    it('getActionableNotifications returns actionable unread', () => {
      const store = createAuthenticatedStore();
      store.getState().addNotification(
        createNotification({ id: 'act1', requiresAction: true }),
      );
      store.getState().addNotification(
        createNotification({ id: 'act2', requiresAction: false }),
      );
      expect(store.getState().getActionableNotifications()).toHaveLength(1);
    });
  });

  describe('resetNotifications', () => {
    it('resets to initial state', () => {
      const store = createAuthenticatedStore();
      store.getState().addNotification(createNotification({ id: 'rn1' }));
      store.getState().resetNotifications();
      expect(store.getState().notifications).toHaveLength(0);
      expect(store.getState().unreadCount).toBe(0);
      expect(store.getState().lastFetchedAt).toBeNull();
    });
  });
});
