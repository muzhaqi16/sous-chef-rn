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
      ['ShoppingListUpdated', NotificationCategory.SHOPPING_LIST],
      ['ListItemAdded', NotificationCategory.SHOPPING_LIST],
      ['PantryItemExpiring', NotificationCategory.PANTRY],
      ['ExpiryWarning', NotificationCategory.PANTRY],
      ['LowStockAlert', NotificationCategory.PANTRY],
      ['CollaborationInvite', NotificationCategory.COLLABORATION],
      ['CollaboratorAdded', NotificationCategory.COLLABORATION],
      ['MembershipInvite', NotificationCategory.MEMBERSHIP],
      ['MemberJoined', NotificationCategory.MEMBERSHIP],
      ['HomeCreated', NotificationCategory.MEMBERSHIP],
    ])('categorizes "%s" correctly', (type, expected) => {
      expect(getNotificationCategory(type)).toBe(expected);
    });

    it('returns SYSTEM for unknown types', () => {
      expect(getNotificationCategory('UNKNOWN_TYPE')).toBe(NotificationCategory.SYSTEM);
    });

    it('handles Security type', () => {
      expect(getNotificationCategory('SecurityAlert')).toBe(
        NotificationCategory.SECURITY,
      );
    });

    it('handles Login type', () => {
      expect(getNotificationCategory('LoginAttempt')).toBe(
        NotificationCategory.SECURITY,
      );
    });

    it('handles Device type', () => {
      expect(getNotificationCategory('DeviceRegistered')).toBe(
        NotificationCategory.SECURITY,
      );
    });

    it('handles Account type', () => {
      expect(getNotificationCategory('AccountUpdated')).toBe(
        NotificationCategory.ACCOUNT,
      );
    });

    it('handles User type', () => {
      expect(getNotificationCategory('UserProfileChanged')).toBe(
        NotificationCategory.ACCOUNT,
      );
    });
  });

  describe('getNotificationPriority', () => {
    it('returns URGENT for expiry-related types', () => {
      expect(getNotificationPriority('ExpiryReminder')).toBe(
        NotificationPriority.URGENT,
      );
    });

    it('returns URGENT for security', () => {
      expect(getNotificationPriority('SecurityBreach')).toBe(
        NotificationPriority.URGENT,
      );
    });

    it('returns URGENT for suspicious activity', () => {
      expect(getNotificationPriority('SuspiciousLogin')).toBe(
        NotificationPriority.URGENT,
      );
    });

    it('returns URGENT for banned', () => {
      expect(getNotificationPriority('UserBanned')).toBe(
        NotificationPriority.URGENT,
      );
    });

    it('returns URGENT for suspended', () => {
      expect(getNotificationPriority('AccountSuspended')).toBe(
        NotificationPriority.URGENT,
      );
    });

    it('returns HIGH for low stock', () => {
      expect(getNotificationPriority('LowStockAlert')).toBe(
        NotificationPriority.HIGH,
      );
    });

    it('returns HIGH for invites', () => {
      expect(getNotificationPriority('InviteReceived')).toBe(
        NotificationPriority.HIGH,
      );
    });

    it('returns HIGH for failed operations', () => {
      expect(getNotificationPriority('SyncFailed')).toBe(
        NotificationPriority.HIGH,
      );
    });

    it('returns HIGH for warnings', () => {
      expect(getNotificationPriority('StorageWarning')).toBe(
        NotificationPriority.HIGH,
      );
    });

    it('returns LOW for item added', () => {
      expect(getNotificationPriority('ItemAdded')).toBe(
        NotificationPriority.LOW,
      );
    });

    it('returns LOW for item updated', () => {
      expect(getNotificationPriority('ItemUpdated')).toBe(
        NotificationPriority.LOW,
      );
    });

    it('returns LOW for settings changes', () => {
      expect(getNotificationPriority('SettingsChanged')).toBe(
        NotificationPriority.LOW,
      );
    });

    it('returns MEDIUM as default', () => {
      expect(getNotificationPriority('SomeOtherType')).toBe(
        NotificationPriority.MEDIUM,
      );
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

    it('falls back to payload title', () => {
      expect(
        getNotificationTitle(NotificationType.RecipeCooked, { title: 'Recipe Done' }),
      ).toBe('Recipe Done');
    });

    it('falls back to Notification', () => {
      expect(getNotificationTitle(NotificationType.RecipeCooked)).toBe('Notification');
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

    it('returns default message for unknown type', () => {
      const msg = getNotificationMessage(NotificationType.RecipeCooked);
      expect(msg).toBe('You have a new notification');
    });

    it('uses payload message when available', () => {
      const msg = getNotificationMessage(NotificationType.RecipeCooked, {
        message: 'Custom message',
      });
      expect(msg).toBe('Custom message');
    });
  });
});
