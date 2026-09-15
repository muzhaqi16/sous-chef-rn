import { toDisplayNotification } from '../toDisplayNotification';
import {
  NotificationCategory,
  NotificationSourceType,
  NotificationStatus,
  NotificationType,
  Priority,
} from '#/graphql/generated/schemaTypes';

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
  sourceType: NotificationSourceType.PantryItem,
  actionUrl: null,
  readAt: null,
};

describe('toDisplayNotification', () => {
  it('passes the server fragment through and derives the display fields', () => {
    const item = toDisplayNotification(base);
    expect(item.id).toBe('n-1');
    expect(item.category).toBe(NotificationCategory.Pantry);
    expect(item.priority).toBe(Priority.Urgent);
    expect(item.sourceId).toBe('item-9');
    expect(item.isRead).toBe(false);
  });

  it('keeps the NORMAL priority and the category', () => {
    const item = toDisplayNotification({ ...base, priority: Priority.Normal });
    expect(item.priority).toBe(Priority.Normal);
    expect(item.category).toBe(NotificationCategory.Pantry);
  });

  it("carries none of the server's English copy", () => {
    const item = toDisplayNotification(base);
    expect(Object.values(item)).not.toContain(base.title);
    expect(Object.values(item)).not.toContain(base.message);
  });

  // The server counts a notification as unread only while PENDING or SENT, so
  // the terminal statuses must map to isRead even though `readAt` is null —
  // that combination is what inflates a locally recomputed badge.
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
      toDisplayNotification({ ...base, status, readAt: null }).isRead,
    ).toBe(expected);
  });
});
