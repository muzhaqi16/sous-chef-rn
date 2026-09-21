/**
 * Settling a notification replay the server answered "not found": the
 * notification was deleted elsewhere, so the row goes, with nothing to report.
 */
import { applyNotificationRemoved } from '#features/notifications/utils/notificationCacheWrites';
import { useNotificationStore } from '#features/notifications/store/notificationStore';
import { isRecord } from '#/utils/isRecord';
import { useStore } from '#store';
import type { ReplayReconcilerTable } from '#/apollo/offlineQueue/types';

export const removeGoneNotification: ReplayReconcilerTable[string] = (
  cache,
  variables,
) => {
  const input: unknown = variables.input;
  if (!isRecord(input) || typeof input.id !== 'string') return;
  applyNotificationRemoved(cache, useStore.getState().user?.id, input.id);
  useNotificationStore.getState().clearExpirationLink(input.id);
};
