import { mapNotificationToStore } from '../mapNotificationToStore';
import {
  NotificationCategory,
  NotificationType,
  Priority,
} from '#/graphql/generated/schemaTypes';
import { NotificationPriority } from '#store/slices/notificationSlice';

const base = {
  __typename: 'Notification' as const,
  id: 'n-1',
  type: NotificationType.ExpiryReminder,
  status: null,
  priority: Priority.Urgent,
  title: 'Expiring soon',
  message: 'milk expires tomorrow',
  payload: null,
  category: NotificationCategory.Pantry,
  sentAt: '2026-01-01T00:00:00Z',
  expiresAt: null,
  sourceId: 'item-9',
  sourceType: 'PantryItem',
  actionUrl: null,
  readAt: null,
};

describe('mapNotificationToStore', () => {
  it('maps the server fragment to the store shape and translates priority', () => {
    const item = mapNotificationToStore(base);
    expect(item.id).toBe('n-1');
    expect(item.title).toBe('Expiring soon');
    expect(item.category).toBe(NotificationCategory.Pantry);
    expect(item.priority).toBe(NotificationPriority.URGENT);
    expect(item.sourceId).toBe('item-9');
    // isRead is intentionally NOT part of the mapped item (store derives it).
    expect('isRead' in item).toBe(false);
  });

  it('maps MEDIUM priority and derives a title when the title is absent', () => {
    const item = mapNotificationToStore({
      ...base,
      priority: Priority.Normal,
      title: null,
    });
    expect(item.priority).toBe(NotificationPriority.MEDIUM);
    expect(item.title).toBeTruthy(); // derived from type
    expect(item.category).toBe(NotificationCategory.Pantry);
  });
});
