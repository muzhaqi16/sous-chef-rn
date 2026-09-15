import { NotificationType } from '#/graphql/generated/schemaTypes';
import {
  getNotificationCopy,
  getNotificationIcon,
} from '#features/notifications/utils/notificationHelpers';
import { getI18n } from '#/i18n/config';
import type { NotificationPayload } from '#features/notifications/types';

// Real i18n instance (auto-initialized on config import) so the test exercises
// the actual locale keys + interpolation rather than a stubbed translator.
const t = getI18n().t;

const makeExpiry = (payload: NotificationPayload) => ({
  type: NotificationType.ExpiryReminder,
  payload,
});

const messageOf = (type: NotificationType, payload: NotificationPayload) =>
  getNotificationCopy({ type, payload }, t).message;

describe('notificationHelpers', () => {
  describe('getNotificationCopy', () => {
    it('titles every type in local copy', () => {
      for (const type of Object.values(NotificationType)) {
        const { title } = getNotificationCopy({ type, payload: {} }, t);
        expect(title).not.toBe('');
        expect(title).not.toContain('notifications.copy');
      }
    });

    it('builds an invitation from the payload names', () => {
      expect(
        messageOf(NotificationType.HomeInvitation, {
          inviterName: 'Ana',
          homeName: 'The Smiths',
        }),
      ).toBe('Ana invited you to join The Smiths');
      expect(
        messageOf(NotificationType.CollaborationInvite, {
          inviterName: 'Ana',
          listName: 'Weekly',
        }),
      ).toBe('Ana invited you to collaborate on Weekly');
    });

    it('names the actor and the list for a collaboration change', () => {
      expect(
        messageOf(NotificationType.CollaboratorRemoved, {
          removerName: 'Ana',
          listName: 'Weekly',
        }),
      ).toBe('Ana removed your access to Weekly');
      expect(
        messageOf(NotificationType.CollaborationAccepted, {
          accepterName: 'Ben',
          listName: 'Weekly',
        }),
      ).toBe('Ben accepted your invitation to Weekly');
    });

    it('reads a completed list from the event type', () => {
      expect(
        getNotificationCopy(
          {
            type: NotificationType.ListUpdated,
            payload: { listName: 'Weekly', eventType: 'complete' },
          },
          t,
        ),
      ).toEqual({
        title: 'Shopping list completed',
        message: 'The shopping list Weekly is complete',
      });
    });

    it('formats the remaining quantity of a low-stock alert', () => {
      expect(
        messageOf(NotificationType.LowStock, {
          itemName: 'Rice',
          currentQuantity: 0.5,
        }),
      ).toBe('Rice is running low (1/2 left)');
    });

    it('summarises a weekly digest by name and count', () => {
      expect(
        getNotificationCopy(
          makeExpiry({
            itemCount: 5,
            itemNames: ['Milk', 'Eggs', 'Kale', 'Tofu', 'Rice'],
          }),
          t,
        ),
      ).toEqual({
        title: 'Expiring this week',
        message: 'Milk, Eggs, Kale and 2 more expire soon',
      });
      expect(
        messageOf(NotificationType.ExpiryReminder, {
          itemCount: 1,
          itemNames: ['Milk'],
        }),
      ).toBe('Milk expires soon');
    });

    it('marks a test notification as a test whatever its type', () => {
      expect(
        getNotificationCopy(
          { type: NotificationType.LowStock, payload: { test: true } },
          t,
        ).title,
      ).toBe('Test notification');
    });

    it('falls back to a generic sentence when the payload lacks names', () => {
      expect(messageOf(NotificationType.HomeInvitation, {})).toBe(
        'You have an invitation to join a home',
      );
      expect(messageOf(NotificationType.CollaboratorRoleChanged, {})).toBe(
        'Your role on a shopping list changed',
      );
      expect(messageOf(NotificationType.ExpiryReminder, {})).toBe(
        'Some pantry items expire soon',
      );
      expect(messageOf(NotificationType.RecipeSaved, {})).toBe(
        'A recipe was saved',
      );
    });

    it('omits the batch qualifier for a single-batch item', () => {
      expect(
        messageOf(NotificationType.ExpiryReminder, {
          itemName: 'Lettuce',
          daysUntilExpiry: 3,
          isMultiBatch: false,
          activeBatchCount: 1,
        }),
      ).toBe('Lettuce expires in 3 days');
    });

    it('uses "today" / "tomorrow" wording for 0 and 1 day', () => {
      expect(
        messageOf(NotificationType.ExpiryReminder, {
          itemName: 'Baby Spinach',
          daysUntilExpiry: 0,
          isMultiBatch: false,
        }),
      ).toBe('Baby Spinach expires today');

      expect(
        messageOf(NotificationType.ExpiryReminder, {
          itemName: 'Pitas',
          daysUntilExpiry: 1,
          isMultiBatch: false,
        }),
      ).toBe('Pitas expires tomorrow');
    });

    it('qualifies a multi-batch item with the opened date in local time', () => {
      const { message } = getNotificationCopy(
        makeExpiry({
          itemName: 'Milk',
          daysUntilExpiry: 1,
          isMultiBatch: true,
          batchOpenedAt: '2026-03-05T12:00:00.000Z',
          batchAddedAt: '2026-03-01T12:00:00.000Z',
        }),
        t,
      );
      // Date is locale/timezone-formatted, so assert structure not an exact day.
      expect(message).toMatch(/^Milk \(opened .+\) expires tomorrow$/);
      expect(message).not.toContain('Batch');
    });

    it('falls back to the added date when the batch was never opened', () => {
      const { message } = getNotificationCopy(
        makeExpiry({
          itemName: 'Yogurt',
          daysUntilExpiry: 3,
          isMultiBatch: true,
          batchOpenedAt: null,
          batchAddedAt: '2026-03-01T12:00:00.000Z',
        }),
        t,
      );
      expect(message).toMatch(/^Yogurt \(added .+\) expires in 3 days$/);
    });
  });

  describe('getNotificationIcon', () => {
    it.each([
      [NotificationType.ExpiryReminder, 'time'],
      [NotificationType.LowStock, 'cube'],
      [NotificationType.NewItemAdded, 'add-circle'],
      [NotificationType.ItemUpdated, 'create'],
      [NotificationType.ItemDeleted, 'trash'],
      [NotificationType.MembershipInvite, 'home'],
      [NotificationType.CollaborationInvite, 'person-add'],
      [NotificationType.ListUpdated, 'list'],
      [NotificationType.HomeJoined, 'people'],
    ])('returns "%s" icon for %s', (type, icon) => {
      expect(getNotificationIcon(type)).toBe(icon);
    });

    it('returns notifications icon for unknown type', () => {
      expect(getNotificationIcon(NotificationType.RecipeCooked)).toBe(
        'notifications',
      );
    });
  });
});
