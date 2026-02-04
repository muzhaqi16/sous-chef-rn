import { WatchQueryFetchPolicy } from '@apollo/client';
import { useStore } from '#store';
import { useIsEffectivelyOffline } from '#hooks/settings/useOfflineMode';

/**
 * Get appropriate fetch policy based on online status and offline mode preference
 *
 * When effectively online: Uses provided online policy (cache-and-network, network-only, etc.)
 * When effectively offline: Forces cache-only to prevent network errors from clearing UI
 *
 * "Effectively offline" means either:
 * - Device has no network connectivity
 * - User has enabled offline mode in settings
 *
 * This is the foundation of our offline-first architecture - queries automatically
 * adapt to network status and user preferences without manual previousData fallbacks.
 *
 * @param onlinePolicy - Policy to use when online (default: 'cache-and-network')
 * @param offlinePolicy - Policy to use when offline (default: 'cache-only')
 * @returns The appropriate fetch policy for current network status and settings
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
  // Use selector to check if effectively offline (device offline OR offline mode enabled)
  const isEffectivelyOffline = useIsEffectivelyOffline();
  return isEffectivelyOffline ? offlinePolicy : onlinePolicy;
}

/**
 * Legacy hook for device-only offline check (does not respect offline mode preference)
 * Use useOfflineAwareFetchPolicy instead for most cases
 *
 * @deprecated Use useOfflineAwareFetchPolicy which also respects offline mode preference
 */
export function useDeviceOfflineFetchPolicy(
  onlinePolicy: WatchQueryFetchPolicy = 'cache-and-network',
  offlinePolicy: WatchQueryFetchPolicy = 'cache-only'
): WatchQueryFetchPolicy {
  const isOnline = useStore(state => state.isOnline);
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
