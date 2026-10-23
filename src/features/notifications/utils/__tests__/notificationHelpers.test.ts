import {
  CollaboratorRole,
  NotificationType,
} from '#/graphql/generated/schemaTypes';
import { getNotificationCopy } from '#features/notifications/utils/notificationHelpers';
import { getI18n } from '#/i18n/config';
import { toDateKey, todayKey } from '#/utils/dateUtils';
import { getPushTrayCopy } from '#features/notifications/pushCopy';
import type { NotificationCopyData } from '#features/notifications/types';

// Real i18n instance (auto-initialized on config import) so the test exercises
// the actual locale keys + interpolation rather than a stubbed translator.
const t = getI18n().t;
const today = todayKey();

const makeExpiry = (data: NotificationCopyData) => ({
  type: NotificationType.ExpiryReminder,
  data,
});

const messageOf = (type: NotificationType, data: NotificationCopyData | null) =>
  getNotificationCopy({ type, data }, t, today).message;

type CopyMember<Typename extends NotificationCopyData['__typename']> = Extract<
  NotificationCopyData,
  { __typename: Typename }
>;

const pantryItems = (
  ...names: string[]
): CopyMember<'PantryChangeNotificationData'>['items'] =>
  names.map(name => ({ __typename: 'NotificationPantryItem', name }));

