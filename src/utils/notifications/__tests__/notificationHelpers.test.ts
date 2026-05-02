import { NotificationType } from '../../../graphql/generated/schemaTypes';
import { getNotificationIcon } from '../notificationHelpers';

describe('notificationHelpers', () => {
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
