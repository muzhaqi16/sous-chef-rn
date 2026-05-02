/**
 * useNotificationStats Hook
 *
 * Wraps the GetNotificationStats query with cache-and-network fetch policy
 * and 60-second polling for server-authoritative badge counts.
 *
 * Complements the local Zustand unreadCount with server truth.
 */

import { useQuery } from '@apollo/client/react';
import { GetNotificationStatsDocument } from '../../graphql/operations/notifications/notificationStats.generated';

export function useNotificationStats(skip?: boolean) {
  const { data } = useQuery(GetNotificationStatsDocument, {
    pollInterval: 60_000,
    skip,
  });

  return {
    unreadCount: data?.notificationStats?.unread ?? 0,
    totalCount: data?.notificationStats?.total ?? 0,
    readCount: data?.notificationStats?.read ?? 0,
    stats: data?.notificationStats ?? null,
  };
}
