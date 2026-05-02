import {
  groupNotificationsByDate,
  createSectionListData,
  NotificationGroups,
} from '../notificationGrouping';
import {
  NotificationCategory,
  NotificationType,
} from '../../graphql/generated/schemaTypes';
import {
  NotificationPriority,
  NotificationItem,
} from '#store/slices/notificationSlice';

function makeNotification(
  overrides: Partial<NotificationItem> = {},
): NotificationItem {
  return {
    id: 'n-1',
    type: NotificationType.NewItemAdded,
    category: NotificationCategory.System,
    priority: NotificationPriority.MEDIUM,
    title: 'Test',
    message: 'Test notification',
    payload: {},
    sentAt: new Date().toISOString(),
    readAt: null,
    isRead: false,
    ...overrides,
  };
}

describe('groupNotificationsByDate', () => {
  it('groups urgent notifications regardless of date', () => {
    const notification = makeNotification({
      priority: NotificationPriority.URGENT,
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

describe('createSectionListData', () => {
  it('creates sections only for non-empty groups', () => {
    const groups: NotificationGroups = {
      urgent: [makeNotification({ priority: NotificationPriority.URGENT })],
      today: [],
      yesterday: [],
      older: [makeNotification({ sentAt: '2020-01-01T00:00:00Z' })],
    };
    const sections = createSectionListData(groups);
    expect(sections).toHaveLength(2);
    expect(sections[0].title).toContain('Urgent');
    expect(sections[1].title).toBe('Older');
  });

  it('returns empty array when all groups are empty', () => {
    const groups: NotificationGroups = {
      urgent: [],
      today: [],
      yesterday: [],
      older: [],
    };
    expect(createSectionListData(groups)).toEqual([]);
  });

  it('preserves section order', () => {
    const groups: NotificationGroups = {
      urgent: [makeNotification()],
      today: [makeNotification()],
      yesterday: [makeNotification()],
      older: [makeNotification()],
    };
    const sections = createSectionListData(groups);
    expect(sections.map(s => s.title)).toEqual([
      expect.stringContaining('Urgent'),
      'Today',
      'Yesterday',
      'Older',
    ]);
  });
});