describe('notificationHelpers', () => {
  // FCM stringifies every value, so a home or item called "1234" arrives as
  // text that reads as a number; it is still the name.
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
          { type: unknown, data: null, title: 'Weekly recap', message: 'Hi' },
          t,
          today,
        ),
      ).toEqual({ title: 'Weekly recap', message: 'Hi' });
    });

    it('falls back to a generic title, never the key', () => {
      const copy = getNotificationCopy({ type: unknown, data: null }, t, today);
      expect(copy.title).toBe(t('notifications.copy.title.unknown'));
      expect(copy.title).not.toContain('notifications.');
    });
  });

  describe('getNotificationCopy', () => {
    it('titles every type in local copy', () => {
      for (const type of Object.values(NotificationType)) {
        const { title } = getNotificationCopy({ type, data: null }, t, today);
        expect(title).not.toBe('');
        expect(title).not.toContain('notifications.copy');
      }
    });

    describe('an authored announcement', () => {
      // An admin's free text is content a person wrote, like a list's name.
      const authored = {
        type: NotificationType.NewItemAdded,
        data: null,
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
      const base: CopyMember<'CollaboratorRoleChangedNotificationData'> = {
        __typename: 'CollaboratorRoleChangedNotificationData',
        changerName: 'Ana',
        listNameIfKnown: 'Weekly',
      };

      it('names both roles when the data carries them', () => {
        expect(
          messageOf(NotificationType.CollaboratorRoleChanged, {
            ...base,
            previousRole: CollaboratorRole.Viewer,
            newRole: CollaboratorRole.Editor,
          }),
        ).toBe('Ana changed your role on Weekly from Viewer to Editor');
      });

      it('names the new role alone when there is no previous one', () => {
        expect(
          messageOf(NotificationType.CollaboratorRoleChanged, {
            ...base,
            newRole: CollaboratorRole.Shopper,
          }),
        ).toBe('Ana changed your role on Weekly to Shopper');
      });

      it('omits a role value this build cannot name, never showing it raw', () => {
        const copy = getPushTrayCopy(
          {
            type: NotificationType.CollaboratorRoleChanged,
            changerName: 'Ana',
            listName: 'Weekly',
            newRole: 'QUARTERMASTER',
          },
          t,
        );
        expect(copy?.body).toBe('Ana changed your role on Weekly');
        expect(copy?.body).not.toContain('QUARTERMASTER');
      });

      it('falls back to the generic wording without the actor or the list', () => {
        expect(
          messageOf(NotificationType.CollaboratorRoleChanged, {
            __typename: 'CollaboratorRoleChangedNotificationData',
            listNameIfKnown: null,
            newRole: CollaboratorRole.Editor,
          }),
        ).toBe('Your role on a shopping list changed');
      });
    });

    it('builds an invitation from the names it carries', () => {
      expect(
        messageOf(NotificationType.HomeInvitation, {
          __typename: 'HomeInvitationNotificationData',
          inviterName: 'Ana',
          homeName: 'The Smiths',
        }),
      ).toBe('Ana invited you to join The Smiths');
      expect(
        messageOf(NotificationType.CollaborationInvite, {
          __typename: 'CollaborationInviteNotificationData',
          inviterName: 'Ana',
          listName: 'Weekly',
        }),
      ).toBe('Ana invited you to collaborate on Weekly');
    });

    it('names the actor and the list for a collaboration change', () => {
      expect(
        messageOf(NotificationType.CollaboratorRemoved, {
          __typename: 'CollaboratorRemovedNotificationData',
          removerName: 'Ana',
          listNameIfKnown: 'Weekly',
        }),
      ).toBe('Ana removed your access to Weekly');
      expect(
        messageOf(NotificationType.CollaborationAccepted, {
          __typename: 'CollaborationAcceptedNotificationData',
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
            data: {
              __typename: 'ListUpdatedNotificationData',
              listName: 'Weekly',
              eventType: 'complete',
            },
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
          __typename: 'LowStockNotificationData',
          itemName: 'Rice',
          currentQuantity: 0.5,
        }),
      ).toBe('Rice is running low (1/2 left)');
    });

    it('summarises a weekly digest by name and count', () => {
      expect(
        getNotificationCopy(
          makeExpiry({
            __typename: 'ExpiryDigestNotificationData',
            itemCount: 5,
            items: pantryItems('Milk', 'Eggs', 'Kale', 'Tofu', 'Rice'),
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
          __typename: 'ExpiryDigestNotificationData',
          itemCount: 1,
          items: pantryItems('Milk'),
        }),
      ).toBe('Milk expires soon');
    });

    it('marks a test notification as a test whatever its type', () => {
      expect(
        getNotificationCopy(
          { type: NotificationType.LowStock, data: null, isTest: true },
          t,
          today,
        ).title,
      ).toBe('Test notification');
    });

    it('falls back to a generic sentence for a row with no data', () => {
      expect(messageOf(NotificationType.HomeInvitation, null)).toBe(
        'You have an invitation to join a home',
      );
      expect(messageOf(NotificationType.CollaboratorRoleChanged, null)).toBe(
        'Your role on a shopping list changed',
      );
      expect(messageOf(NotificationType.ExpiryReminder, null)).toBe(
        'Some pantry items expire soon',
      );
      expect(messageOf(NotificationType.RecipeSaved, null)).toBe(
        'A recipe was saved',
      );
    });

    it('omits the batch qualifier for a single-batch item', () => {
      expect(
        messageOf(NotificationType.ExpiryReminder, {
          __typename: 'ExpiryReminderNotificationData',
          itemName: 'Lettuce',
          daysUntilExpiry: 3,
          isMultiBatch: false,
        }),
      ).toBe('Lettuce: Expires in 3 days');
    });

    // A reminder read a day after it was sent must not keep its send-time count.
    it('counts days from the expiry date on this phone', () => {
      const inTwoDays = new Date();
      inTwoDays.setDate(inTwoDays.getDate() + 2);
      expect(
        messageOf(NotificationType.ExpiryReminder, {
          __typename: 'ExpiryReminderNotificationData',
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
          __typename: 'ExpiryReminderNotificationData',
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
          __typename: 'ExpiryReminderNotificationData',
          itemName: 'Baby Spinach',
          daysUntilExpiry: 0,
          isMultiBatch: false,
        }),
      ).toBe('Baby Spinach: Expires today');

      expect(
        messageOf(NotificationType.ExpiryReminder, {
          __typename: 'ExpiryReminderNotificationData',
          itemName: 'Pitas',
          daysUntilExpiry: 1,
          isMultiBatch: false,
        }),
      ).toBe('Pitas: Expires tomorrow');
    });

    it('qualifies a multi-batch item with the opened date in local time', () => {
      const { message } = getNotificationCopy(
        makeExpiry({
          __typename: 'ExpiryReminderNotificationData',
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
          __typename: 'ExpiryReminderNotificationData',
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

  // The server's scheduled and coalesced notifications, worded from their
  // typed data (`docs/api/notifications.md` § Typed data).
  describe('a server-written summary or reminder', () => {
    it('names who changed a pantry and what', () => {
      expect(
        messageOf(NotificationType.NewItemAdded, {
          __typename: 'PantryChangeNotificationData',
          pantryName: 'Kitchen',
          itemCount: 1,
          items: pantryItems('Milk'),
          actorNames: ['Ana'],
        }),
      ).toBe('Ana added Milk to Kitchen');
      expect(
        messageOf(NotificationType.ItemDeleted, {
          __typename: 'PantryChangeNotificationData',
          pantryName: 'Kitchen',
          itemCount: 4,
          items: pantryItems('Milk', 'Eggs'),
          actorNames: ['Ana', 'Ben'],
        }),
      ).toBe('Ana and Ben removed 4 items from Kitchen');
    });

    it('counts the actors a summary cannot name', () => {
      expect(
        messageOf(NotificationType.SharedListChanged, {
          __typename: 'SharedListChangedNotificationData',
          listName: 'Groceries',
          actorNames: ['Ana', 'Ben', 'Cleo', 'Dan', 'Eve'],
        }),
      ).toBe('Ana, Ben, Cleo and 2 others made changes to Groceries');
    });

    it("says how much a list's reminder has left to buy", () => {
      expect(
        messageOf(NotificationType.ListReminder, {
          __typename: 'ListReminderNotificationData',
          listName: 'Groceries',
          itemCount: 3,
        }),
      ).toBe('Groceries has 3 items to buy');
      expect(
        messageOf(NotificationType.ListReminder, {
          __typename: 'ListReminderNotificationData',
          listName: 'Groceries',
          itemCount: 0,
        }),
      ).toBe('Your reminder for Groceries');
    });

    it('names what may run out, counting what it cannot name', () => {
      expect(
        messageOf(NotificationType.RunningLow, {
          __typename: 'RunningLowNotificationData',
          itemCount: 2,
          items: [
            { __typename: 'NotificationCatalogItem', name: 'Milk' },
            { __typename: 'NotificationCatalogItem', name: 'Eggs' },
          ],
        }),
      ).toBe('Milk and Eggs may run out soon');
      expect(
        messageOf(NotificationType.RunningLow, {
          __typename: 'RunningLowNotificationData',
          itemCount: 4,
          items: [],
        }),
      ).toBe('4 items may run out soon');
      expect(messageOf(NotificationType.RunningLow, null)).toBe(
        'Some pantry items may run out soon',
      );
    });

    it('counts the meals of a reminder that names none', () => {
      expect(
        messageOf(NotificationType.MealPlanReminder, {
          __typename: 'MealPlanReminderNotificationData',
          mealCount: 2,
          meals: [],
        }),
      ).toBe('2 meals planned for today');
    });

    it("names the day's meals, counting the rest", () => {
      expect(
        messageOf(NotificationType.MealPlanReminder, {
          __typename: 'MealPlanReminderNotificationData',
          mealCount: 5,
          meals: ['Oats', 'Salad', 'Soup'].map(name => ({
            __typename: 'NotificationPlannedMeal',
            name,
          })),
        }),
      ).toBe('Planned today: Oats, Salad, Soup and 2 others');
    });

    it('tells when to start cooking in the reader’s clock', () => {
      expect(
        messageOf(NotificationType.CookingReminder, {
          __typename: 'CookingReminderNotificationData',
          recipeName: 'Lasagna',
          mealTime: '18:30',
        }),
      ).toBe('Start Lasagna now to eat at 6:30 PM');
      expect(
        messageOf(NotificationType.CookingReminder, {
          __typename: 'CookingReminderNotificationData',
          recipeName: 'Lasagna',
        }),
      ).toBe('Start Lasagna now');
    });

    it('lists only the figures a weekly digest has', () => {
      expect(
        messageOf(NotificationType.WeeklyDigest, {
          __typename: 'PantryWeeklyDigestNotificationData',
          itemsAdded: 1,
          itemsUsed: 0,
          itemsWasted: 2,
          itemsExpiringSoon: 3,
        }),
      ).toBe('1 item added, 2 wasted, 3 expiring this week');
    });

    it('words a monthly report from its counts', () => {
      expect(
        messageOf(NotificationType.MonthlyReport, {
          __typename: 'MonthlyReportNotificationData',
          purchaseCount: 12,
          recipesCooked: 1,
          wastedItemCount: 0,
        }),
      ).toBe('12 purchases, 1 recipe cooked');
    });

    it('falls back to a sentence when the data names nothing', () => {
      expect(
        messageOf(NotificationType.RecipeRecommendations, {
          __typename: 'RecipeRecommendationsNotificationData',
          recipes: [],
        }),
      ).toBe("Recipes match what's in your pantry");
      expect(messageOf(NotificationType.WeeklyDigest, null)).toBe(
        'Your weekly pantry summary is ready',
      );
      expect(messageOf(NotificationType.NewItemAdded, null)).toBe(
        'An item was added',
      );
    });

    // Push data is a flat string map: the lists arrive as JSON text.
    it('words the same notification from its push data', () => {
      expect(
        getPushTrayCopy(
          {
            type: NotificationType.RecipeRecommendations,
            recipeCount: '2',
            recipeNames: '["Chili","Tacos"]',
          },
          t,
        ),
      ).toEqual({
        title: 'Recipes for your pantry',
        body: 'Your pantry is ready for Chili and Tacos',
      });
    });
  });
});
