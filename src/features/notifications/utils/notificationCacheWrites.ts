/**
 * The cache writes that change a notification's state, in one place.
 *
 * Two callers apply the same transitions from different directions: the user
 * acting locally (`useNotificationSync`) and the server pushing an event
 * (`useNotificationListener`). They used to be separate — the sync hook wrote
 * Zustand, the subscription wrote Zustand differently — which is how a
 * mark-read from this device and a `READ` event from another could leave the
 * row and the badge disagreeing. Both now go through here.
 *
 * Every transition moves the row AND `User.unreadNotificationCount` together,
 * because they are one fact read two ways. The count is only ever adjusted when
 * the row's read-state actually changed, which is what makes a repeated event
 * (a re-delivered subscription push, a replayed offline mutation) safe.
 */
import type { ApolloCache } from '@apollo/client';
import {
  NotificationCategory,
  NotificationStatus,
} from '#/graphql/generated/schemaTypes';
import {
  createAddToParentConnectionUpdater,
  skipUnmatchedFilterVariants,
} from '#/apollo/utils/cacheUpdaters';
import {
  adjustUnreadNotificationCount,
  clearUnreadNotificationCount,
} from './notificationBadgeCacheUpdaters';
import {
  UseNotificationsOnLaunch_NotificationFragmentDoc,
  type UseNotificationsOnLaunch_NotificationFragment,
} from '#features/notifications/hooks/useNotificationsOnLaunch.generated';

/** A notification is awaiting the user only while PENDING or SENT. */
export const isUnreadStatus = (s: NotificationStatus | undefined): boolean =>
  s === NotificationStatus.Pending || s === NotificationStatus.Sent;

/**
 * Read one notification's cached status, or `undefined` when it is not cached.
 *
 * Uses `cache.modify` as a reader — returning `existing` unchanged is a no-op —
 * because it reports the field's absence, which `readFragment` cannot: a
 * fragment read of a partially-cached entity returns null exactly as a missing
 * one does, and "not cached" and "cached but unread" must not be confused here.
 */
export function readNotificationStatus(
  cache: ApolloCache,
  id: string,
): NotificationStatus | undefined {
  const cacheId = cache.identify({ __typename: 'Notification', id });
  if (!cacheId) return undefined;
  let status: NotificationStatus | undefined;
  cache.modify({
    id: cacheId,
    fields: {
      status: existing => {
        status = existing as NotificationStatus;
        return existing;
      },
    },
  });
  return status;
}

/** Write a notification's status, touching nothing else. */
export function writeNotificationStatus(
  cache: ApolloCache,
  id: string,
  status: NotificationStatus,
): void {
  const cacheId = cache.identify({ __typename: 'Notification', id });
  if (!cacheId) return;
  cache.modify({ id: cacheId, fields: { status: () => status } });
}

/**
 * Mark read, moving the badge only if it was actually unread.
 * @returns whether anything changed — callers use it to decide what to revert.
 */
export function applyNotificationRead(
  cache: ApolloCache,
  userId: string | null | undefined,
  id: string,
): boolean {
  if (!isUnreadStatus(readNotificationStatus(cache, id))) return false;
  writeNotificationStatus(cache, id, NotificationStatus.Read);
  adjustUnreadNotificationCount(cache, userId, -1);
  return true;
}

/** Mark unread, moving the badge only if it was actually read. */
export function applyNotificationUnread(
  cache: ApolloCache,
  userId: string | null | undefined,
  id: string,
): boolean {
  const status = readNotificationStatus(cache, id);
  if (status === undefined || isUnreadStatus(status)) return false;
  writeNotificationStatus(cache, id, NotificationStatus.Sent);
  adjustUnreadNotificationCount(cache, userId, 1);
  return true;
}

/**
 * Remove a notification.
 *
 * Evicting leaves a dangling edge in every connection that held it, which the
 * connection's `read` policy filters and counts down on the next read — the
 * same path the other delete flows rely on, and cheaper than editing each
 * cached variant's edge list.
 */
export function evictNotification(
  cache: ApolloCache,
  id: string,
  /** False in a multi-delete; call `cache.gc()` once at the end instead. */
  collectGarbage = true,
): boolean {
  const cacheId = cache.identify({ __typename: 'Notification', id });
  if (!cacheId) return false;
  cache.evict({ id: cacheId });
  if (collectGarbage) cache.gc();
  return true;
}

/** A notification's fields plus whether it counted toward the badge. */
export interface CapturedNotification {
  data: UseNotificationsOnLaunch_NotificationFragment;
  wasUnread: boolean;
}

