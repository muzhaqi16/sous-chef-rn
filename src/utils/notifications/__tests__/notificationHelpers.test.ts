import { NotificationType } from '#/graphql/generated/schemaTypes';
import {
  getNotificationDisplayMessage,
  getNotificationIcon,
} from '../notificationHelpers';
import { getI18n } from '#/i18n/config';
import type { NotificationPayload } from '#store/slices/notificationSlice';

// Real i18n instance (auto-initialized on config import) so the test exercises
// the actual locale keys + interpolation rather than a stubbed translator.
const i18n = getI18n();
const t = (key: string, options?: Record<string, unknown>): string =>
  i18n.t(key, options);

const makeExpiry = (payload: NotificationPayload) => ({
  type: NotificationType.ExpiryReminder,
  message: 'SERVER FALLBACK',
  payload,
});

describe('notificationHelpers', () => {
  describe('getNotificationDisplayMessage', () => {
    it('returns the server message verbatim for non-expiry types', () => {
      expect(
        getNotificationDisplayMessage(
          {
            type: NotificationType.HomeInvitation,
            message: 'You have been invited.',
            payload: {},
          },
          t,
        ),
      ).toBe('You have been invited.');
    });

    it('omits the batch qualifier for a single-batch item', () => {
      expect(
        getNotificationDisplayMessage(
          makeExpiry({
            itemName: 'Lettuce',
            daysUntilExpiry: 3,
            isMultiBatch: false,
            activeBatchCount: 1,
          }),
          t,
        ),
      ).toBe('Lettuce expires in 3 days');
    });

    it('uses "today" / "tomorrow" wording for 0 and 1 day', () => {
      expect(
        getNotificationDisplayMessage(
          makeExpiry({
            itemName: 'Baby Spinach',
            daysUntilExpiry: 0,
            isMultiBatch: false,
          }),
          t,
        ),
      ).toBe('Baby Spinach expires today');

      expect(
        getNotificationDisplayMessage(
          makeExpiry({
            itemName: 'Pitas',
            daysUntilExpiry: 1,
            isMultiBatch: false,
          }),
          t,
        ),
      ).toBe('Pitas expires tomorrow');
    });

    it('qualifies a multi-batch item with the opened date in local time', () => {
      const message = getNotificationDisplayMessage(
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
      const message = getNotificationDisplayMessage(
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

    it('falls back to the server message for a legacy payload missing fields', () => {
      expect(
        getNotificationDisplayMessage(makeExpiry({ daysUntilExpiry: 3 }), t),
      ).toBe('SERVER FALLBACK');
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
