import { NotificationType } from '#generated';
import {
  getNotificationIcon,
  getNotificationColor,
  getNotificationActionText,
} from '../notificationHelpers';

describe('notificationHelpers', () => {
  describe('getNotificationIcon', () => {
    it.each([
      [NotificationType.ExpiryReminder, 'schedule'],
      [NotificationType.LowStock, 'inventory-2'],
      [NotificationType.NewItemAdded, 'add-circle'],
      [NotificationType.ItemUpdated, 'edit'],
      [NotificationType.ItemDeleted, 'delete'],
      [NotificationType.MembershipInvite, 'home'],
      [NotificationType.CollaborationInvite, 'group-add'],
      [NotificationType.ListUpdated, 'list'],
      [NotificationType.HomeJoined, 'people'],
    ])('returns "%s" icon for %s', (type, icon) => {
      expect(getNotificationIcon(type)).toBe(icon);
    });

    it('returns notifications icon for unknown type', () => {
      expect(getNotificationIcon(NotificationType.RecipeCooked)).toBe('notifications');
    });
  });

  describe('getNotificationColor', () => {
    it('returns orange for ExpiryReminder', () => {
      expect(getNotificationColor(NotificationType.ExpiryReminder)).toBe('#FF9800');
    });

    it('returns amber for LowStock', () => {
      expect(getNotificationColor(NotificationType.LowStock)).toBe('#FFC107');
    });

    it('returns blue for MembershipInvite', () => {
      expect(getNotificationColor(NotificationType.MembershipInvite)).toBe('#2196F3');
    });

    it('returns blue for CollaborationInvite', () => {
      expect(getNotificationColor(NotificationType.CollaborationInvite)).toBe('#2196F3');
    });

    it('returns red for ItemDeleted', () => {
      expect(getNotificationColor(NotificationType.ItemDeleted)).toBe('#F44336');
    });

    it('returns green as default', () => {
      expect(getNotificationColor(NotificationType.NewItemAdded)).toBe('#4CAF50');
    });
  });

  describe('getNotificationActionText', () => {
    it('returns "View Invitation" for MembershipInvite', () => {
      expect(getNotificationActionText(NotificationType.MembershipInvite)).toBe(
        'View Invitation',
      );
    });

    it('returns "View List" for CollaborationInvite', () => {
      expect(getNotificationActionText(NotificationType.CollaborationInvite)).toBe(
        'View List',
      );
    });

    it('returns "View Items" for ExpiryReminder', () => {
      expect(getNotificationActionText(NotificationType.ExpiryReminder)).toBe(
        'View Items',
      );
    });

    it('returns "Add to Shopping List" for LowStock', () => {
      expect(getNotificationActionText(NotificationType.LowStock)).toBe(
        'Add to Shopping List',
      );
    });

    it('returns "View List" for ListUpdated', () => {
      expect(getNotificationActionText(NotificationType.ListUpdated)).toBe(
        'View List',
      );
    });

    it('returns null for types without actions', () => {
      expect(getNotificationActionText(NotificationType.NewItemAdded)).toBeNull();
      expect(getNotificationActionText(NotificationType.ItemUpdated)).toBeNull();
      expect(getNotificationActionText(NotificationType.RecipeCooked)).toBeNull();
    });
  });
});
