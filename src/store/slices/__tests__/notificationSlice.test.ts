/**
 * The notification slice holds the expiration-enrichment buffer and nothing
 * else.
 *
 * This file used to be 678 lines covering `addNotification`,
 * `markAllAsRead`, `updateUnreadCount`, `setServerNotificationCounts`, the
 * category selectors and the eviction policy — a whole feed implementation
 * duplicating the one in the Apollo cache. All of that moved to
 * `notificationCacheWrites.ts`, which is tested against a real cache. What
 * remains is the only part that could not: two subscriptions deliver a
 * notification and its expiration details independently, and either can arrive
 * first, so the details wait here until their notification shows up.
 */
import { createTestStore } from '#/test-utils/createTestStore';
import type { ExpirationLinkData } from '../notificationSlice';

// Mock authSlice dependencies
jest.mock('../../../apollo/links/tokenScheduler');
jest.mock('../../../apollo/links/refreshToken');

const enrichment = (
  overrides: Partial<ExpirationLinkData> = {},
): ExpirationLinkData => ({
  expirationNotificationId: 'exp-1',
  daysUntilExpiry: 3,
  pantryItemName: 'Milk',
  pantryItemImageUrl: null,
  ...overrides,
});

describe('notificationSlice', () => {
  describe('linkExpirationData', () => {
    it('buffers enrichment against the notification it belongs to', () => {
      const store = createTestStore();

      store.getState().linkExpirationData('notif-1', enrichment());

      expect(store.getState().pendingExpirationLinks['notif-1']).toEqual(
        enrichment(),
      );
    });

    // The whole reason this buffer exists: the two events are independent, so
    // enrichment can land for a notification the device has not seen yet.
    it('keeps enrichment for a notification that has not arrived', () => {
      const store = createTestStore();

      store.getState().linkExpirationData('not-yet-seen', enrichment());

      expect(
        store.getState().pendingExpirationLinks['not-yet-seen'],
      ).toBeDefined();
    });

    it('merges a later event over an earlier one rather than replacing it', () => {
      const store = createTestStore();

      store.getState().setExpirationAction('notif-1', 'CONSUMED');
      store.getState().linkExpirationData('notif-1', enrichment());

      const linked = store.getState().pendingExpirationLinks['notif-1'];
      expect(linked.expirationAction).toBe('CONSUMED');
      expect(linked.pantryItemName).toBe('Milk');
    });
  });

  describe('setExpirationAction', () => {
    it('records the action on existing enrichment', () => {
      const store = createTestStore();
      store.getState().linkExpirationData('notif-1', enrichment());

      store.getState().setExpirationAction('notif-1', 'WASTED');

      expect(
        store.getState().pendingExpirationLinks['notif-1'].expirationAction,
      ).toBe('WASTED');
    });

    // The action can be taken before the enrichment event lands — a rollback
    // writes an empty action, and it must not be dropped on the floor.
    it('creates an entry when no enrichment has arrived yet', () => {
      const store = createTestStore();

      store.getState().setExpirationAction('notif-2', 'CONSUMED');

      // No `expirationNotificationId`: the generic id is not the expiration
      // row's, and a truthy one reads as "already linked" downstream.
      expect(store.getState().pendingExpirationLinks['notif-2']).toEqual({
        expirationAction: 'CONSUMED',
      });
    });
  });

  describe('clearExpirationLink', () => {
    it('drops one entry and leaves the rest', () => {
      const store = createTestStore();
      store.getState().linkExpirationData('a', enrichment());
      store.getState().linkExpirationData('b', enrichment());

      store.getState().clearExpirationLink('a');

      expect(store.getState().pendingExpirationLinks).toEqual({
        b: enrichment(),
      });
    });
  });

  describe('resetNotifications', () => {
    it('empties the buffer', () => {
      const store = createTestStore();
      store.getState().linkExpirationData('notif-1', enrichment());

      store.getState().resetNotifications();

      expect(store.getState().pendingExpirationLinks).toEqual({});
    });
  });
});
