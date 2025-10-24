import { WatchQueryFetchPolicy } from '@apollo/client';
import { useStore } from '#store';

/**
 * Get appropriate fetch policy based on online status
 *
 * When online: Uses provided online policy (cache-and-network, network-only, etc.)
 * When offline: Forces cache-only to prevent network errors from clearing UI
 *
 * This is the foundation of our offline-first architecture - queries automatically
 * adapt to network status without manual previousData fallbacks.
 *
 * @param onlinePolicy - Policy to use when online (default: 'cache-and-network')
 * @param offlinePolicy - Policy to use when offline (default: 'cache-only')
 * @returns The appropriate fetch policy for current network status
 *
 * @example
 * ```typescript
 * const fetchPolicy = useOfflineAwareFetchPolicy('cache-and-network', 'cache-only');
 * const { data } = useQuery(QUERY, { fetchPolicy });
 * ```
 */
export function useOfflineAwareFetchPolicy(
  onlinePolicy: WatchQueryFetchPolicy = 'cache-and-network',
  offlinePolicy: WatchQueryFetchPolicy = 'cache-only'
): WatchQueryFetchPolicy {
  const { isOnline } = useStore();
  return isOnline ? onlinePolicy : offlinePolicy;
}

/**
 * Recommended fetch policies for different data access patterns
 *
 * These presets ensure consistent offline behavior across the app
 */
export const OFFLINE_FETCH_POLICIES = {
  /**
   * For lists/collections that need fresh data but must work offline
   * Examples: Shopping lists, pantry items, recipe collections
   *
   * Online: Fetches fresh data while showing cached
   * Offline: Only uses cache
   */
  LIST: {
    online: 'cache-and-network' as const,
    offline: 'cache-only' as const,
  },

  /**
   * For detail views that can use slightly stale data
   * Examples: Recipe details, item details, user profiles
   *
   * Online: Uses cache first, fetches in background
   * Offline: Only uses cache
   */
  DETAIL: {
    online: 'cache-first' as const,
    offline: 'cache-only' as const,
  },

  /**
   * For critical data that must always work offline
   * Examples: User session, app config, essential metadata
   *
   * Always prefers cache, only fetches if missing
   */
  CRITICAL: {
    online: 'cache-first' as const,
    offline: 'cache-only' as const,
  },

  /**
   * For data that requires fresh fetch every time (use sparingly!)
   * Examples: Payment data, real-time prices
   *
   * Online: Always fetches fresh
   * Offline: Falls back to cache
   */
  REALTIME: {
    online: 'network-only' as const,
    offline: 'cache-only' as const,
  },
} as const;

/**
 * Helper to use preset policies
 *
 * @example
 * ```typescript
 * const fetchPolicy = useOfflinePresetPolicy('LIST');
 * const { data } = useQuery(QUERY, { fetchPolicy });
 * ```
 */
export function useOfflinePresetPolicy(
  preset: keyof typeof OFFLINE_FETCH_POLICIES
): WatchQueryFetchPolicy {
  const policies = OFFLINE_FETCH_POLICIES[preset];
  return useOfflineAwareFetchPolicy(policies.online, policies.offline);
}
