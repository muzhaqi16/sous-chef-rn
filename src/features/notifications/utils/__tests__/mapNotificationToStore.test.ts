import { mapNotificationToStore } from '../mapNotificationToStore';
import {
  NotificationCategory,
  NotificationStatus,
  NotificationType,
  Priority,
} from '#/graphql/generated/schemaTypes';
import { NotificationPriority } from '#store/slices/notificationSlice';

const base = {
  __typename: 'Notification' as const,
  id: 'n-1',
  type: NotificationType.ExpiryReminder,
  status: NotificationStatus.Sent,
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
    expect(item.isRead).toBe(false);
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

  // The server counts a notification as unread only while PENDING or SENT, so
  // the terminal statuses must map to isRead even though `readAt` is null —
  // that combination is what used to inflate the locally recomputed badge.
  it.each([
    [NotificationStatus.Pending, false],
    [NotificationStatus.Sent, false],
    [NotificationStatus.Read, true],
    [NotificationStatus.Clicked, true],
    [NotificationStatus.Dismissed, true],
    [NotificationStatus.Expired, true],
    [NotificationStatus.Failed, true],
  ])('derives isRead from status %s → %s', (status, expected) => {
    expect(
      mapNotificationToStore({ ...base, status, readAt: null }).isRead,
    ).toBe(expected);
  });
});
