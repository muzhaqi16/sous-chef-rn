import { NotificationType } from '#/graphql/generated/schemaTypes';
import {
  getNotificationCopy,
  getNotificationIcon,
} from '#features/notifications/utils/notificationHelpers';
import { getI18n } from '#/i18n/config';
import { toDateKey } from '#/utils/dateUtils';
import { getPushTrayCopy } from '#features/notifications/pushCopy';
import type { NotificationPayload } from '#features/notifications/types';

// Real i18n instance (auto-initialized on config import) so the test exercises
// the actual locale keys + interpolation rather than a stubbed translator.
const t = getI18n().t;
const today = toDateKey(new Date());

const makeExpiry = (payload: NotificationPayload) => ({
  type: NotificationType.ExpiryReminder,
  payload,
});

const messageOf = (type: NotificationType, payload: NotificationPayload) =>
  getNotificationCopy({ type, payload }, t, today).message;

describe('notificationHelpers', () => {
  // FCM stringifies every value and the push path re-coerces numeric-looking
  // ones, so a home or item called "1234" arrives as the number 1234.
  describe('a name that is all digits, through the push path', () => {
    it('still names the home', () => {
      const copy = getPushTrayCopy(
        {
          type: NotificationType.HomeInvitation,
          inviterName: 'Ana',
          homeName: '1234',
        },
        t,
      );
      expect(copy?.body).toContain('1234');
    });

    it('still names the expiring item', () => {
      const copy = getPushTrayCopy(
        {
          type: NotificationType.ExpiryReminder,
          itemName: '7',
          daysUntilExpiry: '2',
        },
        t,
      );
      expect(copy?.body).toContain('7');
    });
  });

  describe('a notification type this build does not know', () => {
    // The server ships new types independently of the app. Rendered through
    // the template branch, an unknown type shows its raw lookup key.
    const unknown = 'SOMETHING_NEWER' as NotificationType;

    it('uses the words the server sent', () => {
      expect(
        getNotificationCopy(
          { type: unknown, payload: {}, title: 'Weekly recap', message: 'Hi' },
          t,
          today,
        ),
      ).toEqual({ title: 'Weekly recap', message: 'Hi' });
    });

    it('falls back to a generic title, never the key', () => {
      const copy = getNotificationCopy(
        { type: unknown, payload: {} },
        t,
        today,
      );
      expect(copy.title).toBe(t('notifications.copy.title.unknown'));
      expect(copy.title).not.toContain('notifications.');
    });
  });

  describe('getNotificationCopy', () => {
    it('titles every type in local copy', () => {
      for (const type of Object.values(NotificationType)) {
        const { title } = getNotificationCopy({ type, payload: {} }, t, today);
        expect(title).not.toBe('');
        expect(title).not.toContain('notifications.copy');
      }
    });

    describe('an authored announcement', () => {
      // An admin's free text is content a person wrote, like a list's name.
      const authored = {
        type: NotificationType.NewItemAdded,
        payload: {},
        isAuthoredContent: true,
        title: 'Scheduled maintenance',
        message: 'The app is read-only on Sunday morning.',
      };

      it('shows the words as written', () => {
        expect(getNotificationCopy(authored, t, today)).toEqual({
          title: 'Scheduled maintenance',
          message: 'The app is read-only on Sunday morning.',
        });
      });

      it('falls back to a local title when the author left none', () => {
        const { title } = getNotificationCopy(
          { ...authored, title: null },
          t,
          today,
        );
        expect(title).toBe('Announcement');
      });

      it('does NOT read the words when the row is not marked authored', () => {
        const copy = getNotificationCopy(
          { ...authored, isAuthoredContent: false },
          t,
          today,
        );
        expect(copy.title).not.toBe('Scheduled maintenance');
        expect(copy.message).not.toBe(
          'The app is read-only on Sunday morning.',
        );
      });

      it('does NOT read the words when the flag is absent', () => {
        const { isAuthoredContent: _omitted, ...unflagged } = authored;
        const copy = getNotificationCopy(unflagged, t, today);
        expect(copy.title).not.toBe('Scheduled maintenance');
      });
    });

    describe('a role change', () => {
      const base = {
        changerName: 'Ana',
        listName: 'Weekly',
      };

      it('names both roles when the payload carries them', () => {
        expect(
          messageOf(NotificationType.CollaboratorRoleChanged, {
            ...base,
            previousRole: 'VIEWER',
            newRole: 'EDITOR',
          }),
        ).toBe('Ana changed your role on Weekly from Viewer to Editor');
      });

      it('names the new role alone when there is no previous one', () => {
        expect(
          messageOf(NotificationType.CollaboratorRoleChanged, {
            ...base,
            newRole: 'SHOPPER',
          }),
        ).toBe('Ana changed your role on Weekly to Shopper');
      });

      it('omits a role value this build cannot name, never showing it raw', () => {
        const message = messageOf(NotificationType.CollaboratorRoleChanged, {
          ...base,
          newRole: 'QUARTERMASTER',
        });
        expect(message).toBe('Ana changed your role on Weekly');
        expect(message).not.toContain('QUARTERMASTER');
      });

      it('falls back to the generic wording without the actor or the list', () => {
        expect(
          messageOf(NotificationType.CollaboratorRoleChanged, {
            newRole: 'EDITOR',
          }),
        ).toBe('Your role on a shopping list changed');
      });
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
          today,
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
          today,
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
          today,
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
      ).toBe('Lettuce: Expires in 3 days');
    });

    // A reminder read a day after it was sent must not keep its send-time count.
    it('counts days from the payload date on this phone', () => {
      const inTwoDays = new Date();
      inTwoDays.setDate(inTwoDays.getDate() + 2);
      expect(
        messageOf(NotificationType.ExpiryReminder, {
          itemName: 'Kale',
          expiresOn: toDateKey(inTwoDays),
          daysUntilExpiry: 5,
          isMultiBatch: false,
        }),
      ).toBe('Kale: Expires in 2 days');
    });

    it('falls back to the sent count when the date is not a date', () => {
      expect(
        messageOf(NotificationType.ExpiryReminder, {
          itemName: 'Kale',
          expiresOn: '2026-09-22T12:00:00Z',
          daysUntilExpiry: 1,
          isMultiBatch: false,
        }),
      ).toBe('Kale: Expires tomorrow');
    });

    it('uses "today" / "tomorrow" wording for 0 and 1 day', () => {
      expect(
        messageOf(NotificationType.ExpiryReminder, {
          itemName: 'Baby Spinach',
          daysUntilExpiry: 0,
          isMultiBatch: false,
        }),
      ).toBe('Baby Spinach: Expires today');

      expect(
        messageOf(NotificationType.ExpiryReminder, {
          itemName: 'Pitas',
          daysUntilExpiry: 1,
          isMultiBatch: false,
        }),
      ).toBe('Pitas: Expires tomorrow');
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
        today,
      );
      // Date is locale/timezone-formatted, so assert structure not an exact day.
      expect(message).toMatch(/^Milk \(opened .+\): Expires tomorrow$/);
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
        today,
      );
      expect(message).toMatch(/^Yogurt \(added .+\): Expires in 3 days$/);
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
