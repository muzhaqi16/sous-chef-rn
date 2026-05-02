import { createTestStore } from '#/test-utils/createTestStore';
import {
  NotificationCategory,
  NotificationType,
} from '../../../graphql/generated/schemaTypes';
import { NotificationPriority, NotificationItem } from '../notificationSlice';

// Mock authSlice dependencies
jest.mock('../../../apollo/links/tokenScheduler');
jest.mock('../../../apollo/links/refreshToken');

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
    category: NotificationCategory.System,
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
      store
        .getState()
        .setAuth({ ...testUser, emailVerified: false } as any, 'a', 'r');
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
      store
        .getState()
        .addNotification(
          createNotification({ category: NotificationCategory.Pantry }),
        );
      expect(store.getState().notifications).toHaveLength(0);
    });

    it('allows pantry notifications with selectedPantryId', () => {
      const store = createAuthenticatedStore();
      store.getState().setSelectedPantryId('pantry-1');
      store
        .getState()
        .addNotification(
          createNotification({ category: NotificationCategory.Pantry }),
        );
      expect(store.getState().notifications).toHaveLength(1);
    });

    it('always allows invitation notifications even without context', () => {
      const store = createAuthenticatedStore();
      store.getState().addNotification(
        createNotification({
          type: NotificationType.HomeInvitation,
          category: NotificationCategory.Home,
        }),
      );
      expect(store.getState().notifications).toHaveLength(1);
    });

    it('tracks urgent count', () => {
      const store = createAuthenticatedStore();
      store
        .getState()
        .addNotification(
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
        createNotification({
          id: 'u1',
          priority: NotificationPriority.URGENT,
        }),
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
        createNotification({
          id: 'cat1',
          category: NotificationCategory.Pantry,
        }),
      );
      store.getState().addNotification(
        createNotification({
          id: 'cat2',
          category: NotificationCategory.System,
        }),
      );
      expect(
        store
          .getState()
          .getNotificationsByCategory(NotificationCategory.Pantry),
      ).toHaveLength(1);
    });

    it('getUrgentNotifications returns only unread urgent', () => {
      const store = createAuthenticatedStore();
      store.getState().addNotification(
        createNotification({
          id: 'urg1',
          priority: NotificationPriority.URGENT,
        }),
      );
      store.getState().addNotification(
        createNotification({
          id: 'urg2',
          priority: NotificationPriority.LOW,
        }),
      );
      expect(store.getState().getUrgentNotifications()).toHaveLength(1);
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

  // =========================================================================
  // Additional branch coverage tests
  // =========================================================================
  describe('addNotification - additional branches', () => {
    it('rejects shopping list notifications without selectedShoppingListId', () => {
      const store = createAuthenticatedStore();
      store
        .getState()
        .addNotification(
          createNotification({ category: NotificationCategory.Shopping }),
        );
      expect(store.getState().notifications).toHaveLength(0);
    });

    it('allows shopping list notifications with selectedShoppingListId', () => {
      const store = createAuthenticatedStore();
      store.getState().setSelectedShoppingListId('list-1');
      store
        .getState()
        .addNotification(
          createNotification({ category: NotificationCategory.Shopping }),
        );
      expect(store.getState().notifications).toHaveLength(1);
    });

    it('rejects membership notifications without selectedHomeId (non-invitation)', () => {
      const store = createAuthenticatedStore();
      store.getState().addNotification(
        createNotification({
          type: NotificationType.HomeJoined,
          category: NotificationCategory.Home,
        }),
      );
      expect(store.getState().notifications).toHaveLength(0);
    });

    it('allows membership notifications with selectedHomeId', () => {
      const store = createAuthenticatedStore();
      store.getState().setSelectedHomeId('home-1');
      store.getState().addNotification(
        createNotification({
          type: NotificationType.HomeJoined,
          category: NotificationCategory.Home,
        }),
      );
      expect(store.getState().notifications).toHaveLength(1);
    });

    it('allows MembershipInvite even without selectedHomeId', () => {
      const store = createAuthenticatedStore();
      store.getState().addNotification(
        createNotification({
          type: NotificationType.MembershipInvite,
          category: NotificationCategory.Home,
        }),
      );
      expect(store.getState().notifications).toHaveLength(1);
    });

    it('allows CollaborationInvite even without selectedShoppingListId', () => {
      const store = createAuthenticatedStore();
      store.getState().addNotification(
        createNotification({
          type: NotificationType.CollaborationInvite,
          category: NotificationCategory.Home,
        }),
      );
      expect(store.getState().notifications).toHaveLength(1);
    });

    it('handles invalid sentAt by using current date', () => {
      const store = createAuthenticatedStore();
      store
        .getState()
        .addNotification(
          createNotification({ id: 'invalid-date-1', sentAt: 'not-a-date' }),
        );
      const notif = store.getState().notifications[0];
      expect(notif).toBeDefined();
      // sentAt should be a valid ISO string
      expect(new Date(notif.sentAt).getTime()).not.toBeNaN();
    });
  });

  describe('addMultipleNotifications - additional branches', () => {
    it('does not add if user email is not verified', () => {
      const store = createTestStore();
      store
        .getState()
        .setAuth({ ...testUser, emailVerified: false } as any, 'a', 'r');
      store.getState().addMultipleNotifications([createNotification()]);
      expect(store.getState().notifications).toHaveLength(0);
    });

    it('filters out pantry notifications when no pantry selected', () => {
      const store = createAuthenticatedStore();
      store.getState().addMultipleNotifications([
        createNotification({
          id: 'p1',
          category: NotificationCategory.Pantry,
        }),
        createNotification({
          id: 's1',
          category: NotificationCategory.System,
        }),
      ]);
      expect(store.getState().notifications).toHaveLength(1);
      expect(store.getState().notifications[0].id).toBe('s1');
    });

    it('filters out membership notifications when no home selected', () => {
      const store = createAuthenticatedStore();
      store.getState().addMultipleNotifications([
        createNotification({
          id: 'm1',
          type: NotificationType.HomeJoined,
          category: NotificationCategory.Home,
        }),
        createNotification({ id: 's1', category: NotificationCategory.System }),
      ]);
      expect(store.getState().notifications).toHaveLength(1);
    });

    it('filters out shopping list notifications when no list selected', () => {
      const store = createAuthenticatedStore();
      store.getState().addMultipleNotifications([
        createNotification({
          id: 'sl1',
          category: NotificationCategory.Shopping,
        }),
        createNotification({
          id: 's1',
          category: NotificationCategory.System,
        }),
      ]);
      expect(store.getState().notifications).toHaveLength(1);
    });

    it('keeps invitation notifications even without context', () => {
      const store = createAuthenticatedStore();
      store.getState().addMultipleNotifications([
        createNotification({
          id: 'inv1',
          type: NotificationType.HomeInvitation,
          category: NotificationCategory.Home,
        }),
      ]);
      expect(store.getState().notifications).toHaveLength(1);
    });

    it('skips when all notifications are filtered', () => {
      const store = createAuthenticatedStore();
      store.getState().addMultipleNotifications([
        createNotification({
          id: 'p1',
          category: NotificationCategory.Pantry,
        }),
      ]);
      expect(store.getState().notifications).toHaveLength(0);
    });

    it('prevents duplicates in batch add', () => {
      const store = createAuthenticatedStore();
      store.getState().addNotification(createNotification({ id: 'existing' }));
      store
        .getState()
        .addMultipleNotifications([
          createNotification({ id: 'existing' }),
          createNotification({ id: 'new-one' }),
        ]);
      expect(store.getState().notifications).toHaveLength(2);
    });

    it('tracks urgent count correctly in batch', () => {
      const store = createAuthenticatedStore();
      store.getState().addMultipleNotifications([
        createNotification({
          id: 'u1',
          priority: NotificationPriority.URGENT,
        }),
        createNotification({
          id: 'u2',
          priority: NotificationPriority.URGENT,
        }),
        createNotification({ id: 'n1', priority: NotificationPriority.LOW }),
      ]);
      expect(store.getState().urgentCount).toBe(2);
      expect(store.getState().unreadCount).toBe(3);
    });
  });

  describe('markAsReadWithSync', () => {
    it('calls callback with true', () => {
      const store = createAuthenticatedStore();
      store.getState().addNotification(createNotification({ id: 'sync-1' }));
      const cb = jest.fn();
      store.getState().markAsReadWithSync('sync-1', cb);
      expect(cb).toHaveBeenCalledWith(true);
      expect(store.getState().notifications[0].isRead).toBe(true);
    });

    it('works without callback', () => {
      const store = createAuthenticatedStore();
      store.getState().addNotification(createNotification({ id: 'sync-2' }));
      store.getState().markAsReadWithSync('sync-2');
      expect(store.getState().notifications[0].isRead).toBe(true);
    });
  });

  describe('removeNotification - additional branches', () => {
    it('removes an unread urgent notification and updates counts', () => {
      const store = createAuthenticatedStore();
      store.getState().addNotification(
        createNotification({
          id: 'urg-rm',
          priority: NotificationPriority.URGENT,
        }),
      );
      expect(store.getState().urgentCount).toBe(1);
      store.getState().removeNotification('urg-rm');
      expect(store.getState().urgentCount).toBe(0);
      expect(store.getState().unreadCount).toBe(0);
    });

    it('does not decrement counts when removing read notification', () => {
      const store = createAuthenticatedStore();
      store.getState().addNotification(createNotification({ id: 'read-rm' }));
      store.getState().markAsRead('read-rm');
      store.getState().removeNotification('read-rm');
      expect(store.getState().unreadCount).toBe(0);
    });

    it('does nothing for non-existent notification', () => {
      const store = createAuthenticatedStore();
      store.getState().addNotification(createNotification({ id: 'exist' }));
      store.getState().removeNotification('does-not-exist');
      expect(store.getState().notifications).toHaveLength(1);
    });
  });

  describe('updateUnreadCount', () => {
    it('recalculates unread and urgent counts', () => {
      const store = createAuthenticatedStore();
      store.getState().addNotification(
        createNotification({
          id: 'count-1',
          priority: NotificationPriority.URGENT,
        }),
      );
      store.getState().addNotification(
        createNotification({
          id: 'count-2',
          priority: NotificationPriority.LOW,
        }),
      );
      store.getState().updateUnreadCount();
      expect(store.getState().unreadCount).toBe(2);
      expect(store.getState().urgentCount).toBe(1);
    });
  });

  describe('setLastFetchedAt', () => {
    it('sets the lastFetchedAt timestamp', () => {
      const store = createAuthenticatedStore();
      const ts = '2024-01-01T00:00:00.000Z';
      store.getState().setLastFetchedAt(ts);
      expect(store.getState().lastFetchedAt).toBe(ts);
    });
  });

  describe('cleanupOrphanedSubscriptions', () => {
    it('removes pantry notifications when no pantry selected', () => {
      const store = createAuthenticatedStore();
      store.getState().setSelectedPantryId('p1');
      store.getState().addNotification(
        createNotification({
          id: 'pn1',
          category: NotificationCategory.Pantry,
        }),
      );
      store.getState().setSelectedPantryId(null as any);
      store.getState().cleanupOrphanedSubscriptions();
      expect(store.getState().notifications).toHaveLength(0);
    });

    it('removes shopping list notifications when no list selected', () => {
      const store = createAuthenticatedStore();
      store.getState().setSelectedShoppingListId('l1');
      store.getState().addNotification(
        createNotification({
          id: 'sln1',
          category: NotificationCategory.Shopping,
        }),
      );
      store.getState().setSelectedShoppingListId(null as any);
      store.getState().cleanupOrphanedSubscriptions();
      expect(store.getState().notifications).toHaveLength(0);
    });

    it('removes membership notifications when no home selected', () => {
      const store = createAuthenticatedStore();
      store.getState().setSelectedHomeId('h1');
      store.getState().addNotification(
        createNotification({
          id: 'mn1',
          type: NotificationType.HomeJoined,
          category: NotificationCategory.Home,
        }),
      );
      store.getState().setSelectedHomeId(null as any);
      store.getState().cleanupOrphanedSubscriptions();
      expect(store.getState().notifications).toHaveLength(0);
    });

    it('keeps invitation notifications during cleanup', () => {
      const store = createAuthenticatedStore();
      store.getState().addNotification(
        createNotification({
          id: 'inv-keep',
          type: NotificationType.HomeInvitation,
          category: NotificationCategory.Home,
        }),
      );
      store.getState().cleanupOrphanedSubscriptions();
      expect(store.getState().notifications).toHaveLength(1);
    });

    it('recalculates counts after cleanup', () => {
      const store = createAuthenticatedStore();
      store.getState().setSelectedPantryId('p1');
      store.getState().addNotification(
        createNotification({
          id: 'urg-cleanup',
          category: NotificationCategory.Pantry,
          priority: NotificationPriority.URGENT,
        }),
      );
      expect(store.getState().urgentCount).toBe(1);
      store.getState().setSelectedPantryId(null as any);
      store.getState().cleanupOrphanedSubscriptions();
      expect(store.getState().urgentCount).toBe(0);
      expect(store.getState().unreadCount).toBe(0);
    });
  });

  describe('markAsRead - non-existent notification', () => {
    it('does nothing for non-existent notification id', () => {
      const store = createAuthenticatedStore();
      store.getState().addNotification(createNotification({ id: 'exists' }));
      store.getState().markAsRead('does-not-exist');
      expect(store.getState().unreadCount).toBe(1);
    });
  });
});
