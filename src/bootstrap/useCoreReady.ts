import { restorePersistedCache } from '#/apollo/client';
import { useIsHydrated } from '#store/useAppStore';

/**
 * Whether the core can render: device storage has hydrated. The persisted
 * cache is restored in the render that first sees it, before the host mounts
 * `ApolloProvider`: `cache.restore()` replaces the cache wholesale, so it must
 * land before any query runs. Idempotent; safe on every render.
 */
export function useCoreReady(): boolean {
  const isHydrated = useIsHydrated();
  if (isHydrated) restorePersistedCache();
  return isHydrated;
}
