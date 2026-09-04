import {
  groupNotificationsByDate,
  createNotificationFeedRows,
  NotificationGroups,
} from '../notificationGrouping';
import {
  NotificationCategory,
  NotificationType,
  Priority,
} from '#/graphql/generated/schemaTypes';
import type { DisplayNotification } from '../toDisplayNotification';

function makeNotification(
  overrides: Partial<DisplayNotification> = {},
): DisplayNotification {
  return {
    id: 'n-1',
    type: NotificationType.NewItemAdded,
    category: NotificationCategory.System,
    priority: Priority.Normal,
    title: 'Test',
    message: 'Test notification',
    payload: {},
    sentAt: new Date().toISOString(),
    readAt: null,
    isRead: false,
    requiresAction: false,
    actionData: {},
    ...overrides,
  };
}

describe('groupNotificationsByDate', () => {
  it('groups urgent notifications regardless of date', () => {
    const notification = makeNotification({
      priority: Priority.Urgent,
      sentAt: '2020-01-01T00:00:00Z', // old date
    });
    const groups = groupNotificationsByDate([notification]);
    expect(groups.urgent).toHaveLength(1);
    expect(groups.today).toHaveLength(0);
    expect(groups.yesterday).toHaveLength(0);
    expect(groups.older).toHaveLength(0);
  });

  it('groups today notifications', () => {
    const notification = makeNotification({
      sentAt: new Date().toISOString(),
    });
    const groups = groupNotificationsByDate([notification]);
    expect(groups.today).toHaveLength(1);
  });

  it('groups yesterday notifications', () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const notification = makeNotification({
      sentAt: yesterday.toISOString(),
    });
    const groups = groupNotificationsByDate([notification]);
    expect(groups.yesterday).toHaveLength(1);
  });

  it('groups older notifications', () => {
    const oldDate = new Date();
    oldDate.setDate(oldDate.getDate() - 7);
    const notification = makeNotification({
      sentAt: oldDate.toISOString(),
    });
    const groups = groupNotificationsByDate([notification]);
    expect(groups.older).toHaveLength(1);
  });

  it('puts notifications with invalid dates in older group', () => {
    const notification = makeNotification({
      sentAt: 'not-a-date',
    });
    const groups = groupNotificationsByDate([notification]);
    expect(groups.older).toHaveLength(1);
  });

  it('handles empty array', () => {
    const groups = groupNotificationsByDate([]);
    expect(groups.urgent).toHaveLength(0);
    expect(groups.today).toHaveLength(0);
    expect(groups.yesterday).toHaveLength(0);
    expect(groups.older).toHaveLength(0);
  });
});

describe('createNotificationFeedRows', () => {
  const headers = (rows: ReturnType<typeof createNotificationFeedRows>) =>
    rows.filter(row => row.kind === 'header').map(row => row.title);

  it('emits a header only for non-empty groups', () => {
    const groups: NotificationGroups = {
      urgent: [makeNotification({ priority: Priority.Urgent })],
      today: [],
      yesterday: [],
      older: [makeNotification({ sentAt: '2020-01-01T00:00:00Z' })],
    };
    const rows = createNotificationFeedRows(groups);
    expect(headers(rows)).toHaveLength(2);
    expect(headers(rows)[0]).toContain('Urgent');
    expect(headers(rows)[1]).toBe('Older');
  });

  it('puts each notification under its own header', () => {
    const urgent = makeNotification({ priority: Priority.Urgent });
    const rows = createNotificationFeedRows({
      urgent: [urgent],
      today: [],
      yesterday: [],
      older: [],
    });
    expect(rows).toHaveLength(2);
    expect(rows[0].kind).toBe('header');
    expect(rows[1]).toEqual({ kind: 'item', notification: urgent });
  });

  it('returns an empty array when every group is empty', () => {
    const groups: NotificationGroups = {
      urgent: [],
      today: [],
      yesterday: [],
      older: [],
    };
    expect(createNotificationFeedRows(groups)).toEqual([]);
  });

  it('preserves group order', () => {
    const groups: NotificationGroups = {
      urgent: [makeNotification()],
      today: [makeNotification()],
      yesterday: [makeNotification()],
      older: [makeNotification()],
    };
    expect(headers(createNotificationFeedRows(groups))).toEqual([
      expect.stringContaining('Urgent'),
      'Today',
      'Yesterday',
      'Older',
    ]);
  });
});