/**
 * Read a notification out before eviction; the feed selects this same shape.
 *
 * `returnPartialData`, because a complete read is not the thing being checked:
 * a row that never loaded every field still has to come back exactly as it was
 * if the delete is refused, and a strict read would return null for it and
 * restore nothing.
 */
export function captureNotification(
  cache: ApolloCache,
  id: string,
): CapturedNotification | null {
  const data =
    cache.readFragment<UseNotificationsOnLaunch_NotificationFragment>({
      fragment: UseNotificationsOnLaunch_NotificationFragmentDoc,
      fragmentName: 'useNotificationsOnLaunch_notification',
      from: { __typename: 'Notification', id },
      returnPartialData: true,
    });
  if (!data?.id) return null;
  return { data, wasUnread: isUnreadStatus(data.status) };
}

/**
 * Put captured notifications back, badge included. Only the entity is written:
 * `mergeConnectionByNodeId`'s `read` filters dangling edges without altering
 * what is stored, so the edges revive with the record.
 */
export function restoreNotifications(
  cache: ApolloCache,
  userId: string | null | undefined,
  captured: CapturedNotification[],
): void {
  let unreadRestored = 0;
  captured.forEach(({ data, wasUnread }) => {
    cache.writeFragment({
      fragment: UseNotificationsOnLaunch_NotificationFragmentDoc,
      fragmentName: 'useNotificationsOnLaunch_notification',
      data,
    });
    if (wasUnread) unreadRestored += 1;
  });
  adjustUnreadNotificationCount(cache, userId, unreadRestored);
}

export function applyNotificationRemoved(
  cache: ApolloCache,
  userId: string | null | undefined,
  id: string,
): boolean {
  const wasUnread = isUnreadStatus(readNotificationStatus(cache, id));
  if (!evictNotification(cache, id)) return false;
  if (wasUnread) adjustUnreadNotificationCount(cache, userId, -1);
  return true;
}

const addToNotificationsConnection = createAddToParentConnectionUpdater<{
  id: string;
}>('User', 'notificationsConnection', 'Notification');

/**
 * Put a newly-arrived notification into the feed.
 *
 * The entity itself is already normalized — the subscription delivered it — so
 * only the connection edge is missing. `notificationsConnection` is keyed on
 * `filters`, and `cache.modify` runs its modifier for EVERY cached variant, so
 * the guard scopes the write: the unfiltered feed and the unread feed take it
 * (a new notification is unread), a variant filtered to another category does
 * not. Getting that wrong puts a pantry notification in the recipes feed, where
 * it stays until that variant is refetched.
 *
 * The badge is deliberately NOT touched here. See `useNotificationListener`:
 * a subscription-delivered event re-seeds the count from the server rather
 * than applying a delta, because the delta cannot be made idempotent on this
 * path.
 */
export function addNotificationToFeed(
  cache: ApolloCache,
  userId: string | null | undefined,
  id: string,
  category: NotificationCategory,
): void {
  if (!userId) return;
  addToNotificationsConnection(
    cache,
    userId,
    { id },
    {
      position: 'start',
      skipStoreField: skipUnmatchedFilterVariants({
        category,
        unreadOnly: true,
      }),
    },
  );
}

/**
 * Every cached notification id whose status is still unread.
 *
 * Read from `cache.extract()` rather than from the feed connection, because
 * "mark all read" means every notification the device knows about, not only the
 * page or the filtered variant currently on screen. `MarkAllNotificationsAsRead`
 * returns a summary count and no ids, so the affected rows have to be found
 * locally for the UI to move at all.
 */
export function cachedUnreadNotificationIds(cache: ApolloCache): string[] {
  const extracted = cache.extract() as Record<
    string,
    | { __typename?: string; id?: string; status?: NotificationStatus }
    | undefined
  >;
  return Object.entries(extracted)
    .filter(
      ([key, value]) =>
        key.startsWith('Notification:') &&
        !!value?.id &&
        isUnreadStatus(value.status),
    )
    .map(([, value]) => value!.id!);
}

/**
 * Mark every cached notification read and zero the badge.
 * @returns the ids that changed, so a refusal can put exactly those back.
 */
export function applyAllNotificationsRead(
  cache: ApolloCache,
  userId: string | null | undefined,
): string[] {
  const ids = cachedUnreadNotificationIds(cache);
  ids.forEach(id =>
    writeNotificationStatus(cache, id, NotificationStatus.Read),
  );
  if (ids.length > 0) clearUnreadNotificationCount(cache, userId);
  return ids;
}
