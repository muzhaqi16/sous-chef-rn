import type { DisplayNotification } from '#features/notifications/utils/toDisplayNotification';
import { Priority } from '#/graphql/generated/schemaTypes';
import { safeParseDate } from '#utils/dateUtils';
import { t } from '#/i18n';

export interface NotificationGroups {
  urgent: DisplayNotification[];
  today: DisplayNotification[];
  yesterday: DisplayNotification[];
  older: DisplayNotification[];
}

export const groupNotificationsByDate = (
  notifications: DisplayNotification[],
): NotificationGroups => {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const groups: NotificationGroups = {
    urgent: [],
    today: [],
    yesterday: [],
    older: [],
  };

  notifications.forEach(notification => {
    // Urgent notifications go to urgent group (both read and unread)
    if (notification.priority === Priority.Urgent) {
      groups.urgent.push(notification);
      return;
    }

    // Handle invalid dates safely
    const notificationDate = safeParseDate(notification.sentAt);
    if (!notificationDate) {
      // If we can't parse the date, put it in older group
      groups.older.push(notification);
      return;
    }

    if (notificationDate.toDateString() === today.toDateString()) {
      groups.today.push(notification);
    } else if (notificationDate.toDateString() === yesterday.toDateString()) {
      groups.yesterday.push(notification);
    } else {
      groups.older.push(notification);
    }
  });

  return groups;
};

export const createSectionListData = (groups: NotificationGroups) => {
  return [
    { title: t('notificationGroups.urgent'), data: groups.urgent },
    { title: t('notificationGroups.today'), data: groups.today },
    { title: t('notificationGroups.yesterday'), data: groups.yesterday },
    { title: t('notificationGroups.older'), data: groups.older },
  ].filter(section => section.data.length > 0);
};
