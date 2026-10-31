/**
 * What each notification write changes on the device, as a pending layer. A
 * payload states `notificationSummary`, which settles the badge by
 * normalization, so a local delta lasts only as long as its layer.
 */
import type { OperationVariables } from '@apollo/client';
import type { LocalWrite } from '#/apollo/pendingWrites/types';
import { appliedPayload } from '#/utils/errors/mutationPayload';
import { isRecord } from '#/utils/isRecord';
import {
  applyAllNotificationsRead,
  applyNotificationRead,
  applyNotificationRemoved,
  dropNotifications,
  hideNotification,
} from '#features/notifications/utils/notificationCacheWrites';

const idsOf = ({ input }: OperationVariables): string[] => {
  const value: unknown = input;
  if (!isRecord(value)) return [];
  if (typeof value.id === 'string') return [value.id];
  return Array.isArray(value.ids)
    ? value.ids.filter((id): id is string => typeof id === 'string')
    : [];
};

export const markRead: LocalWrite = {
  // The answer states the row and the summary.
  apply(cache, { variables }) {
    idsOf(variables).forEach(id => applyNotificationRead(cache, id));
  },
};

const readEveryRow: LocalWrite['apply'] = cache => {
  applyAllNotificationsRead(cache);
};

export const markAllRead: LocalWrite = {
  apply: readEveryRow,
  // The answer states the summary and a total, no rows.
  commit: readEveryRow,
};

export const removeNotifications: LocalWrite = {
  apply(cache, { variables }) {
    idsOf(variables).forEach(id => hideNotification(cache, id));
  },
  // The answer names no row. One that says the row was already gone states no
  // summary either, so that row's share of the badge is still ours to take.
  commit(cache, { variables }, data) {
    const payload: unknown = appliedPayload(data);
    if (payload) dropNotifications(cache, idsOf(variables));
    else idsOf(variables).forEach(id => applyNotificationRemoved(cache, id));
  },
};
