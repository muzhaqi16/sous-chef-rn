import { NotificationType } from '#generated';
import {
  NotificationCategory,
  NotificationPriority,
} from '#store/slices/notificationSlice';
import {
  parseNotificationPayload,
  getNotificationCategory,
  getNotificationPriority,
  getNotificationTitle,
  getNotificationMessage,
} from '../notificationParser';

describe('notificationParser', () => {
  describe('parseNotificationPayload', () => {
    it('parses a JSON string payload', () => {
      const payload = JSON.stringify({ title: 'Alert', message: 'Hello' });
      expect(parseNotificationPayload(payload)).toEqual({
        title: 'Alert',
        message: 'Hello',
      });
    });

    it('uses body as fallback for message in JSON string', () => {
      const payload = JSON.stringify({ title: 'Alert', body: 'Body text' });
      expect(parseNotificationPayload(payload)).toEqual({
        title: 'Alert',
        message: 'Body text',
      });
    });

    it('includes details when present in JSON string', () => {
      const payload = JSON.stringify({ title: 'X', message: 'Y', details: 'Z' });
      expect(parseNotificationPayload(payload).details).toBe('Z');
    });

    it('defaults title and message for empty JSON string', () => {
      const payload = JSON.stringify({});
      const result = parseNotificationPayload(payload);
      expect(result.title).toBe('Notification');
      expect(result.message).toBe('You have a new notification');
    });

    it('handles invalid JSON string', () => {
      const result = parseNotificationPayload('not json');
      expect(result.title).toBe('Notification');
      expect(result.message).toBe('not json');
    });

    it('parses an object payload', () => {
      const payload = { title: 'Alert', message: 'Hello', details: 'Detail' };
      expect(parseNotificationPayload(payload)).toEqual({
        title: 'Alert',
        message: 'Hello',
        details: 'Detail',
      });
    });

    it('uses body as fallback for message in object', () => {
      const payload = { body: 'Body text' };
      expect(parseNotificationPayload(payload).message).toBe('Body text');
    });

    it('defaults title and message for empty object', () => {
      const result = parseNotificationPayload({});
      expect(result.title).toBe('Notification');
      expect(result.message).toBe('You have a new notification');
    });
  });

  describe('getNotificationCategory', () => {
    it.each([
      [NotificationType.ListUpdated, NotificationCategory.SHOPPING_LIST],
      [NotificationType.ExpiryReminder, NotificationCategory.PANTRY],
      [NotificationType.LowStock, NotificationCategory.PANTRY],
      [NotificationType.NewItemAdded, NotificationCategory.PANTRY],
      [NotificationType.ItemUpdated, NotificationCategory.PANTRY],
      [NotificationType.ItemDeleted, NotificationCategory.PANTRY],
      [NotificationType.CollaborationInvite, NotificationCategory.COLLABORATION],
      [NotificationType.CollaborationAccepted, NotificationCategory.COLLABORATION],
      [NotificationType.CollaborationDeclined, NotificationCategory.COLLABORATION],
      [NotificationType.CollaboratorRemoved, NotificationCategory.COLLABORATION],
      [NotificationType.CollaboratorRoleChanged, NotificationCategory.COLLABORATION],
      [NotificationType.CollaboratorPermissionsUpdated, NotificationCategory.COLLABORATION],
      [NotificationType.MembershipInvite, NotificationCategory.MEMBERSHIP],
      [NotificationType.HomeInvitation, NotificationCategory.MEMBERSHIP],
      [NotificationType.HomeJoined, NotificationCategory.MEMBERSHIP],
    ])('categorizes %s correctly', (type, expected) => {
      expect(getNotificationCategory(type)).toBe(expected);
    });

    it('categorizes RecipeCooked as RECIPE', () => {
      expect(getNotificationCategory(NotificationType.RecipeCooked)).toBe(
        NotificationCategory.RECIPE,
      );
    });

    it('categorizes RecipeSaved as RECIPE', () => {
      expect(getNotificationCategory(NotificationType.RecipeSaved)).toBe(
        NotificationCategory.RECIPE,
      );
    });
  });

  describe('getNotificationPriority', () => {
    it('returns URGENT for ExpiryReminder', () => {
      expect(getNotificationPriority(NotificationType.ExpiryReminder)).toBe(
        NotificationPriority.URGENT,
      );
    });

    it.each([
      [NotificationType.LowStock],
      [NotificationType.CollaboratorRemoved],
    ])('returns HIGH for %s', (type) => {
      expect(getNotificationPriority(type)).toBe(NotificationPriority.HIGH);
    });

    it.each([
      [NotificationType.NewItemAdded],
      [NotificationType.ItemUpdated],
      [NotificationType.ItemDeleted],
      [NotificationType.CollaborationAccepted],
      [NotificationType.CollaborationDeclined],
    ])('returns LOW for %s', (type) => {
      expect(getNotificationPriority(type)).toBe(NotificationPriority.LOW);
    });

    it.each([
      [NotificationType.MembershipInvite],
      [NotificationType.HomeInvitation],
      [NotificationType.HomeJoined],
      [NotificationType.CollaborationInvite],
      [NotificationType.CollaboratorRoleChanged],
      [NotificationType.CollaboratorPermissionsUpdated],
      [NotificationType.ListUpdated],
    ])('returns MEDIUM for %s', (type) => {
      expect(getNotificationPriority(type)).toBe(NotificationPriority.MEDIUM);
    });

    it.each([
      [NotificationType.RecipeCooked],
      [NotificationType.RecipeSaved],
    ])('returns LOW for recipe type %s', (type) => {
      expect(getNotificationPriority(type)).toBe(NotificationPriority.LOW);
    });
  });

  describe('getNotificationTitle', () => {
    it('returns title for ExpiryReminder', () => {
      expect(getNotificationTitle(NotificationType.ExpiryReminder)).toContain('Expiring');
    });

    it('returns title for LowStock', () => {
      expect(getNotificationTitle(NotificationType.LowStock)).toContain('Low Stock');
    });

    it('returns title for NewItemAdded', () => {
      expect(getNotificationTitle(NotificationType.NewItemAdded)).toBe('New Item Added');
    });

    it('returns title for ItemUpdated', () => {
      expect(getNotificationTitle(NotificationType.ItemUpdated)).toBe('Item Updated');
    });

    it('returns title for ItemDeleted', () => {
      expect(getNotificationTitle(NotificationType.ItemDeleted)).toBe('Item Removed');
    });

    it('returns title for MembershipInvite', () => {
      expect(getNotificationTitle(NotificationType.MembershipInvite)).toContain('Invitation');
    });

    it('returns title for HomeInvitation', () => {
      expect(getNotificationTitle(NotificationType.HomeInvitation)).toContain('Invitation');
    });

    it('returns title for CollaborationInvite', () => {
      expect(getNotificationTitle(NotificationType.CollaborationInvite)).toContain('Invitation');
    });

    it('returns title for ListUpdated', () => {
      expect(getNotificationTitle(NotificationType.ListUpdated)).toContain('Shopping List');
    });

    it('returns title for HomeJoined', () => {
      expect(getNotificationTitle(NotificationType.HomeJoined)).toContain('Member');
    });

    it('returns title for CollaborationAccepted', () => {
      expect(getNotificationTitle(NotificationType.CollaborationAccepted)).toBe('Invitation Accepted');
    });

    it('returns title for CollaborationDeclined', () => {
      expect(getNotificationTitle(NotificationType.CollaborationDeclined)).toBe('Invitation Declined');
    });

    it('returns title for CollaboratorRemoved', () => {
      expect(getNotificationTitle(NotificationType.CollaboratorRemoved)).toBe('Removed from List');
    });

    it('returns title for CollaboratorRoleChanged', () => {
      expect(getNotificationTitle(NotificationType.CollaboratorRoleChanged)).toBe('Role Changed');
    });

    it('returns title for CollaboratorPermissionsUpdated', () => {
      expect(getNotificationTitle(NotificationType.CollaboratorPermissionsUpdated)).toBe('Permissions Updated');
    });

    it('returns title for RecipeCooked', () => {
      expect(getNotificationTitle(NotificationType.RecipeCooked)).toBe('Recipe Cooked');
    });

    it('returns title for RecipeSaved', () => {
      expect(getNotificationTitle(NotificationType.RecipeSaved)).toBe('Recipe Saved');
    });
  });

  describe('getNotificationMessage', () => {
    it('returns count for ExpiryReminder', () => {
      const msg = getNotificationMessage(NotificationType.ExpiryReminder, {
        items: ['a', 'b'],
      });
      expect(msg).toBe('2 items expiring soon');
    });

    it('handles singular count', () => {
      const msg = getNotificationMessage(NotificationType.ExpiryReminder, {
        items: ['a'],
      });
      expect(msg).toBe('1 item expiring soon');
    });

    it('handles zero items', () => {
      const msg = getNotificationMessage(NotificationType.ExpiryReminder, {});
      expect(msg).toBe('0 items expiring soon');
    });

    it('returns count for LowStock', () => {
      const msg = getNotificationMessage(NotificationType.LowStock, {
        items: ['x', 'y', 'z'],
      });
      expect(msg).toBe('3 items running low');
    });

    it('returns invite message for MembershipInvite', () => {
      const msg = getNotificationMessage(NotificationType.MembershipInvite, {
        inviterName: 'Alice',
        homeName: 'Cozy Home',
      });
      expect(msg).toContain('Alice');
      expect(msg).toContain('Cozy Home');
    });

    it('handles missing invite payload', () => {
      const msg = getNotificationMessage(NotificationType.MembershipInvite);
      expect(msg).toContain('Someone');
      expect(msg).toContain('a home');
    });

    it('returns collaboration message', () => {
      const msg = getNotificationMessage(NotificationType.CollaborationInvite, {
        listName: 'Weekly Groceries',
      });
      expect(msg).toContain('Weekly Groceries');
    });

    it('returns message for CollaborationAccepted', () => {
      const msg = getNotificationMessage(NotificationType.CollaborationAccepted, {
        collaboratorName: 'Bob',
        listName: 'Groceries',
      });
      expect(msg).toContain('Bob');
      expect(msg).toContain('accepted');
      expect(msg).toContain('Groceries');
    });

    it('returns message for CollaborationDeclined', () => {
      const msg = getNotificationMessage(NotificationType.CollaborationDeclined, {
        collaboratorName: 'Eve',
        listName: 'Party List',
      });
      expect(msg).toContain('Eve');
      expect(msg).toContain('declined');
      expect(msg).toContain('Party List');
    });

    it('returns message for CollaboratorRemoved', () => {
      const msg = getNotificationMessage(NotificationType.CollaboratorRemoved, {
        listName: 'Work List',
      });
      expect(msg).toContain('removed');
      expect(msg).toContain('Work List');
    });

    it('returns message for CollaboratorRoleChanged', () => {
      const msg = getNotificationMessage(NotificationType.CollaboratorRoleChanged, {
        listName: 'Shared List',
        newRole: 'EDITOR',
      });
      expect(msg).toContain('role');
      expect(msg).toContain('EDITOR');
    });

    it('returns message for CollaboratorPermissionsUpdated', () => {
      const msg = getNotificationMessage(NotificationType.CollaboratorPermissionsUpdated, {
        listName: 'Family List',
      });
      expect(msg).toContain('permissions');
      expect(msg).toContain('Family List');
    });

    it('handles missing payload for new collaboration types', () => {
      expect(getNotificationMessage(NotificationType.CollaborationAccepted)).toContain('Someone');
      expect(getNotificationMessage(NotificationType.CollaboratorRemoved)).toContain('a shopping list');
    });

    it('returns message for RecipeCooked', () => {
      const msg = getNotificationMessage(NotificationType.RecipeCooked, {
        recipeName: 'Pasta Carbonara',
      });
      expect(msg).toBe('Pasta Carbonara was marked as cooked');
    });

    it('returns message for RecipeSaved', () => {
      const msg = getNotificationMessage(NotificationType.RecipeSaved, {
        recipeName: 'Chicken Tikka',
      });
      expect(msg).toBe('Chicken Tikka was saved to your collection');
    });

    it('handles missing recipeName for RecipeCooked', () => {
      const msg = getNotificationMessage(NotificationType.RecipeCooked);
      expect(msg).toBe('A recipe was marked as cooked');
    });

    it('handles missing recipeName for RecipeSaved', () => {
      const msg = getNotificationMessage(NotificationType.RecipeSaved);
      expect(msg).toBe('A recipe was saved to your collection');
    });
  });
});
